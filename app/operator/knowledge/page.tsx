import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { db, must } from "@/lib/db/client";
import { KnowledgeView, type DocItem } from "@/components/operator/KnowledgeView";
import { ListSkeleton } from "@/components/operator/ListSkeleton";

export const metadata: Metadata = { title: "Knowledge" };

export default function KnowledgePage({ searchParams }: PageProps<"/operator/knowledge">) {
  return (
    <main className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <Suspense fallback={<ListSkeleton rows={8} />}>
        <Data searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Data({ searchParams }: { searchParams: PageProps<"/operator/knowledge">["searchParams"] }) {
  const s = await getSession();
  if (!s || s.role === "parent") redirect("/");
  const [{ doc }, docs, findings] = await Promise.all([
    searchParams,
    db().from("documents").select("id,title,emoji,parent_title,visibility,visibility_set_by,status,source_updated_at,updated_at,sources(kind,account_label,name)").eq("school_id", s.schoolId).order("title"),
    db().from("findings").select("document_id,status").eq("school_id", s.schoolId),
  ]);
  const held = new Map<string, number>();
  for (const f of findings.data ?? []) if (f.status === "held") held.set(f.document_id, (held.get(f.document_id) ?? 0) + 1);
  const items: DocItem[] = (must(docs, "documents") as unknown as Array<{ id: string; title: string; emoji: string | null; parent_title: string | null; visibility: "family" | "staff"; visibility_set_by: string; status: string; source_updated_at: string | null; updated_at: string; sources: { kind: string; account_label: string | null; name: string } | null }>).map((d) => ({
    id: d.id,
    title: d.title,
    emoji: d.emoji,
    parent: d.parent_title,
    visibility: d.visibility,
    archived: d.status === "archived",
    sourceKind: d.sources?.kind ?? "manual",
    sourceLabel: d.sources?.kind === "manual" ? "Front Desk answers" : `${d.sources?.name ?? "Source"}${d.sources?.account_label ? ` · ${d.sources.account_label}` : ""}`,
    updatedAt: d.source_updated_at ?? d.updated_at,
    held: held.get(d.id) ?? 0,
  }));
  return <KnowledgeView docs={items} initialId={typeof doc === "string" ? doc : null} />;
}
