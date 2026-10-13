import "server-only";
import { db, must } from "@/lib/db/client";
import { normalizeQuestion } from "@/lib/guard/router";

/**
 * Read models for the operator dashboard. Volumes per school are small
 * (hundreds of messages a month), so we aggregate in code from one scoped
 * query each; at brightwheel scale these become materialized rollups.
 */

export interface MsgRow {
  id: string;
  conversation_id: string;
  role: "parent" | "assistant" | "staff";
  text: string;
  outcome: string | null;
  reason: string | null;
  topic: string | null;
  feedback: number | null;
  citations: Array<{ documentId: string; title: string; heading: string }>;
  latency_ms: number | null;
  created_at: string;
  author_id: string | null;
}

/** Minutes a front desk spends on one repeat question (call or message, look-up, reply). Conservative. */
export const MINUTES_PER_QUESTION = 4;

export async function recentMessages(schoolId: string, days = 30): Promise<MsgRow[]> {
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const rows: MsgRow[] = [];
  for (let from = 0; ; from += 1000) {
    const page = must(
      await db()
        .from("messages")
        .select("id,conversation_id,role,text,outcome,reason,topic,feedback,citations,latency_ms,created_at,author_id")
        .eq("school_id", schoolId)
        .gte("created_at", since)
        .order("created_at", { ascending: true })
        .range(from, from + 999),
      "messages",
    ) as MsgRow[];
    rows.push(...page);
    if (page.length < 1000) break;
  }
  return rows;
}

export interface Stats {
  questions: number;
  answered: number;
  unsure: number;
  handedOff: number;
  declined: number;
  deflection: number;
  hoursSaved: number;
  helpfulRate: number | null;
  ratings: number;
  medianLatencyMs: number | null;
  series: Array<{ day: string; answered: number; other: number }>;
  topQuestions: Array<{ question: string; count: number; topic: string; outcome: string }>;
  topSources: Array<{ documentId: string; title: string; count: number }>;
  topics: Array<{ topic: string; count: number }>;
  trend: number | null;
}

export function computeStats(msgs: MsgRow[], days = 30, tz = "America/Los_Angeles"): Stats {
  const answers = msgs.filter((m) => m.role === "assistant" && m.outcome);
  const by = (o: string) => answers.filter((m) => m.outcome === o).length;
  const answered = by("answered");
  const rated = answers.filter((m) => m.feedback !== null);
  const up = rated.filter((m) => m.feedback === 1).length;
  const lat = answers.map((m) => m.latency_ms).filter((x): x is number => typeof x === "number").sort((a, b) => a - b);

  const dayKey = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date(iso));
  const series = new Map<string, { answered: number; other: number }>();
  for (let i = days - 1; i >= 0; i--) series.set(dayKey(new Date(Date.now() - i * 86400000).toISOString()), { answered: 0, other: 0 });
  for (const m of answers) {
    const s = series.get(dayKey(m.created_at));
    if (!s) continue;
    if (m.outcome === "answered") s.answered++;
    else s.other++;
  }

  // Top questions: cluster each assistant answer with the parent question before it.
  const byConv = new Map<string, MsgRow[]>();
  for (const m of msgs) byConv.set(m.conversation_id, [...(byConv.get(m.conversation_id) ?? []), m]);
  const clusters = new Map<string, { question: string; count: number; topic: string; outcome: string }>();
  for (const list of byConv.values()) {
    for (let i = 1; i < list.length; i++) {
      const a = list[i];
      const q = list[i - 1];
      if (a.role !== "assistant" || q.role !== "parent" || !a.outcome) continue;
      const key = normalizeQuestion(q.text);
      const c = clusters.get(key) ?? { question: q.text, count: 0, topic: a.topic ?? "other", outcome: a.outcome };
      c.count++;
      clusters.set(key, c);
    }
  }

  const sources = new Map<string, { documentId: string; title: string; count: number }>();
  for (const m of answers) for (const c of m.citations ?? []) {
    const s = sources.get(c.documentId) ?? { documentId: c.documentId, title: c.title, count: 0 };
    s.count++;
    sources.set(c.documentId, s);
  }
  const topics = new Map<string, number>();
  for (const m of answers) if (m.topic && m.outcome !== "declined") topics.set(m.topic, (topics.get(m.topic) ?? 0) + 1);

  const half = Date.now() - (days / 2) * 86400000;
  const recent = answers.filter((m) => new Date(m.created_at).getTime() >= half).length;
  const earlier = answers.length - recent;

  return {
    questions: answers.length,
    answered,
    unsure: by("unsure"),
    handedOff: by("handoff") + by("care"),
    declined: by("declined"),
    deflection: answers.length ? answered / answers.length : 0,
    hoursSaved: Math.round((answered * MINUTES_PER_QUESTION) / 6) / 10,
    helpfulRate: rated.length ? up / rated.length : null,
    ratings: rated.length,
    medianLatencyMs: lat.length ? lat[Math.floor(lat.length / 2)] : null,
    series: [...series.entries()].map(([day, v]) => ({ day, ...v })),
    topQuestions: [...clusters.values()].sort((a, b) => b.count - a.count).slice(0, 6),
    topSources: [...sources.values()].sort((a, b) => b.count - a.count).slice(0, 5),
    topics: [...topics.entries()].map(([topic, count]) => ({ topic, count })).sort((a, b) => b.count - a.count),
    trend: earlier ? (recent - earlier) / earlier : null,
  };
}

export async function openGaps(schoolId: string) {
  return must(
    await db()
      .from("gaps")
      .select("id,question,topic,kind,note,status,ask_count,asker_ids,first_asked_at,last_asked_at,answer,answered_at,notified_at,answer_link")
      .eq("school_id", schoolId)
      .order("status", { ascending: false })
      .order("last_asked_at", { ascending: false })
      .limit(100),
    "gaps",
  ) as Array<{
    id: string;
    question: string;
    topic: string;
    kind: "question" | "conflict";
    note: string | null;
    status: "open" | "answered" | "dismissed";
    ask_count: number;
    asker_ids: string[];
    first_asked_at: string;
    last_asked_at: string;
    answer: string | null;
    answered_at: string | null;
    notified_at: string | null;
    answer_link: string | null;
  }>;
}

/**
 * What needs a director, by section. `privacy` matches Privacy Guard's "Waiting for you":
 * held details in active documents, plus documents it moved to staff-only that nobody confirmed yet.
 */
export async function navCounts(schoolId: string) {
  const [gaps, conflicts, held, docs, waiting] = await Promise.all([
    db().from("gaps").select("id", { count: "exact", head: true }).eq("school_id", schoolId).eq("status", "open").eq("kind", "question"),
    db().from("gaps").select("id", { count: "exact", head: true }).eq("school_id", schoolId).eq("status", "open").eq("kind", "conflict"),
    db().from("findings").select("document_id").eq("school_id", schoolId).eq("status", "held"),
    db().from("documents").select("id,status,visibility,visibility_set_by,visibility_reviewed").eq("school_id", schoolId),
    db().from("messages").select("id", { count: "exact", head: true }).eq("school_id", schoolId).eq("reason", "to_staff"),
  ]);
  const docRows = (docs.data ?? []) as Array<{ id: string; status: string; visibility: string; visibility_set_by: string; visibility_reviewed: boolean }>;
  const active = new Set(docRows.filter((d) => d.status === "active").map((d) => d.id));
  const heldInActive = ((held.data ?? []) as Array<{ document_id: string }>).filter((f) => active.has(f.document_id)).length;
  const toConfirm = docRows.filter((d) => d.status === "active" && d.visibility === "staff" && d.visibility_set_by === "auto" && !d.visibility_reviewed).length;
  const questions = gaps.count ?? 0;
  const disagreements = conflicts.count ?? 0;
  return { gaps: questions + disagreements, questions, conflicts: disagreements, privacy: heldInActive + toConfirm, waiting: waiting.count ?? 0 };
}

export async function peopleById(schoolId: string) {
  const rows = must(await db().from("people").select("id,name,role,avatar_hue,children,email").eq("school_id", schoolId), "people") as Array<{
    id: string;
    name: string;
    role: string;
    avatar_hue: number;
    children: Array<{ name: string; room: string }>;
    email: string | null;
  }>;
  return new Map(rows.map((r) => [r.id, r]));
}

export { normalizeQuestion };
