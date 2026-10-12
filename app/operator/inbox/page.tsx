import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { openGaps, peopleById } from "@/lib/db/operator";
import { db } from "@/lib/db/client";
import { PageHeader } from "@/components/operator/Panel";
import { InboxView, type GapItem } from "@/components/operator/InboxView";
import { ListSkeleton } from "@/components/operator/ListSkeleton";

export const metadata: Metadata = { title: "Inbox" };

export default function InboxPage({ searchParams }: PageProps<"/operator/inbox">) {
  return (
    <main className="mx-auto max-w-[1000px] space-y-5 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <PageHeader title="Inbox" subtitle="Real questions families asked that Front Desk couldn't answer, and places your documents disagree. Answer once; it's searchable right away." />
      <Suspense fallback={<ListSkeleton rows={5} />}>
        <InboxData searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function InboxData({ searchParams }: { searchParams: PageProps<"/operator/inbox">["searchParams"] }) {
  const s = await getSession();
  if (!s || s.role === "parent") redirect("/");
  const [{ gap: focus }, gaps, people] = await Promise.all([searchParams, openGaps(s.schoolId), peopleById(s.schoolId)]);
  // Conflicts name their two documents in the normalized key ("conflict <docA> <docB>").
  const { data: conflictKeys } = await db().from("gaps").select("id,normalized").eq("school_id", s.schoolId).eq("kind", "conflict");
  const ids = [...new Set((conflictKeys ?? []).flatMap((c) => c.normalized.split(" ").slice(1)))];
  const { data: docs } = ids.length ? await db().from("documents").select("id,title,source_updated_at,status").in("id", ids) : { data: [] as Array<{ id: string; title: string; source_updated_at: string | null; status: string }> };
  const docMap = new Map((docs ?? []).map((d) => [d.id, d]));
  const items: GapItem[] = gaps.map((g) => ({
    ...g,
    askers: g.asker_ids.map((id) => people.get(id)).filter(Boolean).map((p) => ({ id: p!.id, name: p!.name, hue: p!.avatar_hue })),
    documents:
      g.kind === "conflict"
        ? ((conflictKeys ?? []).find((c) => c.id === g.id)?.normalized.split(" ").slice(1) ?? [])
            .map((id: string) => docMap.get(id))
            .filter(Boolean)
            .map((d: { id: string; title: string; source_updated_at: string | null; status: string } | undefined) => ({ id: d!.id, title: d!.title, updatedAt: d!.source_updated_at, archived: d!.status === "archived" }))
        : [],
  }));
  return <InboxView items={items} focusId={typeof focus === "string" ? focus : null} />;
}
