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
