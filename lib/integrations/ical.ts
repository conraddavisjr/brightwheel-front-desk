import { zonedMidnight } from "@/lib/time";

/**
 * A small iCalendar (RFC 5545) reader for public school calendars: unfolds
 * lines, reads VEVENTs, handles all-day (VALUE=DATE), UTC and TZID times.
 * Recurring rules are not expanded (school calendars are mostly one-off
 * events); a repeating event shows its first date. Events marked
 * CLASS:PRIVATE or CONFIDENTIAL stay staff-only.
 */
export interface IcalEvent {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string | null;
  allDay: boolean;
  location: string | null;
  description: string | null;
  private: boolean;
}

const unescape = (s: string) => s.replace(/\\n/gi, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");

function toIso(value: string, params: string, tz: string): { iso: string; allDay: boolean } {
  if (/VALUE=DATE(?!-)/.test(params) || /^\d{8}$/.test(value)) {
    return { iso: zonedMidnight(`${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`, tz).toISOString(), allDay: true };
  }
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/.exec(value);
  if (!m) return { iso: new Date(value).toISOString(), allDay: false };
  const [, y, mo, d, h, mi, s, z] = m;
  if (z) return { iso: new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s)).toISOString(), allDay: false };
  const zone = /TZID=([^;:]+)/.exec(params)?.[1] ?? tz;
  const midnight = zonedMidnight(`${y}-${mo}-${d}`, zone).getTime();
  return { iso: new Date(midnight + ((+h * 60 + +mi) * 60 + +s) * 1000).toISOString(), allDay: false };
}

export function parseIcal(text: string, tz: string): IcalEvent[] {
  const lines = text.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "").split("\n");
  const out: IcalEvent[] = [];
  let cur: Record<string, { value: string; params: string }> | null = null;
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") cur = {};
    else if (line === "END:VEVENT" && cur) {
      if (cur.DTSTART && cur.SUMMARY) {
        const start = toIso(cur.DTSTART.value, cur.DTSTART.params, tz);
        const end = cur.DTEND ? toIso(cur.DTEND.value, cur.DTEND.params, tz) : null;
        out.push({
          id: cur.UID?.value ?? `${cur.DTSTART.value}-${cur.SUMMARY.value}`,
          title: unescape(cur.SUMMARY.value),
          startsAt: start.iso,
          endsAt: end?.iso ?? null,
          allDay: start.allDay,
          location: cur.LOCATION ? unescape(cur.LOCATION.value) : null,
          description: cur.DESCRIPTION ? unescape(cur.DESCRIPTION.value) : null,
          private: /PRIVATE|CONFIDENTIAL/i.test(cur.CLASS?.value ?? ""),
        });
      }
      cur = null;
    } else if (cur) {
      const m = /^([A-Z-]+)((?:;[^:]*)?):(.*)$/.exec(line);
      if (m) cur[m[1]] = { params: m[2], value: m[3] };
    }
  }
  return out;
}
