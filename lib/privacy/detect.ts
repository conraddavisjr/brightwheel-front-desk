import type { Finding, PrivacyCategory } from "@/lib/schemas";
import { FIRST_NAMES } from "@/lib/privacy/names";

/**
 * Privacy Guard, layer 1: deterministic detectors.
 *
 * Runs on every document at ingest, for free, before anything reaches the
 * family-visible index. Each detector returns spans (character offsets into
 * the text) with a category and a plain-language reason a director can read.
 *
 * Two kinds of detector:
 * - Form detectors find things by their shape and verify them where a
 *   checksum exists (card numbers by Luhn, US routing numbers by the ABA
 *   checksum), so a phone number is not mistaken for a card.
 * - Context detectors find a sentence by what it is about ("court order",
 *   "do not share until", a named child next to a medication), and hold the
 *   whole sentence, because the meaning is in the sentence, not one token.
 *
 * Layer 2 (lib/privacy/classify.ts) asks a model about meaning these rules
 * cannot see. Both layers fail closed: a held span is masked in the index
 * until a director reviews it.
 */

export interface DetectContext {
  /** Contact details that belong to the school and are fine to share (main phone, front desk email, street address). */
  allow?: string[];
  /** Custom rules a director added, with an optional regex or quoted phrases in the description. */
  rules?: Array<{ id: string; name: string; description: string; pattern: string | null; category: string; enabled: boolean }>;
}

type Hit = Omit<Finding, "excerpt"> & { excerpt?: string };

const ROLE_MAILBOX = /^(info|office|hello|admin|frontdesk|front\.desk|admissions|enroll|enrollment|contact|billing|director|tours|team|support|events)@/i;

export function luhnValid(digits: string): boolean {
  const d = digits.replace(/\D/g, "");
  if (d.length < 13 || d.length > 19) return false;
  let sum = 0;
  let double = false;
  for (let i = d.length - 1; i >= 0; i--) {
    let n = d.charCodeAt(i) - 48;
    if (double) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    double = !double;
  }
  return sum % 10 === 0;
}

export function abaValid(digits: string): boolean {
  const d = digits.replace(/\D/g, "");
  if (d.length !== 9 || /^0{9}$/.test(d)) return false;
  const n = [...d].map(Number);
  const sum = 3 * (n[0] + n[3] + n[6]) + 7 * (n[1] + n[4] + n[7]) + (n[2] + n[5] + n[8]);
  return sum % 10 === 0;
}

/** The sentence (or table row / list line) around an offset. */
export function sentenceAround(text: string, start: number, end: number): [number, number] {
  let s = start;
  while (s > 0 && !/[.!?\n]/.test(text[s - 1])) s--;
  let e = end;
  while (e < text.length && !/[.!?\n]/.test(text[e])) e++;
  if (e < text.length && /[.!?]/.test(text[e])) e++;
  while (s < e && /\s|[-*>#|]/.test(text[s])) s++;
  return [s, e];
}

const normDigits = (s: string) => s.replace(/\D/g, "");

function allowed(value: string, ctx: DetectContext): boolean {
  const v = value.toLowerCase().trim();
  const vd = normDigits(value);
  return (ctx.allow ?? []).some((a) => {
    const al = a.toLowerCase().trim();
    if (!al) return false;
    if (al === v) return true;
    const ad = normDigits(a);
    return ad.length >= 7 && ad === vd;
  });
}

interface Detector {
  category: PrivacyCategory;
  label: string;
  re: RegExp;
  reason: string;
  /** Hold the whole sentence instead of the match. */
  sentence?: boolean;
  confidence?: number;
  /** Extra check on the match; false drops it. */
  check?: (m: RegExpExecArray, text: string, ctx: DetectContext) => boolean;
  /** Which part of the match is the sensitive value (capture group index). */
  group?: number;
}

const DETECTORS: Detector[] = [
  // Identifiers -------------------------------------------------------------
  {
    category: "personal_contact",
    label: "Social Security number",
    re: /\b(?!000|666|9\d\d)\d{3}-(?!00)\d{2}-(?!0000)\d{4}\b/g,
    reason: "Looks like a Social Security number. These never belong in family-facing answers.",
  },
  {
    category: "personal_contact",
    label: "Date of birth",
    re: /\b(?:dob|d\.o\.b\.?|date of birth|birth ?date|born(?: on)?)\s*[:\-]?\s*(\d{1,4}[/.-]\d{1,2}[/.-]\d{1,4}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.? \d{1,2},? \d{4})/gi,
    reason: "A date of birth identifies a specific child or adult.",
  },
  {
    category: "personal_contact",
    label: "Personal email",
    re: /\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/g,
    reason: "An individual's email address. Families should reach staff through the front desk.",
    check: (m, _t, ctx) => !ROLE_MAILBOX.test(m[0]) && !allowed(m[0], ctx),
    confidence: 0.8,
  },
  {
    category: "personal_contact",
    label: "Personal phone number",
    re: /(?<![\w$])(?:\+?1[ .-]?)?\(?\b\d{3}\)?[ .-]\d{3}[ .-]\d{4}\b/g,
    reason: "A phone number that is not the school's main line.",
    check: (m, _t, ctx) => !allowed(m[0], ctx),
    confidence: 0.75,
  },
  {
    category: "personal_contact",
    label: "Home address",
    re: /\b\d{2,6}\s+(?:[NSEW]\.?\s+)?(?:[A-Z][\w'.-]*\s+){1,3}(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Way|Place|Pl|Terrace|Ter)\b\.?(?:,?\s*(?:Apt|Unit|Suite|#)\.?\s*[\w-]+)?/g,
    reason: "A street address. Only the school's own address should be shared.",
    check: (m, text, ctx) => {
      if (allowed(m[0], ctx)) return false;
      const near = text.slice(Math.max(0, m.index - 80), m.index).toLowerCase();
      // The school's own address is usually introduced as such.
      return !/(we are located|our address|school address|located at|visit us at|campus is at)/.test(near) &&
        !(ctx.allow ?? []).some((a) => a && a.toLowerCase().includes(m[0].toLowerCase()));
    },
    confidence: 0.7,
  },

  // Money --------------------------------------------------------------------
  {
    category: "financial",
    label: "Card number",
    re: /(?<!\d)\d(?:[ -]?\d){12,18}(?!\d)/g,
    reason: "A payment card number (it passes the Luhn checksum).",
    check: (m) => luhnValid(m[0]) && !/^\d{3}[ .-]\d{3}[ .-]\d{4}$/.test(m[0]),
  },
  {
    category: "financial",
    label: "Bank routing number",
    re: /(?<!\d)(\d{9})(?!\d)/g,
    reason: "A bank routing number (it passes the ABA checksum) next to banking words.",
    check: (m, text) =>
      abaValid(m[1]) && /(routing|aba|rtn|bank|deposit|direct dep)/i.test(text.slice(Math.max(0, m.index - 60), m.index + 40)),
  },
  {
    category: "financial",
    label: "Bank account number",
    re: /\b(?:account|acct)\.?\s*(?:number|no\.?|#)?\s*[:#-]?\s*(\d[\d -]{4,18}\d)\b/gi,
    reason: "A bank account number.",
  },
  {
    category: "financial",
    label: "Bank account number",
    // CSV rows: a long digit run in a column whose header says account.
    re: /(?<=^|,)\s*(\d{8,17})\s*(?=,|$)/gm,
    reason: "A long account-like number in a spreadsheet next to banking columns.",
    check: (m, text) => /account|acct|bank/i.test(text.slice(0, 400)) && !abaValid(m[1]),
    confidence: 0.8,
    group: 1,
  },
  {
    category: "financial",
    label: "Tax ID",
    re: /\b(?:ein|tax id|tin|fein)\s*[:#-]?\s*\d{2}-\d{7}\b/gi,
    reason: "An employer or tax identification number.",
  },

  // Building security and secrets -------------------------------------------
  {
    category: "facility_security",
    label: "Door, gate or alarm code",
    re: /\b(?:door|gate|alarm|keypad|lock ?box|lockbox|entry|front door|back door|garage|security)\s*(?:code|pin|passcode|combo|combination)?s?\s*(?:is|=|:|-|was)?\s*#?\d{3,8}#?/gi,
    reason: "An access code for the building. Anyone with it could enter.",
    check: (m) => /\d{3,8}/.test(m[0]) && /code|pin|combo|combination|keypad|alarm/i.test(m[0]),
  },
  {
    category: "credentials",
    label: "Password",
    re: /\b(?:wi-?fi|wifi|network|guest network)?\s*(?:password|passcode|pwd|wifi key)\s*(?:is|=|:|-)?\s*["'`]?(?=[^\s"'`,;]*\d)([^\s"'`,;]{4,64})/gi,
    reason: "A password. Passwords should never be in a shared knowledge base.",
  },
  {
    category: "credentials",
    label: "API key or token",
    re: /\b(?:sk-[A-Za-z0-9_-]{16,}|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{30,}|xox[abpr]-[A-Za-z0-9-]{10,}|AIza[0-9A-Za-z_-]{35}|secret_[A-Za-z0-9]{30,}|ntn_[A-Za-z0-9]{30,})\b/g,
    reason: "A software credential (API key or token).",
  },

  // Meaning, by context: hold the whole sentence ----------------------------
  {
    category: "embargoed",
    label: "Not yet announced",
    // Imperative or shouted, so policy prose ("we do not share the other child's name") does not trip it.
    re: /\b(?:DO NOT (?:SHARE|TELL)|DON'?T (?:SHARE|TELL)|NOT FOR FAMILIES|INTERNAL ONLY|CONFIDENTIAL)\b|(?:^|[-\u2013(:!]\s*)(?:pls |please )?(?:do not|don'?t) share\b|\b(?:not (?:yet )?(?:announced|public)|until (?:the )?board approves|embargo(?:ed)?|keep (?:this )?quiet|hush hush|draft[,:]? not final)\b/gm,
    reason: "Marked as not for families yet. Sharing it early could cause confusion or break trust.",
    sentence: true,
    confidence: 0.85,
  },
  {
    category: "embargoed",
    label: "Licensing or inspection matter",
    re: /\b(?:licens(?:ing|e) (?:inspection|violation|complaint|visit|citation)|licensor|monitoring visit|citation from (?:the )?state|corrective action plan|under appeal)\b/gi,
    reason: "An open licensing matter. Directors usually share these on their own terms.",
    sentence: true,
    confidence: 0.75,
  },
  {
    category: "family_safety",
    label: "Custody or court order",
    re: /\b(?:custody|court order|restraining order|protective order|parenting plan|not (?:authorized|allowed|permitted) (?:to|for) pick ?up|no contact order|guardianship)\b/gi,
    reason: "Custody and court orders are about one family's safety and must stay with staff.",
    sentence: true,
    confidence: 0.9,
    check: (m, text) => namedPersonNear(text, m.index, m.index + m[0].length),
  },
  {
    category: "family_safety",
    label: "Child protection report",
    re: /\b(?:cps|child protective services|mandated report(?:er|ed|ing)?|suspected (?:abuse|neglect)|dcyf report)\b/gi,
    reason: "Child protection matters are confidential by law.",
    sentence: true,
    confidence: 0.9,
    check: (m, text) => namedPersonNear(text, m.index, m.index + m[0].length),
  },
  {
    category: "family_safety",
    label: "Authorized pickup list",
    re: /\b(?:authorized pick ?ups?|approved pick ?up)\s*(?:list)?\s*(?:for|:)\s*[A-Z][a-z]+/g,
    reason: "Who may pick up a specific child is safety information for staff only.",
    sentence: true,
    confidence: 0.8,
    check: (m, text) => namedPersonNear(text, m.index, m.index + m[0].length),
  },
  {
    category: "staff_hr",
    label: "Wages or payroll",
    re: /\$\s?\d{1,3}(?:\.\d{2})?\s*(?:\/|per)\s*(?:hr|hour)\b|\b(?:hourly (?:rate|wage)|salary|wage band|pay rate|payroll|raise of \$|bonus of \$)\b/gi,
    reason: "Staff pay is private HR information.",
    sentence: true,
    confidence: 0.8,
  },
  {
    category: "staff_hr",
    label: "Wages or payroll",
    // Rows of a pay table: a dollar range or hourly figure on a table line under a wage/pay heading.
    re: /^\|.*\$\s?\d[\d,]*(?:\.\d{2})?.*\|\s*$/gm,
    reason: "A row of a staff pay table.",
    confidence: 0.85,
    check: (m, text) => /(wage|salar|pay (?:band|scale|rate)|payroll|compensation)/i.test(text.slice(Math.max(0, m.index - 600), m.index)),
  },
  {
    category: "staff_hr",
    label: "Background check or discipline",
    re: /^\|.*\b(?:cleared|pending|delayed|flagged|denied)\b.*\|\s*$/gim,
    reason: "A named person's background check status.",
    confidence: 0.85,
    check: (m, text) => /(background|live ?scan|clearance|fingerprint|caci)/i.test(text.slice(Math.max(0, m.index - 800), m.index)),
  },
  {
    category: "staff_hr",
    label: "Background check or discipline",
    re: /\b(?:live ?scan|caci|fingerprint\w*|clearance)\b/gi,
    reason: "A named person's background check status.",
    sentence: true,
    confidence: 0.85,
    check: (m, text) => namedPersonNear(text, m.index, m.index + m[0].length),
  },
  {
    category: "staff_hr",
    label: "Background check or discipline",
    re: /\b(?:background check (?:is |was )?(?:pending|flagged|failed|cleared|in progress)|written warning|disciplinary|performance improvement plan|final warning|terminated for|fingerprint(?:ing)? (?:pending|results))\b/gi,
    reason: "Staff background checks and discipline are confidential HR records.",
    sentence: true,
    confidence: 0.85,
  },
  {
    category: "child_record",
    label: "Incident or injury report",
    re: /\b(?:incident report|injury report|accident report|ouch report|bit (?:another|a) (?:child|friend)|was bitten|bumped (?:his|her|their) head|head injury)\b/gi,
    reason: "Incident reports are records about a specific child.",
    sentence: true,
    confidence: 0.8,
    check: (m, text) => namedPersonNear(text, m.index, m.index + m[0].length),
  },
  {
    category: "child_record",
    label: "Developmental or learning plan",
    re: /\b(?:IEP|IFSP|developmental (?:delay|screening|assessment)|speech therapy|occupational therapy|behavior plan for)\b/g,
    reason: "Plans and assessments for one child are part of their private record.",
    sentence: true,
    confidence: 0.75,
    check: (m, text) => namedPersonNear(text, m.index, m.index + m[0].length),
  },
  {
    category: "health_record",
    label: "A child's health information",
    re: /\b(?:epi-?pen|epinephrine|inhaler|allerg(?:y|ic|ies)|anaphyla\w*|asthma|eczema|diagnos(?:ed|is)|medication|zyrtec|cetirizine|benadryl|seizure|diabet(?:es|ic)|celiac|milk protein|adhd|autism|hospitali[sz]ed|immuniz(?:ation|ed)|vaccin(?:e|ation|ated)|exemption|care plan)\b/gi,
    reason: "Health details tied to a named person are private health information.",
    sentence: true,
    confidence: 0.8,
    check: (m, text) => namedPersonNear(text, m.index, m.index + m[0].length),
  },
];

/**
 * Does the sentence name a specific person? A known given name (any case:
 * "Theo", "THEO RAMIREZ", "Jonah -"), or a Title-cased "First Last" pair
 * whose first word is a known name. Policy text about "a child" or "your
 * child" names no one, so it is never held.
 */
export function namedPersonNear(text: string, start: number, end: number): boolean {
  const [s, e] = sentenceAround(text, start, end);
  // Widen to the whole line: notes often put the name before a dash or colon.
  let lineStart = text.lastIndexOf("\n", s - 1) + 1;
  // A bullet belongs to the line that introduces its list ("THEO RAMIREZ - ..." then "- EpiPen in the red pouch").
  if (/^\s*[-*]\s/.test(text.slice(lineStart, lineStart + 4))) {
    let at = lineStart;
    for (let hops = 0; hops < 12 && at > 0; hops++) {
      const prev = text.lastIndexOf("\n", at - 2) + 1;
      const line = text.slice(prev, at - 1);
      at = prev;
      if (!/^\s*[-*]\s/.test(line) && line.trim()) {
        lineStart = prev;
        break;
      }
    }
  }
  const words = text.slice(Math.min(s, lineStart), e).match(/[A-Za-z][A-Za-z']*/g) ?? [];
  return words.some((w, i) => {
    const bare = w.replace(/'s$/i, "");
    const lower = bare.toLowerCase();
    if (!FIRST_NAMES.has(lower) || !/^[A-Z]/.test(bare)) return false;
    if (!AMBIGUOUS.has(lower)) return true;
    // "June", "Grace", "Max": only with a surname after them.
    return /^[A-Z][a-z]+$/.test(words[i + 1] ?? "") && !FIRST_NAMES.has((words[i + 1] ?? "").toLowerCase());
  });
}

const AMBIGUOUS = new Set(
  "may june april grace rose ivy hazel mark max dawn paige bailey reed parker carter cooper hudson brooke blake taylor quinn jordan morgan dakota sydney victor hugo daisy violet ruby jade willow luna aurora stella penelope nina ellie will joy faith hope miles chris eden sage river".split(" "),
);

/** Quoted phrases in a rule's description become literal matches: Flag "Project Falcon" and "merger". */
function ruleRegex(rule: NonNullable<DetectContext["rules"]>[number]): RegExp | null {
  if (rule.pattern) {
    try {
      return new RegExp(rule.pattern, "gi");
    } catch {
      return null;
    }
  }
  const phrases = [...rule.description.matchAll(/["“]([^"”]{2,60})["”]/g)].map((m) => m[1]);
  if (phrases.length === 0) return null;
  return new RegExp(`\\b(?:${phrases.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`, "gi");
}

export function detect(text: string, ctx: DetectContext = {}): Finding[] {
  const hits: Hit[] = [];
  for (const d of DETECTORS) {
    d.re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = d.re.exec(text))) {
      if (m[0].length === 0) {
        d.re.lastIndex++;
        continue;
      }
      if (d.check && !d.check(m, text, ctx)) continue;
      let start = m.index;
      let end = m.index + m[0].length;
      if (d.group && m[d.group]) {
        start = m.index + m[0].indexOf(m[d.group]);
        end = start + m[d.group].length;
      }
      if (d.sentence) [start, end] = sentenceAround(text, start, end);
      hits.push({ category: d.category, label: d.label, start, end, detector: "pattern", confidence: d.confidence ?? 0.95, reason: d.reason, ruleId: null });
    }
  }
  for (const rule of ctx.rules ?? []) {
    if (!rule.enabled) continue;
    const re = ruleRegex(rule);
    if (!re) continue;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      if (m[0].length === 0) {
        re.lastIndex++;
        continue;
      }
      const [start, end] = sentenceAround(text, m.index, m.index + m[0].length);
      hits.push({
        category: (rule.category as PrivacyCategory) ?? "custom",
        label: rule.name,
        start,
        end,
        detector: "pattern",
        confidence: 0.9,
        reason: `Matches your rule: ${rule.name}.`,
        ruleId: rule.id,
      });
    }
  }
  return mergeFindings(hits.map((h) => ({ ...h, excerpt: text.slice(h.start, h.end) }) as Finding));
}

/**
 * One finding per place: a span inside a bigger span of the same category
 * is dropped (the sentence already covers the code inside it); different
 * categories on the same text both stay, because a director may treat them
 * differently.
 */
export function mergeFindings(findings: Finding[]): Finding[] {
  const sorted = [...findings].sort((a, b) => a.start - b.start || b.end - a.end);
  const out: Finding[] = [];
  for (const f of sorted) {
    const covered = out.some((o) => o.category === f.category && o.start <= f.start && o.end >= f.end);
    if (!covered) out.push(f);
  }
  return out;
}

/** Replace held spans with a neutral marker. Used for everything written to the family index. */
export function mask(text: string, spans: Array<{ start: number; end: number }>): string {
  if (spans.length === 0) return text;
  const merged = [...spans].sort((a, b) => a.start - b.start).reduce<Array<{ start: number; end: number }>>((acc, s) => {
    const last = acc[acc.length - 1];
    if (last && s.start <= last.end) last.end = Math.max(last.end, s.end);
    else acc.push({ ...s });
    return acc;
  }, []);
  let out = "";
  let at = 0;
  for (const s of merged) {
    out += text.slice(at, s.start) + "[withheld]";
    at = s.end;
  }
  return out + text.slice(at);
}

const STAFF_ONLY_TITLE = /\b((?:room|classroom|teacher|staff) notes|payroll|incident report|injury report|custody|emergency contacts?|staff handbook|internal|scratchpad|confidential|personnel|background checks?|wages?|salar(?:y|ies)|performance review|board minutes|budget)\b/i;
const HEAVY: PrivacyCategory[] = ["staff_hr", "financial", "family_safety", "child_record", "health_record", "credentials"];

/**
 * Should the whole document stay with staff? Yes when its title says what it
 * is (payroll, incident report, custody), or when it is dense with heavy
 * findings (a contact sheet with twenty phone numbers is a contact sheet).
 */
export function suggestVisibility(title: string, text: string, findings: Finding[]): { visibility: "family" | "staff"; reason: string | null } {
  if (STAFF_ONLY_TITLE.test(title)) {
    return { visibility: "staff", reason: `The title says this is ${title.match(STAFF_ONLY_TITLE)?.[0].toLowerCase()} material.` };
  }
  const heavy = findings.filter((f) => HEAVY.includes(f.category)).length;
  const contacts = findings.filter((f) => f.category === "personal_contact").length;
  const kb = Math.max(1, text.length / 1000);
  if (heavy >= 4 || contacts / kb >= 3 || contacts >= 8) {
    return { visibility: "staff", reason: `It contains ${heavy + contacts} pieces of private information, so it reads as a records file, not family info.` };
  }
  return { visibility: "family", reason: null };
}
