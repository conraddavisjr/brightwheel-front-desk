import sunflower from "@/seed/sunflower-valley/calendar.json";
import harbor from "@/seed/harbor-kids/calendar.json";

/**
 * The demo schools' public calendars as iCal feeds, the same format a school
 * publishes from Google Calendar ("Public address in iCal format"). Only
 * public events are included; the staff-only event never leaves the server.
 * Sources > "Use a calendar link" can point at these to show a live sync.
 */
type Cal = { calendar: string; events: Array<{ id: string; title: string; start: string; end: string; allDay: boolean; location: string; description: string; visibility: string }> };
const CALS: Record<string, Cal> = { "sunflower-valley": sunflower as Cal, "harbor-kids": harbor as Cal };

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\;");
const utc = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const date = (d: string) => d.replace(/-/g, "");

export async function GET(_req: Request, ctx: RouteContext<"/demo/[school]/calendar.ics">) {
  const { school } = await ctx.params;
  const cal = CALS[school];
  if (!cal) return new Response("Not found", { status: 404 });
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Front Desk demo//EN", `X-WR-CALNAME:${esc(cal.calendar)}`, "X-WR-TIMEZONE:America/Los_Angeles"];
  for (const e of cal.events.filter((x) => x.visibility === "public")) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.id}@front-desk-demo`,
      "DTSTAMP:20260901T000000Z",
      e.allDay ? `DTSTART;VALUE=DATE:${date(e.start)}` : `DTSTART:${utc(e.start)}`,
      e.allDay ? `DTEND;VALUE=DATE:${date(e.end)}` : `DTEND:${utc(e.end)}`,
      `SUMMARY:${esc(e.title)}`,
      ...(e.location ? [`LOCATION:${esc(e.location)}`] : []),
      ...(e.description ? [`DESCRIPTION:${esc(e.description)}`] : []),
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return new Response(lines.join("\r\n"), { headers: { "content-type": "text/calendar; charset=utf-8", "cache-control": "public, max-age=3600" } });
}
