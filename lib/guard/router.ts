/**
 * The front door. Every question passes these rules before any search or
 * model call. They are plain code on purpose: free, instant, testable, and
 * impossible to talk out of their job.
 *
 * Order matters. Care comes first (an emergency must never get a polite
 * "I can't help with that"), then safety and privacy, then scope.
 */

export type Route =
  | { action: "answer"; medicalCaveat: boolean }
  | { action: "care"; kind: "emergency" | "wellbeing" }
  | { action: "handoff"; kind: "child_record" | "legal" | "concern" | "billing_account"; reason: string }
  | { action: "decline"; kind: "injection" | "privacy" | "security" | "off_topic" | "abuse" | "empty"; reason: string };

const any = (res: RegExp[], q: string) => res.some((r) => r.test(q));

const EMERGENCY = [
  /\b(not breathing|can'?t breathe|stopped breathing|choking|unconscious|unresponsive|won'?t wake|can'?t wake|passed out|seizing|having a seizure)\b/i,
  /\b(anaphyla\w*|allergic reaction|throat (is )?(closing|swelling)|swallowed (a |some )?(battery|magnet|pills?|bleach|poison)|poison(ed|ing)?\b)/i,
  /\b(bleeding (a lot|heavily|badly|won'?t stop)|severe bleeding|head injury|hit (his|her|their) head .*(vomit|sleepy|confused))/i,
  /\b(call 911|emergency room|this is an emergency|it'?s an emergency)\b/i,
];

const WELLBEING = [
  /\b(kill (myself|me)|suicid\w*|end my life|hurt(ing)? myself|self[- ]harm)\b/i,
  /\b(someone (is )?(hurting|touched|abus\w*) (my|our) (child|son|daughter|kid)|(child|kid) (is being|was) (abused|hit|hurt) (at home|by)|domestic violence|unsafe at home)\b/i,
];

const INJECTION = [
  /\b(ignore|disregard|forget|override) (all |any |the |your |previous |prior |above )*(instructions|rules|prompts?|guidelines|system)\b/i,
  /\b(system prompt|your (instructions|prompt|rules) (are|say)|repeat (the )?(text|words|instructions) above|print (your|the) (prompt|instructions)|reveal (your|the) (prompt|instructions|rules))\b/i,
  /\b(you are now|act as (?!a parent)|pretend (to be|you are)|roleplay as|developer mode|jailbreak|dan mode|do anything now)\b/i,
  /<\/?(system|instructions?|assistant)>|\[\[?system\]?\]|###\s*(system|instruction)/i,
  /\b(base64|rot13)\b.*\b(decode|instructions?)\b/i,
];

const SECURITY = [
  /\b(door|gate|alarm|keypad|entry|lock ?box|building|front door|back door)\s*(code|pin|passcode|combo|combination)\b/i,
  /\b(wi-?fi|wifi|network|camera|admin|staff) (password|login|passcode|credentials?)\b/i,
  /\bhow (do|can) i (get|sneak|break) in\b/i,
];

const OTHER_PEOPLE = [
  /\b(phone|number|address|email|contact|cell)\b.{0,30}\b(of|for)\b.{0,20}\b(another|other|a different)\b.{0,15}\b(parent|family|families|mom|dad|child|kid)\b/i,
  /\b(another|other)\b.{0,15}\b(parent|family|mom|dad)'?s\b.{0,20}\b(phone|number|address|email|contact|cell)\b/i,
  /\b(which|what|who|whose) (kids?|children|child|families|parents?|students?)\b.{0,40}\b(has|have|got|had|is|are|was|were)\b.{0,30}\b(lice|sick|covid|flu|hurt|injured|bit|bitten|allerg\w*|diagnos\w*|behind on|owe|custody|iep|special needs)\b/i,
  /\bwho (got|was|is) (hurt|injured|bitten|sick|sent home|in trouble)\b/i,
  /\b(how much|what) (do|does) (the )?(teachers?|staff|director|ms\.?|mr\.?|miss)\b.{0,20}\b(make|earn|get paid|salary|wage)\b/i,
  /\b(teacher|staff|director)'?s?\b.{0,20}\b(salary|wage|pay rate|home address|personal (phone|cell|email)|background check|ssn|social security)\b/i,
  /\b(list|names) of (all )?(the )?(families|parents|kids|children|students)\b/i,
];

const MY_CHILD_RECORD = [
  /\b(did|has|was|is|how (did|was|is))\b.{0,12}\b(my|our)\b.{0,6}\b(son|daughter|child|kid|baby|toddler|little one)\b.{0,40}\b(ate|eat today|nap|napped|slept|poop|diaper|today|this morning|doing|behav\w*|bit|cry|cried)\b/i,
  /\b(my|our) (son|daughter|child|kid|baby|toddler)'?s?\b.{0,25}\b(incident report|daily report|report card|assessment|progress|attendance|balance|invoice|allergy (plan|form)|immunization record|records?|file|nap (log|time today)|photos? today)\b/i,
  /\bhow (was|is) (my|our) (son|daughter|child|kid|baby)\b/i,
  /\b(where is|pick up) my (son|daughter|child|kid)\b.{0,20}\b(right now|now|today)\b/i,
];

const LEGAL = [
  /\b(custody|court order|restraining order|protective order|lawyer|attorney|subpoena|sue|lawsuit|legal action|cps|child protective)\b/i,
  /\b(my ex|ex-?(husband|wife|partner)|other parent)\b.{0,40}\b(pick ?up|not allowed|shouldn'?t|can'?t|block|stop)\b/i,
];

const CONCERN = [
  /\b(teacher|staff|someone|aide)\b.{0,30}\b(yelled at|grabbed|hit|slapped|spanked|hurt|shook|pushed|left alone|ignored)\b.{0,20}\b(my|our|a|the)?\s*(child|son|daughter|kid|baby)\b/i,
  /\b(file|make|submit) a (complaint|grievance|report)\b|\breport (a|the) (teacher|staff member)\b|\bi want to complain\b/i,
];

const MY_BILLING = [
  /\b(my|our) (balance|bill|invoice|statement|account|payment|charge|refund|autopay)\b.{0,30}\b(is|was|wrong|owe|due|late|missing|double|why|charged)\b/i,
  /\bhow much do i owe\b|\bwhy was i charged\b|\b(did|has) my payment (go through|process)\b/i,
];

const OFF_TOPIC = [
  /\b(write|compose) (me )?(a|an) (poem|essay|story|song|limerick|cover letter|resume|code|program|script)\b/i,
  /\b(stock|crypto|bitcoin|lottery|horoscope|sports scores?|nfl|nba|movie times?)\b/i,
  /\b(capital of|population of|who won the|recipe for|translate this|solve (this|for x)|my homework)\b/i,
  /\b(python|javascript|sql query|regex|leetcode)\b/i,
];

const ABUSE = [/\b(fuck(ing)? (you|off)|stupid (bot|ai|machine)|you suck|shut up|idiot|moron|useless (bot|ai))\b/i];

const MEDICAL_ADVICE = [
  /\b(should i give|how much (tylenol|ibuprofen|motrin|advil|medicine|benadryl)|what dose|dosage|is it (strep|covid|flu|rsv|hand,? foot)|does (he|she|my child|my kid) have|what does (this|a) rash|diagnos\w*|should i (take|bring) (him|her|them|my child) to the (doctor|er|hospital))\b/i,
];

export function route(raw: string): Route {
  const q = raw.normalize("NFKC").replace(/\s+/g, " ").trim();
  if (q.length === 0 || /^[^a-z0-9À-ɏ]+$/i.test(q) || /^(.)\1{6,}$/.test(q) || /^[asdfghjkl;qwertyuiop]{8,}$/i.test(q)) {
    return { action: "decline", kind: "empty", reason: "No question to answer." };
  }
  if (any(EMERGENCY, q)) return { action: "care", kind: "emergency" };
  if (any(WELLBEING, q)) return { action: "care", kind: "wellbeing" };
  if (any(INJECTION, q)) return { action: "decline", kind: "injection", reason: "Asked the assistant to drop its rules." };
  if (any(SECURITY, q)) return { action: "decline", kind: "security", reason: "Asked for building access or credentials." };
  if (any(OTHER_PEOPLE, q)) return { action: "decline", kind: "privacy", reason: "Asked about other families, children or staff." };
  if (any(LEGAL, q)) return { action: "handoff", kind: "legal", reason: "Custody, legal or child-protection matter." };
  if (any(CONCERN, q)) return { action: "handoff", kind: "concern", reason: "A concern about care or staff conduct." };
  if (any(MY_CHILD_RECORD, q)) return { action: "handoff", kind: "child_record", reason: "About one child's own records or day." };
  if (any(MY_BILLING, q)) return { action: "handoff", kind: "billing_account", reason: "About one family's own account." };
  if (any(ABUSE, q)) return { action: "decline", kind: "abuse", reason: "Abusive language." };
  if (any(OFF_TOPIC, q)) return { action: "decline", kind: "off_topic", reason: "Not about the school." };
  return { action: "answer", medicalCaveat: any(MEDICAL_ADVICE, q) };
}

/** Topic for analytics and gap clustering. Cheap keyword buckets, first match wins. */
const TOPICS: Array<[string, RegExp]> = [
  ["illness", /\b(sick|ill|illness|fever|temperature|vomit\w*|diarrhea|throw(ing)? up|contagious|symptom\w*|pink ?eye|lice|rash|cough|covid|flu|strep|medicine|medication|meds)\b/i],
  ["tuition", /\b(tuition|cost|costs|price|fees?|rates?|pay|payment|bill\w*|autopay|discount|deposit|subsid\w*|financial aid)\b/i],
  ["hours", /\b(hours?|open|close[sd]?|closing|opening|early drop|late pick)\b/i],
  ["calendar", /\b(holiday\w*|closure\w*|break|calendar|day off|days off|in-service|snow day|closed on)\b/i],
  ["events", /\b(event\w*|festival|picnic|party|concert|trip|picture day|photo day|conference\w*|potluck|graduation|halloween|costume)\b/i],
  ["meals", /\b(food|meals?|lunch\w*|snacks?|breakfast|menu|eat|nutrition|formula|milk|allerg\w*|nut)\b/i],
  ["enrollment", /\b(tour\w*|visit|enroll\w*|waitlist|wait list|apply|application|admission\w*|openings?|spots?|register|registration)\b/i],
  ["pickup", /\b(pick ?up|drop ?off|late|authorized|carpool|arriv\w*)\b/i],
  ["daily_care", /\b(nap\w*|sleep\w*|potty|toilet\w*|diaper\w*|routine|schedule|outdoor|outside|clothes|sunscreen|extra clothes)\b/i],
  ["policies", /\b(policy|policies|handbook|rules?|discipline|behavio\w*|biting|screen time|phones?)\b/i],
  ["staff", /\b(teacher\w*|staff|ratio\w*|classroom\w*|director)\b/i],
  ["communication", /\b(app|message|contact|call|email|reach|brightwheel|daily report|photos?)\b/i],
];

export function topicOf(q: string): string {
  for (const [t, re] of TOPICS) if (re.test(q)) return t;
  return "other";
}

/** Normalized form for clustering repeat questions in the Inbox. */
export function normalizeQuestion(q: string): string {
  return q
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !/^(the|and|for|you|your|are|can|what|when|how|does|did|our|any|there|this|that|with|about|have|has|will|would|please|is|do)$/.test(w))
    .map((w) => w.replace(/(ing|ed|es|s)$/, ""))
    .sort()
    .join(" ");
}
