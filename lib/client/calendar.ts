/**
 * "Add to calendar" without any account access: a Google Calendar template
 * link and a standards-based .ics file (Apple Calendar, Outlook, everything
 * else). Nothing is written to anyone's calendar until they confirm it there.
 */
export interface CalEvent {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string | null;
  allDay: boolean;
  location: string | null;
  description: string | null;
  timezone: string;
}

const pad = (n: number) => String(n).padStart(2, "0");
const utcStamp = (d: Date) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;

/** The local calendar date of an instant in the school's zone, as YYYYMMDD. */
function localDate(iso: string, tz: string): string {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
  return p.replace(/-/g, "");
}

function range(e: CalEvent): [string, string] {
  if (e.allDay) {
    const start = localDate(e.startsAt, e.timezone);
    const end = e.endsAt ? localDate(e.endsAt, e.timezone) : localDate(new Date(new Date(e.startsAt).getTime() + 86400000).toISOString(), e.timezone);
    return [start, end];
  }
  const s = new Date(e.startsAt);
  const end = e.endsAt ? new Date(e.endsAt) : new Date(s.getTime() + 3600000);
  return [utcStamp(s), utcStamp(end)];
}

export function googleCalendarUrl(e: CalEvent, schoolName: string): string {
  const [s, end] = range(e);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `${e.title} · ${schoolName}`,
    dates: `${s}/${end}`,
    details: e.description ?? "",
    location: e.location ?? "",
    ctz: e.timezone,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\;");

export function icsFile(e: CalEvent, schoolName: string): string {
  const [s, end] = range(e);
  const dt = e.allDay ? [`DTSTART;VALUE=DATE:${s}`, `DTEND;VALUE=DATE:${end}`] : [`DTSTART:${s}`, `DTEND:${end}`];
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Front Desk//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${e.id}@frontdesk`,
    `DTSTAMP:${utcStamp(new Date())}`,
    ...dt,
    `SUMMARY:${esc(`${e.title} · ${schoolName}`)}`,
    e.location ? `LOCATION:${esc(e.location)}` : "",
    e.description ? `DESCRIPTION:${esc(e.description)}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");
}

export function formatEventWhen(e: CalEvent): { month: string; day: string; weekday: string; time: string } {
  const d = new Date(e.startsAt);
  const f = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-US", { timeZone: e.timezone, ...o }).format(d);
  let time = "All day";
  if (!e.allDay) {
    const t = (iso: string) => new Intl.DateTimeFormat("en-US", { timeZone: e.timezone, hour: "numeric", minute: "2-digit" }).format(new Date(iso)).replace(":00", "").replace(" ", "").toLowerCase();
    time = e.endsAt ? `${t(e.startsAt)} - ${t(e.endsAt)}` : t(e.startsAt);
  } else if (e.endsAt) {
    const days = Math.round((new Date(e.endsAt).getTime() - d.getTime()) / 86400000);
    if (days > 1) {
      const last = new Date(new Date(e.endsAt).getTime() - 86400000);
      time = `Through ${new Intl.DateTimeFormat("en-US", { timeZone: e.timezone, weekday: "short", month: "short", day: "numeric" }).format(last)}`;
    }
  }
  return { month: f({ month: "short" }), day: f({ day: "numeric" }), weekday: f({ weekday: "long" }), time };
}
