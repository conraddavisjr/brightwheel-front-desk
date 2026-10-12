import "server-only";
import { db, must } from "@/lib/db/client";
import { reindexDocument } from "@/lib/ingest/ingest";
import { detect } from "@/lib/privacy/detect";

export type ReviewAction = "redact" | "staff_only" | "dismiss";
const STATUS: Record<ReviewAction, string> = { redact: "redacted", staff_only: "staff_only", dismiss: "dismissed" };

/**
 * Apply a director's decision to findings and re-index the affected
 * documents at once, so the family index always matches the decision.
 * "Redact" and "Keep staff-only" both keep the text out of family answers
 * (redacted is a permanent decision, staff-only means "fine for staff");
 * "This is fine" puts the text back.
 */
export async function reviewFindings(schoolId: string, personId: string, ids: string[], action: ReviewAction): Promise<number> {
  const rows = must(await db().from("findings").select("id,document_id,school_id").in("id", ids), "findings") as Array<{ id: string; document_id: string; school_id: string }>;
  const mine = rows.filter((r) => r.school_id === schoolId);
  if (mine.length === 0) return 0;
  await db()
    .from("findings")
    .update({ status: STATUS[action], resolved_by: personId, resolved_at: new Date().toISOString() })
    .in("id", mine.map((r) => r.id));
  for (const docId of new Set(mine.map((r) => r.document_id))) await reindexDocument(docId);
  return mine.length;
}

/** Run one new rule over every active document of the school. Returns how many new items were held. */
export async function applyRule(schoolId: string, rule: { id: string; name: string; description: string; pattern: string | null; category: string }): Promise<number> {
  const docs = must(await db().from("documents").select("id,content,visibility").eq("school_id", schoolId).eq("status", "active"), "documents") as Array<{ id: string; content: string; visibility: string }>;
  let held = 0;
  for (const d of docs) {
    const found = detect(d.content, { rules: [{ ...rule, enabled: true }] }).filter((f) => f.ruleId === rule.id);
    if (found.length === 0) continue;
    const rows = found.map((f) => ({
      school_id: schoolId,
      document_id: d.id,
      rule_id: rule.id,
      category: f.category,
      label: f.label,
      span_start: f.start,
      span_end: f.end,
      excerpt: f.excerpt,
      detector: "pattern",
      confidence: f.confidence,
      reason: f.reason,
      status: d.visibility === "family" ? "held" : "staff_only",
    }));
    const { data } = await db().from("findings").upsert(rows, { onConflict: "document_id,span_start,span_end,category", ignoreDuplicates: true }).select("id");
    if (d.visibility === "family") {
      held += data?.length ?? 0;
      await reindexDocument(d.id);
    }
  }
  return held;
}
