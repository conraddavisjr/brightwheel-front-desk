import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { db, must } from "@/lib/db/client";
import { PageHeader } from "@/components/operator/Panel";
import { PrivacyView, type HeldItem, type QuarantinedDoc, type RuleItem, type LogItem } from "@/components/operator/PrivacyView";
import { ListSkeleton } from "@/components/operator/ListSkeleton";
import { PRESET_RULES } from "@/lib/privacy/presets";

export const metadata: Metadata = { title: "Privacy Guard" };

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-[1000px] space-y-5 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <PageHeader title="Privacy Guard" subtitle="Before anything becomes searchable, Front Desk checks it for details families shouldn't see. You decide what happens to each one." />
      <Suspense fallback={<ListSkeleton rows={5} />}>
        <Data />
      </Suspense>
    </main>
  );
}

const CONTEXT = 140;

async function Data() {
  const s = await getSession();
  if (!s || s.role === "parent") redirect("/");
  const client = db();
  const [findings, docs, rules, log, people] = await Promise.all([
    client.from("findings").select("id,document_id,category,label,span_start,span_end,excerpt,detector,confidence,reason,status").eq("school_id", s.schoolId),
    client.from("documents").select("id,title,url,content,visibility,visibility_reason,visibility_set_by,visibility_reviewed,status,sources(kind)").eq("school_id", s.schoolId),
    client.from("privacy_rules").select("id,name,description,category,pattern,preset,enabled,created_at").eq("school_id", s.schoolId).order("created_at"),
    client.from("audit_log").select("id,action,detail,at,actor_id").eq("school_id", s.schoolId).order("at", { ascending: false }).limit(40),
    client.from("people").select("id,name").eq("school_id", s.schoolId).neq("role", "parent"),
  ]);
  const docMap = new Map((must(docs, "documents") as unknown as Array<{ id: string; title: string; url: string | null; content: string; visibility: string; visibility_reason: string | null; visibility_set_by: string; visibility_reviewed: boolean; status: string; sources: { kind: string } | null }>).map((d) => [d.id, d]));
  const all = must(findings, "findings") as Array<{ id: string; document_id: string; category: string; label: string; span_start: number; span_end: number; excerpt: string; detector: string; confidence: number; reason: string | null; status: string }>;

  const held: HeldItem[] = all
    .filter((f) => f.status === "held" && docMap.get(f.document_id)?.status === "active")
    .map((f) => {
      const d = docMap.get(f.document_id)!;
      return {
        id: f.id,
        documentId: d.id,
        documentTitle: d.title,
        documentUrl: d.url,
        sourceKind: d.sources?.kind ?? "manual",
        category: f.category,
        label: f.label,
        reason: f.reason ?? "",
        detector: f.detector,
        before: d.content.slice(Math.max(0, f.span_start - CONTEXT), f.span_start),
        match: d.content.slice(f.span_start, f.span_end),
        after: d.content.slice(f.span_end, f.span_end + CONTEXT),
      };
    });
  const quarantined: QuarantinedDoc[] = [...docMap.values()]
    .filter((d) => d.visibility === "staff" && d.visibility_set_by === "auto" && !d.visibility_reviewed && d.status === "active")
    .map((d) => ({
      id: d.id,
      title: d.title,
      url: d.url,
      reason: d.visibility_reason,
      sourceKind: d.sources?.kind ?? "manual",
      count: all.filter((f) => f.document_id === d.id).length,
      categories: [...new Set(all.filter((f) => f.document_id === d.id).map((f) => f.category))],
    }));
  const protectedCount = all.filter((f) => f.status !== "dismissed" && f.status !== "held").length;
  const presetBasis = new Map(PRESET_RULES.map((r) => [r.name, r.basis]));
  const ruleItems: RuleItem[] = (must(rules, "rules") as Array<{ id: string; name: string; description: string; category: string; pattern: string | null; preset: boolean; enabled: boolean }>).map((r) => ({
    ...r,
    basis: presetBasis.get(r.name) ?? null,
    matches: all.filter((f) => (r.preset ? f.category === r.category : false)).length,
  }));
  const names = new Map((people.data ?? []).map((p) => [p.id, p.name]));
  const logItems: LogItem[] = (log.data ?? []).map((l) => ({ id: String(l.id), action: l.action, detail: l.detail as Record<string, unknown>, at: l.at, actor: l.actor_id ? (names.get(l.actor_id) ?? "Staff") : "System" }));
  return <PrivacyView held={held} quarantined={quarantined} rules={ruleItems} log={logItems} protectedCount={protectedCount} />;
}
