import "server-only";
import { embedTexts } from "@/lib/ai/provider";
import { cachedVerdict, rememberVerdict } from "@/lib/answer/followUpCache";
import { asksForHours, type WeeklyHours } from "@/lib/answer/hours";
import { normalizeQuestion, route } from "@/lib/guard/router";
import { indexModel } from "@/lib/ingest/ingest";
import { searchKnowledge } from "@/lib/retrieval/search";

/**
 * A suggested question is a promise: tapping it should lead to an answer. So
 * every chip is checked the way a real question would be (guard router, then
 * hybrid search) and only ones with a strong match are shown. Unknowns are
 * for questions families type themselves.
 */

/** Useful next questions for any school; each still has to pass the check. */
export const SCHOOL_SUGGESTIONS = [
  "What's coming up this month?",
  "When are you closed next?",
  "Tell me about the school calendar",
  "What's the illness policy?",
  "How much is tuition?",
  "What's for lunch?",
  "How do I book a tour?",
  "What is the late pickup fee?",
];

const BUDGET_MS = 1200;

export async function answerableFollowUps(
  school: { id: string; hours: WeeklyHours },
  candidates: string[],
  opts: { exclude?: string; max?: number } = {},
): Promise<string[]> {
  const max = opts.max ?? 3;
  const seen = new Set(opts.exclude ? [normalizeQuestion(opts.exclude)] : []);
  const pool: string[] = [];
  for (const q of [...candidates, ...SCHOOL_SUGGESTIONS]) {
    const key = normalizeQuestion(q);
    if (!q.trim() || seen.has(key)) continue;
    seen.add(key);
    pool.push(q.trim());
  }

  const verdict = new Map<string, boolean>();
  const unknown: string[] = [];
  for (const q of pool) {
    const hit = cachedVerdict(school.id, normalizeQuestion(q));
    if (hit !== undefined) verdict.set(q, hit);
    else if (route(q).action !== "answer") verdict.set(q, false);
    else if (Object.keys(school.hours).length > 0 && asksForHours(q)) verdict.set(q, true);
    else unknown.push(q);
  }

  // Check just enough of the rest to fill the row: one embedding call, two searches at a time,
  // within a time budget. Chips are optional; they never hold up the answer.
  const deadline = Date.now() + BUDGET_MS;
  const passing = () => pool.filter((q) => verdict.get(q)).length;
  const toCheck = unknown.slice(0, Math.max(0, max - passing()) + 3);
  if (toCheck.length) {
    try {
      const model = await indexModel(school.id);
      const embedded = model ? await embedTexts(toCheck, "query", model) : null;
      for (let i = 0; i < toCheck.length && passing() < max && Date.now() < deadline; i += 2) {
        const batch = toCheck.slice(i, i + 2);
        const results = await Promise.all(batch.map((q, j) => searchKnowledge(school.id, q, 4, embedded ? { vector: embedded.vectors[i + j], model: embedded.model } : null)));
        batch.forEach((q, j) => {
          const ok = results[j].strength === "strong" && !results[j].conflict;
          verdict.set(q, ok);
          rememberVerdict(school.id, normalizeQuestion(q), ok);
        });
      }
    } catch (err) {
      // If the check itself fails, show no unchecked chips rather than risk a dead end.
      console.warn("[follow-ups] check failed", err);
    }
  }
  return pool.filter((q) => verdict.get(q)).slice(0, max);
}
