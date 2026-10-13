/**
 * "Open now" is computed from the school's structured hours in its own time
 * zone, never by a model: a wrong "we're open" is worse than no answer.
 */

export type WeeklyHours = Partial<Record<"mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun", [string, string] | null>>;

const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const DAY_NAMES: Record<string, string> = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" };

export function fmtTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m ? `${h12}:${String(m).padStart(2, "0")}${suffix}` : `${h12}${suffix}`;
}

function localParts(now: Date, tz: string): { day: (typeof DAYS)[number]; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(now);
  const wd = parts.find((p) => p.type === "weekday")?.value.toLowerCase().slice(0, 3) as (typeof DAYS)[number];
  const h = Number(parts.find((p) => p.type === "hour")?.value) % 24;
  const m = Number(parts.find((p) => p.type === "minute")?.value);
  return { day: wd, minutes: h * 60 + m };
}

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

export function openNow(hours: WeeklyHours, tz: string, now = new Date(), closedToday: string | null = null): { open: boolean; label: string } {
  const { day, minutes } = localParts(now, tz);
  const today = hours[day];
  if (closedToday) return { open: false, label: `Closed today for ${closedToday}` };
  if (today && minutes >= toMin(today[0]) && minutes < toMin(today[1])) {
    return { open: true, label: `Open now · until ${fmtTime(today[1])}` };
  }
  if (today && minutes < toMin(today[0])) return { open: false, label: `Closed · opens ${fmtTime(today[0])}` };
  for (let i = 1; i <= 7; i++) {
    const d = DAYS[(DAYS.indexOf(day) + i) % 7];
    const h = hours[d];
    if (h) return { open: false, label: `Closed · opens ${i === 1 ? "tomorrow" : DAY_NAMES[d]} ${fmtTime(h[0])}` };
  }
  return { open: false, label: "Closed" };
}

/** Rows like "Monday - Friday: 7am - 6pm" with identical days grouped. */
export function hoursFacts(hours: WeeklyHours): Array<{ label: string; value: string }> {
  const order = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
  const rows: Array<{ from: string; to: string; value: string }> = [];
  for (const d of order) {
    const h = hours[d];
    const value = h ? `${fmtTime(h[0])} - ${fmtTime(h[1])}` : "Closed";
    const last = rows[rows.length - 1];
    if (last && last.value === value) last.to = d;
    else rows.push({ from: d, to: d, value });
  }
  return rows.map((r) => ({ label: r.from === r.to ? DAY_NAMES[r.from] : `${DAY_NAMES[r.from]} - ${DAY_NAMES[r.to]}`, value: r.value }));
}

/**
 * Does the question ask when the school is open? Matched on intent words, not
 * fixed phrases, so "operating hours", "your hours" and "when do you open" all
 * land on the structured answer. Durations ("how many hours", "per hour") and
 * one-off closures (holidays, breaks) are left to search.
 */
export function asksForHours(question: string): boolean {
  const q = question.toLowerCase();
  if (/\bper hour\b|\ban hour\b|\bhourly\b|\bhow many hours\b|\bhours? (a|per|each) (day|week)\b/.test(q)) return false;
  if (/\b(holiday|thanksgiving|christmas|break|closed (on|for)|closure|closures|snow|weather)\b/.test(q)) return false;
  return (
    /\b(open|opens|close|closes|closing|opening|what time do you|abren|cierran|horario)\b/.test(q) ||
    /\bhours of operation\b/.test(q) ||
    /\b(your|school|school's|center|center's|centre|daycare|operating|opening|business|office|regular|normal|daily|weekday)\s+hours\b/.test(q) ||
    /^\W*(what are (the|your)\s+)?hours\W*$/.test(q)
  );
}

const WEEKDAY_WORDS: Record<string, (typeof DAYS)[number]> = { sunday: "sun", monday: "mon", tuesday: "tue", wednesday: "wed", thursday: "thu", friday: "fri", saturday: "sat" };

/** Which day a question is about: "today", "tomorrow", a weekday, or none (the whole week). */
export function dayAsked(question: string, now: Date, tz: string): { day: (typeof DAYS)[number]; offset: number; when: string } | null {
  const q = question.toLowerCase();
  const { day: today } = localParts(now, tz);
  const at = (offset: number) => DAYS[(DAYS.indexOf(today) + offset) % 7];
  if (/\b(today|tonight|right now|now|this (morning|afternoon|evening))\b/.test(q)) return { day: today, offset: 0, when: "today" };
  if (/\btomorrow\b/.test(q)) return { day: at(1), offset: 1, when: "tomorrow" };
  for (const [word, d] of Object.entries(WEEKDAY_WORDS)) {
    if (new RegExp(`\\b${word}s?\\b`).test(q)) {
      const offset = (DAYS.indexOf(d) - DAYS.indexOf(today) + 7) % 7;
      return { day: d, offset, when: offset === 0 ? "today" : `on ${DAY_NAMES[d]}` };
    }
  }
  return null;
}

/**
 * Lead with the answer to what was asked: "We close at 5:30pm today." rather
 * than the weekly schedule (which still follows in the card).
 * `closure` is a calendar closure on that day, like "Veterans Day".
 */
export function hoursHeadline(question: string, hours: WeeklyHours, tz: string, now = new Date(), closure: string | null = null): string {
  const q = question.toLowerCase();
  const asksClose = /\b(clos(e|es|ing)|until|pick ?up by|latest|end of (the )?day)\b/.test(q);
  // "What time do you open?" asks for the opening time; "Are you open today?" asks for the day's hours.
  const asksOpen = !asksClose && (/\b(what time|when)\b.*\bopen/.test(q) || /\b(opening time|drop ?off|earliest|start)\b/.test(q));
  const facts = hoursFacts(hours);
  const week = facts[0] ? `We're open ${facts[0].label}, ${facts[0].value}.` : "Here are our hours.";
  const target = dayAsked(question, now, tz);
  if (!target) return week;

  const next = (from: number) => {
    for (let i = from + 1; i <= from + 7; i++) {
      const d = DAYS[(DAYS.indexOf(target.day) + (i - from)) % 7];
      const h = hours[d];
      if (h) return `We open again ${i - from === 1 && target.offset === 0 ? "tomorrow" : DAY_NAMES[d]} at ${fmtTime(h[0])}.`;
    }
    return "";
  };
  const h = hours[target.day];
  if (closure) return `We're closed ${target.when} for ${closure}. ${next(target.offset)}`.trim();
  if (!h) return `We're closed ${target.when === "today" ? "today" : `on ${DAY_NAMES[target.day]}s`}. ${next(target.offset)}`.trim();

  if (target.offset === 0) {
    const { minutes } = localParts(now, tz);
    if (minutes >= toMin(h[1])) return `We closed at ${fmtTime(h[1])} today. ${next(0)}`.trim();
  }
  if (asksClose) return `We close at ${fmtTime(h[1])} ${target.when}.`;
  if (asksOpen) return `We open at ${fmtTime(h[0])} ${target.when}.`;
  return `${target.when === "today" ? "Today" : target.when === "tomorrow" ? "Tomorrow" : `On ${DAY_NAMES[target.day]}s`} we're open ${fmtTime(h[0])} - ${fmtTime(h[1])}.`;
}
