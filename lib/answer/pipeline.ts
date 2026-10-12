import { plain, possessive } from "@/lib/text";
import "server-only";
import { db, must } from "@/lib/db/client";
import { config } from "@/lib/config";
import { hit } from "@/lib/guard/rateLimit";
import { normalizeQuestion, route, topicOf } from "@/lib/guard/router";
import { searchKnowledge, type Retrieval } from "@/lib/retrieval/search";
import { generateAnswer } from "@/lib/answer/generate";
import { openerFor, utteranceKind, looksSpanish } from "@/lib/answer/fillers";
import { routeCard, type SchoolContact } from "@/lib/answer/routeReplies";
import { hoursFacts, openNow, type WeeklyHours } from "@/lib/answer/hours";
import { detect } from "@/lib/privacy/detect";
import { notifyGap } from "@/lib/integrations/slack";
import type { AnswerCard, AskEvent, ModelAnswer } from "@/lib/schemas";

/**
 * One question, end to end. Yields stream events as it goes so the parent
 * sees an acknowledgement in under a second and the card filling in.
 *
 *   rate limit -> guard route -> (care | handoff | decline) or
 *   hybrid search -> confidence gate -> generate -> validate -> persist
 *
 * Trust rules enforced here, in code:
 * - Only cited passages and retrieved events reach the card.
 * - An answer the model marks ungrounded, or that cites nothing real, becomes
 *   an honest "I don't know" plus a logged gap for the director.
 * - Every outgoing text is scanned by Privacy Guard before it streams.
 */

export interface AskInput {
  question: string;
  conversationId?: string | null;
  channel: "text" | "voice" | "guided";
  schoolId: string;
  parentId: string | null;
  ip: string;
  /** Evals pass false to keep test traffic out of the dashboard. */
  persist?: boolean;
}

interface School extends SchoolContact {
  id: string;
  timezone: string;
  hours: WeeklyHours;
  address: string | null;
}

async function loadSchool(id: string): Promise<School> {
  const s = must(await db().from("schools").select("id,name,short_name,phone,email,address,timezone,hours").eq("id", id).single(), "school");
  return { id: s.id, name: s.name, shortName: s.short_name, phone: s.phone, email: s.email, address: s.address, timezone: s.timezone, hours: s.hours ?? {} };
}

const emptyCard = (): AnswerCard => ({
  outcome: "answered",
  kind: "answer",
  headline: "",
  body: "",
  facts: [],
  steps: [],
  events: [],
  citations: [],
  followUps: [],
  handoff: null,
  openNow: null,
});

export async function* runAsk(input: AskInput): AsyncGenerator<AskEvent> {
  const t0 = Date.now();
  const question = input.question.replace(/\s+/g, " ").trim().slice(0, config.limits.questionMaxChars);
  const persist = input.persist !== false;

  // Rate limits: per parent (or IP) per 10 minutes, and per IP per day.
  const who = input.parentId ?? `ip:${input.ip}`;
  const [burst, daily] = await Promise.all([
    hit(`ask:${who}`, config.limits.askPer10Min, 600),
    hit(`ask-day:${input.ip}`, config.limits.askPerDayPerIp, 86400),
  ]);
  if (!burst.ok || !daily.ok) {
    yield { type: "error", message: "You're asking faster than I can keep up. Give it a minute and try again.", retryable: true };
    return;
  }

  const school = await loadSchool(input.schoolId);
  const conversationId = persist ? await ensureConversation(input) : "eval";
  yield { type: "start", conversationId };
  if (persist) await saveMessage(conversationId, input.schoolId, { role: "parent", text: question, author_id: input.parentId });

  const kind = utteranceKind(question);
  const opener = openerFor(question);
  if (opener) yield { type: "ack", text: opener };

  const topic = topicOf(question);
  const finish = async function* (card: AnswerCard, reason: string | null): AsyncGenerator<AskEvent> {
    const safe = scrubCard(card, school);
    const latencyMs = Date.now() - t0;
    const messageId = persist
      ? await saveMessage(conversationId, input.schoolId, {
          role: "assistant",
          text: [safe.headline, safe.body].filter(Boolean).join(" "),
          card: safe,
          outcome: safe.outcome,
          reason,
          topic,
          citations: safe.citations.map((c) => ({ documentId: c.documentId, title: c.title, heading: c.heading })),
          latency_ms: latencyMs,
        })
      : "eval";
    yield { type: "done", messageId, card: safe, topic, latencyMs };
  };

  // Small talk gets a small answer.
  if (kind === "thanks" || kind === "hello") {
    const card = emptyCard();
    card.headline = kind === "thanks" ? "You're welcome! Anything else?" : `Hi! I'm the ${school.shortName} front desk assistant.`;
    card.body = kind === "hello" ? "Ask me about hours, tuition, health policies, meals, tours or what's coming up." : "";
    card.followUps = ["What are your hours?", "Is my child too sick to come in?", "What's coming up this month?"];
    yield* finish(card, "small_talk");
    return;
  }

  const r = route(question);
  if (r.action !== "answer") {
    yield { type: "status", phase: "checking", label: "Checking how best to help…" };
    yield* finish(routeCard(r, school), `${r.action}:${r.kind}`);
    return;
  }

  yield { type: "status", phase: "searching", label: looksSpanish(question) ? "Buscando en el manual…" : `Checking ${possessive(school.shortName)} handbook…` };
  let retrieval: Retrieval;
  try {
    retrieval = await searchKnowledge(input.schoolId, question);
  } catch (err) {
    console.error("[ask] search failed", err);
    yield { type: "error", message: "I couldn't reach the school's information just now. Please try again in a moment.", retryable: true };
    return;
  }

  // Hours are answered from structured data, with the handbook as backup context.
  const isHours =
    Object.keys(school.hours).length > 0 &&
    !/\bper hour\b|\ban hour\b|\bhourly\b/i.test(question) &&
    /\b(open|opens|close|closes|closing|opening|what are your hours|hours of operation|business hours|what time do you|abren|cierran|horario)\b/i.test(question) &&
    !/\b(holiday|thanksgiving|christmas|break|closed (on|for)|closure)\b/i.test(question);

  if (retrieval.strength === "none" && !isHours) {
    yield* finish(await unsure(question, topic, input, school, null, persist), "no_match");
    return;
  }

  yield { type: "status", phase: "reading", label: "Reading the details…" };
  const gen = await generateAnswer({
    question,
    schoolName: school.name,
    timezone: school.timezone,
    topic,
    retrieval,
    medicalCaveat: r.medicalCaveat,
  });
  yield { type: "status", phase: "writing", label: "Putting it together…" };

  let lastSent = 0;
  try {
    for await (const partial of gen.partials) {
      const now = Date.now();
      if (now - lastSent < 60) continue;
      lastSent = now;
      // Never stream text Privacy Guard would stop.
      if (!isClean(`${partial.headline ?? ""} ${partial.body ?? ""}`, school)) continue;
      yield {
        type: "partial",
        card: { kind: partial.kind, headline: partial.headline ?? "", body: partial.body ?? "", facts: (partial.facts ?? []).filter((f) => f?.label && f?.value) as AnswerCard["facts"], steps: (partial.steps ?? []).filter((s) => s?.title) as AnswerCard["steps"] },
      };
    }
  } catch (err) {
    console.error("[ask] stream interrupted", err);
  }

  let answer: ModelAnswer;
  try {
    answer = await gen.final;
  } catch (err) {
    console.error("[ask] generation failed", err);
    yield* finish(await unsure(question, topic, input, school, retrieval, persist), "generation_failed");
    return;
  }

  const card = buildCard(answer, retrieval, school, r.medicalCaveat, isHours);
  if (!card) {
    yield* finish(await unsure(question, topic, input, school, retrieval, persist), answer.grounded ? "no_valid_citation" : "ungrounded");
    return;
  }
  if (retrieval.conflict && persist) {
    await recordGap(input.schoolId, question, `conflict ${[retrieval.conflict.a.documentId, retrieval.conflict.b.documentId].sort().join(" ")}`, topic, input.parentId, retrieval.conflict.note);
  }
  yield* finish(card, gen.live ? "live" : "extractive");
}

/** Turn the model's answer into the parent's card, keeping only what we can stand behind. */
export function buildCard(a: ModelAnswer, r: Retrieval, school: School, medicalCaveat: boolean, isHours: boolean): AnswerCard | null {
  const byId = new Map(r.passages.map((p) => [p.id, p]));
  const stale = r.conflict?.outdatedDocumentId ?? null;
  const cited = [...new Set(a.citations)]
    .map((id) => byId.get(id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p) && p!.documentId !== stale);
  const evById = new Map(r.events.map((e) => [e.id, e]));
  const events = [...new Set(a.eventIds)].map((id) => evById.get(id)).filter((e): e is NonNullable<typeof e> => Boolean(e));

  if (!isHours && (!a.grounded || (cited.length === 0 && events.length === 0))) return null;

  const card: AnswerCard = {
    outcome: "answered",
    kind: events.length && !isHours ? "event" : a.kind,
    headline: a.headline.trim(),
    body: a.body.trim(),
    facts: a.facts.filter((f) => f.label && f.value).slice(0, 10),
    steps: a.steps.filter((s) => s.title).slice(0, 8),
    events: events.map((e) => ({ id: e.eventId, title: e.title, startsAt: e.startsAt, endsAt: e.endsAt, allDay: e.allDay, location: e.location, description: e.description, timezone: school.timezone })),
    citations: cited.map((p) => ({
      id: p.id,
      documentId: p.documentId,
      title: p.title,
      heading: p.heading.split(" > ").slice(1).join(" › ") || p.title,
      excerpt: plain(p.text).slice(0, 280),
      url: p.url,
      sourceKind: p.sourceKind,
      updatedAt: p.updatedAt,
    })),
    followUps: a.followUps.filter(Boolean).slice(0, 3),
    handoff: null,
    openNow: null,
  };

  if (isHours || card.kind === "hours") {
    // Opening hours come from the school's structured settings, which the director owns, not from prose.
    card.kind = "hours";
    card.openNow = openNow(school.hours, school.timezone);
    card.facts = hoursFacts(school.hours);
    const weekday = card.facts[0];
    if (!a.headline || !/\d/.test(a.headline)) card.headline = weekday ? `We're open ${weekday.label}, ${weekday.value}.` : card.openNow.label;
    card.steps = [];
  }
  if (r.conflict) {
    card.body = `${card.body} Heads up: two of the school's documents disagree on this, so we've asked the director to confirm.`.trim();
  }
  if (medicalCaveat) {
    card.body = `${card.body} For medical advice, please check with your pediatrician.`.trim();
  }
  return card;
}

async function unsure(question: string, topic: string, input: AskInput, school: School, r: Retrieval | null, persist: boolean): Promise<AnswerCard> {
  let logged = false;
  if (persist) {
    await recordGap(input.schoolId, question, normalizeQuestion(question), topic, input.parentId, null);
    logged = true;
  }
  const related = r?.passages[0];
  return {
    ...emptyCard(),
    outcome: "unsure",
    kind: "contact",
    headline: `I don't have that in ${possessive(school.shortName)} information yet.`,
    body: "I've passed your question to the front desk so they can answer it and add it for other families. You'll get a reply in the brightwheel app.",
    followUps: related ? [`Tell me about ${related.heading.split(" > ").pop()?.replace(/^\d+[.)]\s*/, "").toLowerCase()}`] : ["What are your hours?", "What's coming up this month?"],
    handoff: { reason: "Not in the school's information", phone: school.phone, email: school.email, gapLogged: logged },
  };
}

async function recordGap(schoolId: string, question: string, normalized: string, topic: string, askerId: string | null, note: string | null) {
  try {
    const { data: id } = await db().rpc("record_gap", {
      p_school: schoolId,
      p_question: question,
      p_normalized: normalized || question.toLowerCase(),
      p_topic: topic,
      p_asker: askerId,
      p_kind: note ? "conflict" : "question",
      p_note: note,
    });
    if (id) notifyGap(String(id)).catch((err) => console.error("[slack] gap notify failed", err));
  } catch (err) {
    console.error("[gaps] record failed", err);
  }
}

function isClean(text: string, school: School): boolean {
  if (!text.trim()) return true;
  return detect(text, { allow: [school.phone, school.email, school.address].filter(Boolean) as string[] }).filter((f) => f.confidence >= 0.8).length === 0;
}

/** Last line of defense: drop any line Privacy Guard objects to. */
function scrubCard(card: AnswerCard, school: School): AnswerCard {
  if (card.outcome !== "answered") return card;
  const ok = (t: string) => isClean(t, school);
  return {
    ...card,
    headline: ok(card.headline) ? card.headline : "I can't share part of that, but the front desk can help.",
    body: ok(card.body) ? card.body : "",
    facts: card.facts.filter((f) => ok(`${f.label} ${f.value}`)),
    steps: card.steps.filter((s) => ok(`${s.title} ${s.detail}`)),
  };
}

async function ensureConversation(input: AskInput): Promise<string> {
  const client = db();
  if (input.conversationId) {
    const { data } = await client.from("conversations").select("id,school_id,parent_id").eq("id", input.conversationId).maybeSingle();
    if (data && data.school_id === input.schoolId && data.parent_id === input.parentId) {
      await client.from("conversations").update({ last_at: new Date().toISOString() }).eq("id", data.id);
      return data.id;
    }
  }
  const row = must(
    await client.from("conversations").insert({ school_id: input.schoolId, parent_id: input.parentId, channel: input.channel }).select("id").single(),
    "conversation",
  );
  return row.id;
}

async function saveMessage(conversationId: string, schoolId: string, m: Record<string, unknown>): Promise<string> {
  const row = must(await db().from("messages").insert({ conversation_id: conversationId, school_id: schoolId, ...m }).select("id").single(), "message");
  return row.id;
}
