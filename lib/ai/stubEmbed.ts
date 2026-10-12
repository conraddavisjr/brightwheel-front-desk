/**
 * A free, deterministic stand-in for the embedding model, used when no
 * GEMINI_API_KEY is set (local dev, e2e, evals in CI). It hashes stemmed
 * words and word pairs into 768 dimensions and folds common childcare
 * synonyms together, so "Is my kid too sick to come in?" still lands near
 * the illness policy. It is not a language model; the live path is.
 */

export const EMBED_DIMS = 768;

const SYNONYMS: Array<[RegExp, string]> = [
  [/\b(sick|ill|illness|fever|temperature|vomit\w*|diarrhea|throw(?:ing)? up|contagious|symptoms?|unwell|pink ?eye|conjunctivitis|lice)\b/g, "illness"],
  [/\b(cost|costs|price|prices|tuition|fees?|rates?|pay|payment|payments|monthly|weekly|charge\w*|bill\w*|autopay)\b/g, "tuition"],
  [/\b(hours?|open|opens|close|closes|closing|opening|time|times|schedule)\b/g, "hours"],
  [/\b(food|meals?|lunch\w*|snacks?|breakfast|menu|menus|eat|eating|nutrition|formula|milk)\b/g, "meals"],
  [/\b(tour|tours|visit|visiting|see the school|look around|enroll\w*|waitlist|apply|application|admissions?)\b/g, "enrollment"],
  [/\b(holiday\w*|closed|closure\w*|break|vacation|day off|days off|no school)\b/g, "closure"],
  [/\b(event\w*|festival|picnic|party|concert|trip|field trip|picture day|photo day|conference\w*|potluck|graduation)\b/g, "event"],
  [/\b(nap\w*|sleep\w*|rest time|quiet time)\b/g, "nap"],
  [/\b(pick ?up|drop ?off|late|arriv\w*|leav\w*)\b/g, "pickup"],
  [/\b(potty|toilet\w*|diaper\w*|bathroom)\b/g, "potty"],
  [/\b(kid|kids|child|children|son|daughter|toddler|baby|infant|little one)\b/g, "child"],
  [/\b(medicine|medication\w*|meds|tylenol|ibuprofen|motrin)\b/g, "medication"],
  [/\b(teacher\w*|staff|ratio\w*|classroom\w*|room)\b/g, "staff"],
];

const STOP = new Set(
  "a an and or the of for to in on at by is are was be my our your we i me you it this that what when where how do does can will with from as if about any there their they them us please".split(" "),
);

function stem(w: string): string {
  return w.replace(/(ing|ed|es|s)$/, "").replace(/(.)\1$/, "$1");
}

export function stubTokens(text: string): string[] {
  let t = text.toLowerCase();
  const concepts: string[] = [];
  for (const [re, c] of SYNONYMS) {
    if (re.test(t)) concepts.push(`#${c}`);
    re.lastIndex = 0;
  }
  t = t.replace(/[^a-z0-9\s]/g, " ");
  const words = t.split(/\s+/).filter((w) => w.length > 1 && !STOP.has(w)).map(stem);
  const pairs = words.slice(1).map((w, i) => `${words[i]}_${w}`);
  return [...concepts, ...concepts, ...words, ...pairs];
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function stubEmbed(text: string): number[] {
  const v = new Array<number>(EMBED_DIMS).fill(0);
  for (const tok of stubTokens(text)) {
    const h = hash(tok);
    v[h % EMBED_DIMS] += (h & 1 ? 1 : -1) * (tok.startsWith("#") ? 2.5 : 1);
  }
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / norm);
}
