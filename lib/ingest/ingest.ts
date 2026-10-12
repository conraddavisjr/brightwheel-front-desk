import "server-only";
import { createHash } from "node:crypto";
import { db, must, ok } from "@/lib/db/client";
import { embedTexts, toPgVector } from "@/lib/ai/provider";
import { chunkMarkdown } from "@/lib/retrieval/chunk";
import { detect, mask, mergeFindings, suggestVisibility } from "@/lib/privacy/detect";
import { classifySensitive } from "@/lib/privacy/classify";
import type { Finding } from "@/lib/schemas";

/**
 * The ingest pipeline. Every source (Notion, Drive, calendar notes, uploads,
 * the Knowledge editor, a gap answer) ends here as normalized Markdown:
 *
 *   upsert document -> detect (patterns + AI) -> keep past review decisions
 *   -> decide visibility -> mask held spans -> chunk -> embed -> replace chunks
 *
 * Fail closed: anything flagged and not yet reviewed is masked in the family
 * index. A director's "This is fine" is what puts it back.
 */

export interface IngestInput {
  schoolId: string;
  sourceId: string | null;
  externalId: string | null;
  title: string;
  content: string;
  emoji?: string | null;
  parentTitle?: string | null;
  url?: string | null;
  mime?: string;
  sourceUpdatedAt?: string | null;
  authoredBy?: string | null;
  /** Force a visibility (e.g. a director writing a family answer). */
  visibility?: "family" | "staff";
}

export interface IngestResult {
  documentId: string;
  changed: boolean;
  visibility: "family" | "staff";
  findings: number;
  newlyHeld: number;
  chunks: number;
}

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

interface SchoolCtx {
  allow: string[];
  rules: Array<{ id: string; name: string; description: string; pattern: string | null; category: string; enabled: boolean }>;
}

export async function schoolPrivacyContext(schoolId: string): Promise<SchoolCtx> {
  const school = must(await db().from("schools").select("phone,email,address").eq("id", schoolId).single(), "school");
  const rules = must(
    await db().from("privacy_rules").select("id,name,description,pattern,category,enabled,preset").eq("school_id", schoolId),
    "rules",
  ) as Array<SchoolCtx["rules"][number] & { preset: boolean }>;
  return {
    allow: [school.phone, school.email, school.address].filter(Boolean) as string[],
    rules: rules.filter((r) => !r.preset),
  };
}

export async function ingestDocument(input: IngestInput, opts: { force?: boolean; ctx?: SchoolCtx } = {}): Promise<IngestResult> {
  const client = db();
  const content = input.content.replace(/\r\n/g, "\n").trim();
  const hash = sha(`${input.title}\n${content}`);

  let existing: { id: string; content_hash: string; visibility: "family" | "staff"; visibility_set_by: string; classified_hash: string | null } | null = null;
  if (input.sourceId && input.externalId) {
    const r = await client
      .from("documents")
      .select("id,content_hash,visibility,visibility_set_by,classified_hash")
      .eq("source_id", input.sourceId)
      .eq("external_id", input.externalId)
      .maybeSingle();
    existing = r.data;
  }
  if (existing && existing.content_hash === hash && !opts.force) {
    const n = await client.from("chunks").select("id", { count: "exact", head: true }).eq("document_id", existing.id);
    return { documentId: existing.id, changed: false, visibility: existing.visibility, findings: 0, newlyHeld: 0, chunks: n.count ?? 0 };
  }

  const ctx = opts.ctx ?? (await schoolPrivacyContext(input.schoolId));

  // 1. Detect.
  const patternFindings = detect(content, ctx);
  // The AI pass runs once per distinct text; a forced re-run (new rule) re-reads it.
  const ai = existing?.classified_hash === hash && !opts.force ? { findings: [], ran: false } : await classifySensitive(input.title, content, ctx.rules);
  const keptAi = existing?.classified_hash === hash && !ai.ran ? await priorAiFindings(existing.id) : [];
  const findings = mergeFindings([...patternFindings, ...ai.findings, ...keptAi]);

  // 2. Visibility: a director's choice sticks; otherwise suggest from title and findings.
  const suggestion = suggestVisibility(input.title, content, findings);
  const visibility: "family" | "staff" =
    input.visibility ?? (existing?.visibility_set_by === "director" ? existing.visibility : suggestion.visibility);

  const row = {
    school_id: input.schoolId,
    source_id: input.sourceId,
    external_id: input.externalId,
    title: input.title,
    emoji: input.emoji ?? null,
    parent_title: input.parentTitle ?? null,
    url: input.url ?? null,
    mime: input.mime ?? "text/markdown",
    content,
    content_hash: hash,
    visibility,
    visibility_reason: input.visibility ? null : existing?.visibility_set_by === "director" ? undefined : suggestion.reason,
    visibility_set_by: input.visibility ? "director" : (existing?.visibility_set_by ?? "auto"),
    classified_hash: ai.ran ? hash : (existing?.classified_hash ?? null),
    source_updated_at: input.sourceUpdatedAt ?? null,
    authored_by: input.authoredBy ?? null,
    status: "active",
    updated_at: new Date().toISOString(),
  };
  const doc = existing
    ? must(await client.from("documents").update(row).eq("id", existing.id).select("id").single(), "update document")
    : must(await client.from("documents").insert(row).select("id").single(), "insert document");
  const documentId: string = doc.id;

  // 3. Findings: keep each past decision (matched by category and text, since offsets move when a doc is edited).
  const prior = must(
    await client.from("findings").select("category,excerpt,status,resolved_by,resolved_at").eq("document_id", documentId),
    "prior findings",
  ) as Array<{ category: string; excerpt: string; status: string; resolved_by: string | null; resolved_at: string | null }>;
  const decided = new Map(prior.filter((p) => p.status !== "held").map((p) => [`${p.category}|${p.excerpt}`, p]));
  await client.from("findings").delete().eq("document_id", documentId);
  let newlyHeld = 0;
  const rows = findings.map((f: Finding) => {
    const past = decided.get(`${f.category}|${f.excerpt}`);
    const wasHeld = prior.some((p) => p.category === f.category && p.excerpt === f.excerpt);
    if (!past && !wasHeld) newlyHeld++;
    return {
      school_id: input.schoolId,
      document_id: documentId,
      rule_id: f.ruleId ?? null,
      category: f.category,
      label: f.label,
      span_start: f.start,
      span_end: f.end,
      excerpt: f.excerpt.slice(0, 2000),
      detector: f.detector,
      confidence: f.confidence,
      reason: f.reason,
      status: past?.status ?? "held",
      resolved_by: past?.resolved_by ?? null,
      resolved_at: past?.resolved_at ?? null,
    };
  });
  if (rows.length) ok(await client.from("findings").upsert(rows, { onConflict: "document_id,span_start,span_end,category", ignoreDuplicates: true }), "insert findings");

  // 4. Family index.
  const chunkCount = await reindexDocument(documentId);
  return { documentId, changed: true, visibility, findings: rows.length, newlyHeld, chunks: chunkCount };
}

/**
 * Rebuild one document's family-visible chunks from its current content,
 * visibility and findings. Called after ingest and after every review
 * decision, so a "Redact" or "This is fine" takes effect immediately.
 */
export async function reindexDocument(documentId: string): Promise<number> {
  const client = db();
  const doc = must(
    await client.from("documents").select("id,school_id,title,content,visibility,status").eq("id", documentId).single(),
    "document",
  );
  await client.from("chunks").delete().eq("document_id", documentId);
  if (doc.visibility !== "family" || doc.status !== "active") return 0;

  const findings = must(
    await client.from("findings").select("span_start,span_end,status").eq("document_id", documentId).neq("status", "dismissed"),
    "findings",
  ) as Array<{ span_start: number; span_end: number }>;
  const safe = mask(doc.content, findings.map((f) => ({ start: f.span_start, end: f.span_end })));
  const chunks = chunkMarkdown(safe, doc.title);
  if (chunks.length === 0) return 0;

  // Embed the heading with the text: the heading path is often the best signal a passage has.
  const { vectors, model } = await embedTexts(chunks.map((c) => `${c.heading}\n${c.text}`), "document", await indexModel(doc.school_id));
  ok(
    await client.from("chunks").insert(
      chunks.map((c, i) => ({
        school_id: doc.school_id,
        document_id: documentId,
        ord: c.ord,
        heading: c.heading,
        text: c.text,
        visibility: "family",
        embedding: toPgVector(vectors[i]),
        embed_model: model,
      })),
    ),
    "insert chunks",
  );
  return chunks.length;
}

/** The embedder a school's index already uses, so new chunks match it (undefined for an empty index). */
export async function indexModel(schoolId: string): Promise<string | undefined> {
  const { data } = await db().from("chunks").select("embed_model").eq("school_id", schoolId).limit(1).maybeSingle();
  return data?.embed_model ?? undefined;
}

async function priorAiFindings(documentId: string): Promise<Finding[]> {
  const rows = must(
    await db().from("findings").select("category,label,span_start,span_end,excerpt,confidence,reason").eq("document_id", documentId).eq("detector", "ai"),
    "prior ai findings",
  ) as Array<{ category: Finding["category"]; label: string; span_start: number; span_end: number; excerpt: string; confidence: number; reason: string | null }>;
  return rows.map((r) => ({ category: r.category, label: r.label, start: r.span_start, end: r.span_end, excerpt: r.excerpt, detector: "ai", confidence: r.confidence, reason: r.reason ?? "", ruleId: null }));
}
