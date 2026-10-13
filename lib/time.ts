/** The UTC instant of local midnight on a calendar date in a time zone (DST-aware, no library). */
export function zonedMidnight(date: string, tz: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  // Start from noon UTC that day, find the zone's offset then, and step back to local midnight.
  const noon = new Date(Date.UTC(y, m - 1, d, 12));
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(noon);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const localAsUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"));
  const offset = localAsUtc - noon.getTime();
  return new Date(Date.UTC(y, m - 1, d) - offset);
}

/** "just now", "12 min ago", "5h ago", "3d ago". */
export function ago(iso: string | null): string {
  if (!iso) return "never";
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 90) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}
