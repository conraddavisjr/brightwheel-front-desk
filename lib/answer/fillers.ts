/**
 * The little lines a good front desk says while it looks something up.
 * Picked by rules, never by a model: they must be instant and free, and
 * they must fit what was said. Only a real question earns "Great question";
 * a thank-you gets nothing at all. Adapted from Palate's lib/voiceFillers.ts.
 */

export type Utterance = "question" | "request" | "statement" | "thanks" | "hello";

export function utteranceKind(q: string): Utterance {
  const t = q.trim().toLowerCase();
  if (/^(thanks|thank you|thx|ty|gracias|perfect|great,? thanks|ok thanks|awesome)\b/.test(t) && t.length < 40) return "thanks";
  if (/^(hi|hello|hey|good (morning|afternoon|evening)|hola)\b[!. ]*$/.test(t)) return "hello";
  if (/\?\s*$/.test(t) || /^(what|when|where|who|why|how|is|are|do|does|did|can|could|will|would|should|may|qu[eé]|cu[aá]ndo|d[oó]nde|c[oó]mo|puedo|hay)\b/.test(t)) return "question";
  if (/^(please|tell me|show me|i need|i want|i'?d like|book|schedule|find|look up|check)\b/.test(t)) return "request";
  return "statement";
}

const OPENERS: Record<Utterance, string[]> = {
  question: ["Great question. One moment.", "Good question, let me check.", "Let me look that up for you.", "One moment, I'll check."],
  request: ["On it. One moment.", "Sure, let me pull that up.", "Happy to help. One sec."],
  statement: ["Got it. Let me check.", "Okay, let me look."],
  thanks: [],
  hello: [],
};

const SPANISH_OPENERS = ["Buena pregunta. Un momento.", "Déjame revisar.", "Un momento, por favor."];

/** Progress lines, keyed by what the server says it is doing. */
export const PROGRESS: Record<"searching" | "reading" | "writing", string[]> = {
  searching: ["Checking the family handbook…", "Looking through your school's policies…"],
  reading: ["Reading the details…", "Making sure I have this right…"],
  writing: ["Putting it together…", "Almost there…"],
};

/** A small memory so the same opener is not used twice in a row. */
export class FillerMemory {
  private last = new Set<string>();
  pick(options: string[]): string | null {
    if (options.length === 0) return null;
    const fresh = options.filter((o) => !this.last.has(o));
    const choice = (fresh.length ? fresh : options)[Math.floor(Math.random() * (fresh.length || options.length))];
    this.last = new Set([choice]);
    return choice;
  }
}

export function looksSpanish(q: string): boolean {
  return /[¿¡ñ]|\b(qu[eé]|cu[aá]ndo|d[oó]nde|c[oó]mo|cu[aá]nto|horario|matr[ií]cula|mi hij[oa]|enferm[oa]|gracias|por favor|escuela)\b/i.test(q);
}

export function openerFor(q: string, memory?: FillerMemory): string | null {
  const kind = utteranceKind(q);
  if (kind === "thanks" || kind === "hello") return null;
  const options = looksSpanish(q) ? SPANISH_OPENERS : OPENERS[kind];
  return memory ? memory.pick(options) : options[0];
}
