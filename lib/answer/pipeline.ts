import { plain, possessive } from "@/lib/text";
import "server-only";
import { db, must } from "@/lib/db/client";
import { config } from "@/lib/config";
import { hit } from "@/lib/guard/rateLimit";
import { normalizeQuestion, route, topicOf } from "@/lib/guard/router";
import { searchKnowledge, type Retrieval } from "@/lib/retrieval/search";
import { extractiveAnswer, generateAnswer } from "@/lib/answer/generate";
import { answerableFollowUps } from "@/lib/answer/followUps";
import { openerFor, utteranceKind, looksSpanish } from "@/lib/answer/fillers";
import { routeCard, type SchoolContact } from "@/lib/answer/routeReplies";
import { asksForHours, dayAsked, hoursFacts, hoursHeadline, openNow, type WeeklyHours } from "@/lib/answer/hours";
import { closureOn } from "@/lib/answer/closures";
import { detect, mask } from "@/lib/privacy/detect";
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

  // Life safety comes before everything else, rate limits and the database included: the 911 reply
  // must show even when a limit is hit or the database is down. Saving it is best effort, afterwards.
  const r = route(question);
  if (r.action === "care") {
    const school = await loadSchool(input.schoolId).catch(() => null);
    const card = routeCard(r, school ?? { name: "the school", shortName: "the school", phone: null, email: null });
    let conversationId = "care";
    let messageId = "care";
    if (persist) {
      try {
        conversationId = await ensureConversation(input);
        await saveMessage(conversationId, input.schoolId, { role: "parent", text: question, author_id: input.parentId });
        messageId = await saveMessage(conversationId, input.schoolId, { role: "assistant", text: `${card.headline} ${card.body}`, card, outcome: card.outcome, reason: `care:${r.kind}`, topic: "safety", citations: [], latency_ms: Date.now() - t0 });
      } catch (err) {
        console.error("[ask] could not save a care reply", err);
      }
    }
    yield { type: "start", conversationId };
    yield { type: "done", messageId, card, topic: "safety", latencyMs: Date.now() - t0 };
    return;
  }

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

  // Small talk and fillers only for ordinary questions: a refusal or handoff never starts with "Great question".
  const kind = r.action === "answer" ? utteranceKind(question) : null;
  const opener = r.action === "answer" ? openerFor(question) : null;
  if (opener) yield { type: "ack", text: opener };

  const topic = topicOf(question);
  const finish = async function* (card: AnswerCard, reason: string | null): AsyncGenerator<AskEvent> {
    const safe = scrubCard({ ...card, followUps: await answerableFollowUps(school, card.followUps, { exclude: question }) }, school);
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

  if (r.action !== "answer") {
    yield { type: "status", phase: "checking", label: "Checking how best to help…" };
    yield* finish(routeCard(r, school), `${r.action}:${r.kind}`);
    return;
  }

  // A follow-up ("And for three days?") is read with the question before it, for search and the model.
  const earlier = persist && looksLikeFollowUp(question) ? await previousQuestion(conversationId, question) : null;
  const asked = earlier ? `${earlier} ${question}` : question;

  // Opening hours are structured data the director owns: answered in code, instantly, with no search and no model.
  if (Object.keys(school.hours).length > 0 && asksForHours(asked)) {
    // Lead with what was asked ("We close at 5:30pm today"); the weekly table follows.
    const target = dayAsked(question, new Date(), school.timezone);
    const closure = target ? await closureOn(input.schoolId, school.timezone, target.offset) : null;
    const card: AnswerCard = {
      ...emptyCard(),
      kind: "hours",
      headline: hoursHeadline(question, school.hours, school.timezone, new Date(), closure),
      facts: hoursFacts(school.hours),
      openNow: openNow(school.hours, school.timezone, new Date(), target?.offset === 0 ? closure : null),
      followUps: ["When are you closed next?", "What is the late pickup fee?", "How do I book a tour?"],
    };
    yield* finish(card, "structured_hours");
    return;
  }

  yield { type: "status", phase: "searching", label: looksSpanish(question) ? "Buscando en el manual…" : `Checking ${possessive(school.shortName)} handbook…` };
  let retrieval: Retrieval;
  try {
    retrieval = await searchKnowledge(input.schoolId, asked);
  } catch (err) {
    console.error("[ask] search failed", err);
    yield { type: "error", message: "I couldn't reach the school's information just now. Please try again in a moment.", retryable: true };
    return;
  }

  if (retrieval.strength === "none") {
    yield* finish(await unsure(question, topic, input, school, null, persist), "no_match");
    return;
  }

  yield { type: "status", phase: "reading", label: "Reading the details…" };
  const genInput = { question, earlier, schoolName: school.name, timezone: school.timezone, topic, retrieval, medicalCaveat: r.medicalCaveat };
  const gen = await generateAnswer(genInput);
  yield { type: "status", phase: "writing", label: "Putting it together…" };

  let lastSent = 0;
  // Stream only when retrieval is strong: on a weak match the answer is more likely to be rejected by
  // validation, so the parent waits for the checked card instead of reading a draft that disappears.
  const streamDrafts = retrieval.strength === "strong";
  try {
    for await (const partial of gen.partials) {
      if (!streamDrafts) continue;
      const now = Date.now();
      if (now - lastSent < 60) continue;
      lastSent = now;
      const facts = (partial.facts ?? []).filter((f) => f?.label && f?.value) as AnswerCard["facts"];
      const steps = (partial.steps ?? []).filter((s) => s?.title) as AnswerCard["steps"];
      // Never stream text Privacy Guard would stop, in any part of the card.
      const text = [partial.headline, partial.body, ...facts.map((f) => `${f.label} ${f.value}`), ...steps.map((s) => `${s.title} ${s.detail ?? ""}`)].join(" ");
      if (!isClean(text, school)) continue;
      yield { type: "partial", card: { kind: partial.kind, headline: partial.headline ?? "", body: partial.body ?? "", facts, steps } };
    }
  } catch (err) {
    console.error("[ask] stream interrupted", err);
  }

  let answer: ModelAnswer;
  let mode: "live" | "extractive" = gen.live ? "live" : "extractive";
  try {
    answer = await gen.final;
  } catch (err) {
    // The model failed mid-answer (quota, truncation, network): answer from the passages instead of giving up.
    console.error("[ask] generation failed, using extractive answer", err);
    answer = extractiveAnswer(genInput);
    mode = "extractive";
  }

  const card = buildCard(answer, retrieval, school, r.medicalCaveat);
  if (!card) {
    yield* finish(await unsure(question, topic, input, school, retrieval, persist), answer.grounded ? "no_valid_citation" : "ungrounded");
    return;
  }
  if (retrieval.conflict && persist) {
    await recordGap(input.schoolId, question, `conflict ${[retrieval.conflict.a.documentId, retrieval.conflict.b.documentId].sort().join(" ")}`, topic, input.parentId, retrieval.conflict.note);
  }
  yield* finish(card, mode);
}

/** Turn the model's answer into the parent's card, keeping only what we can stand behind. */
export function buildCard(a: ModelAnswer, r: Retrieval, school: School, medicalCaveat: boolean): AnswerCard | null {
  const byId = new Map(r.passages.map((p) => [p.id, p]));
  const stale = r.conflict?.outdatedDocumentId ?? null;
  const cited = [...new Set(a.citations)]
    .map((id) => byId.get(id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p) && p!.documentId !== stale);
  const evById = new Map(r.events.map((e) => [e.id, e]));
  const events = [...new Set(a.eventIds)].map((id) => evById.get(id)).filter((e): e is NonNullable<typeof e> => Boolean(e));

  if (!a.grounded || (cited.length === 0 && events.length === 0)) return null;

  const card: AnswerCard = {
    outcome: "answered",
    kind: events.length ? "event" : a.kind,
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

  if (card.kind === "hours") {
    // Opening hours come from the school's structured settings, which the director owns, not from prose.
    card.kind = "hours";
    card.openNow = openNow(school.hours, school.timezone);
    card.facts = hoursFacts(school.hours);
    const weekday = card.facts[0];
    if (!a.headline || !/\d/.test(a.headline)) card.headline = weekday ? `We're open ${weekday.label}, ${weekday.value}.` : card.openNow.label;
    card.steps = [];
  }
  // A disagreement between documents is the director's to fix (it goes to their Inbox), not the parent's to read.

  // A table says it better: with facts to show, the headline and the table are the answer, not prose repeating them.
  if (card.facts.length >= 2 && card.kind !== "hours") card.body = "";
  if (medicalCaveat) {
    card.body = `${card.body} For medical advice, please check with your pediatrician.`.trim();
  }
  return card;
}

async function unsure(question: string, topic: string, input: AskInput, school: School, r: Retrieval | null, persist: boolean): Promise<AnswerCard> {
  // Only say it was passed on if it really was (eval runs don't save, so they keep the usual wording).
  const logged = persist ? await recordGap(input.schoolId, question, normalizeQuestion(question), topic, input.parentId, null) : false;
  const passedOn = logged || !persist;
  return {
    ...emptyCard(),
    outcome: "unsure",
    kind: "contact",
    headline: `I don't have that in ${possessive(school.shortName)} information yet.`,
    body: passedOn
      ? "I've passed your question to the front desk so they can answer it and add it for other families. You'll get a reply in the brightwheel app."
      : "I couldn't pass this to the front desk just now. Please message or call them below.",
    // Checked school suggestions fill this row (see answerableFollowUps).
    followUps: [],
    handoff: { reason: "Not in the school's information", phone: school.phone, email: school.email, gapLogged: logged },
  };
}

/** Log a question the documents don't answer for the director's Inbox. True when it was saved. */
async function recordGap(schoolId: string, question: string, normalized: string, topic: string, askerId: string | null, note: string | null): Promise<boolean> {
  try {
    const { error } = await db().rpc("record_gap", {
      p_school: schoolId,
      p_question: question,
      p_normalized: normalized || question.toLowerCase(),
      p_topic: topic,
      p_asker: askerId,
      p_kind: note ? "conflict" : "question",
      p_note: note,
    });
    if (error) throw error;
    return true;
  } catch (err) {
    console.error("[gaps] record failed", err);
    return false;
  }
}

/** Any finding at all blocks the line; only the school's own published contacts are allowed through. */
function findings(text: string, school: School) {
  return text.trim() ? detect(text, { allow: [school.phone, school.email, school.address].filter(Boolean) as string[] }) : [];
}
function isClean(text: string, school: School): boolean {
  return findings(text, school).length === 0;
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
    // Events were screened at sync; check again here, as the last line before a family sees it.
    events: card.events.filter((e) => ok(`${e.title} ${e.location ?? ""} ${e.description ?? ""}`)),
    // Source excerpts are shown in "Where this answer came from": mask anything held.
    citations: card.citations.map((c) => {
      const found = findings(c.excerpt, school);
      return found.length ? { ...c, excerpt: mask(c.excerpt, found) } : c;
    }),
    followUps: card.followUps.filter(ok),
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

/** Short or leaning on what came before: "And for three days?", "What about Fridays?", "How much is that?" */
export function looksLikeFollowUp(q: string): boolean {
  const t = q.trim().toLowerCase();
  if (/^(and|also|what about|how about|same|then|but|or|for|on|what if|is that|does that|how much is that|and if)\b/.test(t)) return true;
  // A short fragment ("Fridays?", "three days?") leans on context; a short real question ("When is picture day?") doesn't.
  return t.split(/\s+/).length <= 3 && !/^(what|when|where|who|why|how|is|are|do|does|can|will|should)\b/.test(t);
}

async function previousQuestion(conversationId: string, current: string): Promise<string | null> {
  const { data } = await db().from("messages").select("text").eq("conversation_id", conversationId).eq("role", "parent").is("reason", null).order("created_at", { ascending: false }).limit(3);
  const prior = (data ?? []).map((m) => m.text as string).find((t) => t.trim() !== current.trim());
  return prior ?? null;
}
