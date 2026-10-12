import "server-only";
import { db, must } from "@/lib/db/client";
import { embedTexts, toPgVector } from "@/lib/ai/provider";
import { indexModel } from "@/lib/ingest/ingest";
import { stubTokens } from "@/lib/ai/stubEmbed";

/**
 * Hybrid retrieval over one school's family-visible knowledge.
 *
 * Dense (meaning) and sparse (words) each rank the top 20 passages; the
 * search_chunks SQL function fuses the two lists with reciprocal rank
 * fusion, which needs no score calibration between the two kinds. Then we
 * decide how much to trust the result before any model sees it.
 */

export interface Passage {
  id: string; // S1, S2... as shown to the model
  chunkId: string;
  documentId: string;
  title: string;
  heading: string;
  text: string;
  url: string | null;
  sourceKind: string;
  updatedAt: string | null;
  rrf: number;
  vecRank: number | null;
  ftsRank: number | null;
  distance: number | null;
  lexical: number | null;
}

export interface EventHit {
  id: string; // E1, E2...
  eventId: string;
  title: string;
  startsAt: string;
  endsAt: string | null;
  allDay: boolean;
  location: string | null;
  description: string | null;
}

export type Strength = "strong" | "weak" | "none";

export interface Retrieval {
  passages: Passage[];
  events: EventHit[];
  strength: Strength;
  conflict: { a: Passage; b: Passage; note: string } | null;
  embedModel: string | null;
}

/** Cosine distance under which a passage is "about the same thing", per embedder. */
const NEAR: Record<string, number> = { stub: 0.62, default: 0.42 };

const EVENTISH = /\b(when|what day|date|event|events|calendar|upcoming|next|this week|this month|closed|closure|holiday|break|festival|picnic|party|trip|picture day|photo day|conference|potluck|concert|graduation|day off|days off|in-service)\b/i;

export async function searchKnowledge(schoolId: string, question: string, limit = 6): Promise<Retrieval> {
  const client = db();
  const model = await indexModel(schoolId);
  let embedding: number[] | null = null;
  let embedModel: string | null = null;
  if (model) {
    try {
      const e = await embedTexts([question], "query", model);
      embedding = e.vectors[0];
      embedModel = e.model;
    } catch (err) {
      // The live embedder is unavailable (cap or outage): words-only search still works.
      console.warn("[search] query embedding unavailable, using full-text only", err);
    }
  }

  const rows = must(
    await client.rpc("search_chunks", {
      p_school: schoolId,
      p_query: question,
      p_embedding: embedding ? toPgVector(embedding) : null,
      p_embed_model: embedModel ?? "stub",
      p_limit: limit,
    }),
    "search_chunks",
  ) as Array<{ chunk_id: string; document_id: string; heading: string; text: string; rrf: number; vec_rank: number | null; fts_rank: number | null; distance: number | null; lexical: number | null }>;

  const docIds = [...new Set(rows.map((r) => r.document_id))];
  const docs = docIds.length
    ? (must(
        await client.from("documents").select("id,title,url,source_updated_at,updated_at,sources(kind)").in("id", docIds),
        "documents",
      ) as unknown as Array<{ id: string; title: string; url: string | null; source_updated_at: string | null; updated_at: string; sources: { kind: string } | null }>)
    : [];
  const byId = new Map(docs.map((d) => [d.id, d]));

  const passages: Passage[] = rows.map((r, i) => {
    const d = byId.get(r.document_id);
    return {
      id: `S${i + 1}`,
      chunkId: r.chunk_id,
      documentId: r.document_id,
      title: d?.title ?? "Untitled",
      heading: r.heading,
      text: r.text,
      url: d?.url ?? null,
      sourceKind: d?.sources?.kind ?? "manual",
      updatedAt: d?.source_updated_at ?? d?.updated_at ?? null,
      rrf: r.rrf,
      vecRank: r.vec_rank,
      ftsRank: r.fts_rank,
      distance: r.distance,
      lexical: r.lexical,
    };
  });

  const events = EVENTISH.test(question) ? await searchEvents(schoolId, question) : [];
  const near = NEAR[embedModel ?? "stub"] ?? NEAR.default;
  return { passages, events, strength: judgeStrength(passages, events, near), conflict: findConflict(passages), embedModel };
}

/**
 * How much the retrieval deserves trust, before any model is involved.
 * strong: the top passage matched on both words and meaning (or very close in meaning).
 * weak:   something matched one way only. The model must confirm it answers.
 * none:   nothing related. We say so instead of guessing.
 */
export function judgeStrength(passages: Passage[], events: EventHit[], near: number): Strength {
  if (events.length > 0) return "strong";
  const top = passages[0];
  if (!top) return "none";
  const closeMeaning = top.distance !== null && top.distance <= near;
  const bothLists = top.vecRank !== null && top.ftsRank !== null;
  if ((bothLists && closeMeaning) || (top.distance !== null && top.distance <= near * 0.7)) return "strong";
  if (closeMeaning || (top.lexical ?? 0) > 0.05 || bothLists) return "weak";
  return "none";
}

const MEASURE = /(\d{2,3}(?:\.\d)?)\s?(?:°|degrees?|º)?\s?F\b|\$\s?(\d[\d,]*(?:\.\d\d)?)|(\d+(?:\.\d+)?)\s?%|(\d+)\s?(?:hours?|hrs?)\b/gi;

function measures(text: string): Set<string> {
  const out = new Set<string>();
  for (const m of text.matchAll(MEASURE)) out.add((m[1] ? `${m[1]}F` : m[2] ? `$${m[2]}` : m[3] ? `${m[3]}%` : `${m[4]}h`).replace(/,/g, ""));
  return out;
}

/**
 * Two strong passages from different documents about the same topic that
 * state different numbers (fever 101F vs 100.4F) are a conflict. We do not
 * pick a winner silently: the parent gets the newer one with a caveat and
 * the director gets an Inbox item to fix the source.
 */
export function findConflict(passages: Passage[]): Retrieval["conflict"] {
  const top = passages.slice(0, 8);
  for (let i = 0; i < top.length; i++) {
    for (let j = i + 1; j < top.length; j++) {
      const a = top[i];
      const b = top[j];
      if (a.documentId === b.documentId) continue;
      const ta = new Set(stubTokens(`${a.heading} ${a.text}`).filter((t) => t.startsWith("#")));
      const shared = stubTokens(`${b.heading} ${b.text}`).some((t) => t.startsWith("#") && ta.has(t));
      if (!shared) continue;
      const ma = measures(a.text);
      const mb = measures(b.text);
      const kinds = (s: Set<string>, k: string) => [...s].filter((x) => x.endsWith(k) || x.startsWith(k));
      for (const k of ["F", "$", "%", "h"]) {
        const xa = kinds(ma, k);
        const xb = kinds(mb, k);
        if (xa.length && xb.length && !xa.some((x) => xb.includes(x)) && k === "F") {
          return { a, b, note: `"${a.title}" says ${xa.join(", ")} but "${b.title}" says ${xb.join(", ")}.` };
        }
      }
      if (/\b(old|outdated|archive|2024|2023|previous|superseded)\b/i.test(`${a.title} ${b.title}`)) {
        return { a, b, note: `"${a.title}" and "${b.title}" both cover this, and one looks outdated.` };
      }
    }
  }
  return null;
}

export async function searchEvents(schoolId: string, question: string): Promise<EventHit[]> {
  const client = db();
  const from = new Date(Date.now() - 12 * 3600 * 1000).toISOString();
  let rows = must(await client.rpc("search_events", { p_school: schoolId, p_query: question, p_from: from, p_limit: 4 }), "search_events") as Array<{
    id: string; title: string; starts_at: string; ends_at: string | null; all_day: boolean; location: string | null; description: string | null;
  }>;
  if (rows.length === 0 && /\b(upcoming|next|coming up|this week|this month|calendar|events)\b/i.test(question)) {
    rows = must(
      await client.from("events").select("id,title,starts_at,ends_at,all_day,location,description").eq("school_id", schoolId).eq("visibility", "family").gte("starts_at", from).order("starts_at").limit(4),
      "upcoming events",
    );
  }
  return rows.map((e, i) => ({
    id: `E${i + 1}`,
    eventId: e.id,
    title: e.title,
    startsAt: e.starts_at,
    endsAt: e.ends_at,
    allDay: e.all_day,
    location: e.location,
    description: e.description,
  }));
}
