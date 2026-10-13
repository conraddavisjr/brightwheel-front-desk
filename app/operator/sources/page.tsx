import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db/client";
import { PageHeader } from "@/components/operator/Panel";
import { SourcesView, type SourceCard } from "@/components/operator/SourcesView";
import { ListSkeleton } from "@/components/operator/ListSkeleton";
import { notionConfigured } from "@/lib/integrations/notion";
import { googleConfigured } from "@/lib/integrations/google";
import { slackConfigured } from "@/lib/integrations/slack";

export const metadata: Metadata = { title: "Sources" };

export default function SourcesPage({ searchParams }: PageProps<"/operator/sources">) {
  return (
    <main className="mx-auto max-w-[1000px] space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <PageHeader title="Sources" subtitle="Front Desk reads from the tools you already keep up to date. Everything passes through Privacy Guard before families can search it." />
      <Suspense fallback={<ListSkeleton rows={4} />}>
        <Data searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Data({ searchParams }: { searchParams: PageProps<"/operator/sources">["searchParams"] }) {
  const s = await getSession();
  if (!s || s.role === "parent") redirect("/");
  const [params, sources, docs, events] = await Promise.all([
    searchParams,
    db().from("sources").select("id,kind,name,status,account_label,last_synced_at,last_error,config,token_enc").eq("school_id", s.schoolId).order("created_at"),
    db().from("documents").select("source_id,visibility,status").eq("school_id", s.schoolId),
    db().from("events").select("source_id").eq("school_id", s.schoolId),
  ]);
  const cards: SourceCard[] = (sources.data ?? []).map((src) => {
    const mine = (docs.data ?? []).filter((d) => d.source_id === src.id && d.status === "active");
    return {
      id: src.id,
      kind: src.kind,
      name: src.name,
      status: src.status,
      account: src.account_label,
      lastSynced: src.last_synced_at,
      error: src.last_error,
      live: Boolean(src.token_enc) || src.kind === "ical",
      demo: Boolean((src.config as { demo?: boolean })?.demo) && !src.token_enc,
      link: (src.config as { link?: string | null })?.link ?? null,
      docs: mine.length,
      familyDocs: mine.filter((d) => d.visibility === "family").length,
      events: (events.data ?? []).filter((e) => e.source_id === src.id).length,
    };
  });
  const flash = Object.fromEntries(Object.entries(params).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])) as Record<string, string | undefined>;
  return <SourcesView sources={cards} flash={flash} configured={{ notion: notionConfigured(), google: googleConfigured(), slack: slackConfigured() }} />;
}
