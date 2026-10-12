import { describe, expect, it } from "vitest";
import { parseIcal } from "./ical";

const ICS = [
  "BEGIN:VCALENDAR",
  "BEGIN:VEVENT",
  "UID:a1",
  "SUMMARY:Picture Day",
  "DTSTART;TZID=America/Los_Angeles:20261022T083000",
  "DTEND;TZID=America/Los_Angeles:20261022T113000",
  "LOCATION:Main room\\, lobby",
  "DESCRIPTION:Order forms in brightwheel.\\nRetakes Nov 19.",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:a2",
  "SUMMARY:CLOSED - Thanksgiving",
  "DTSTART;VALUE=DATE:20261126",
  "DTEND;VALUE=DATE:20261128",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:a3",
  "SUMMARY:Staff reviews",
  "CLASS:PRIVATE",
  "DTSTART:20270120T170000Z",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

describe("parseIcal", () => {
  const ev = parseIcal(ICS, "America/Los_Angeles");
  it("reads timed events in their zone", () => {
    expect(ev[0].title).toBe("Picture Day");
    expect(ev[0].startsAt).toBe("2026-10-22T15:30:00.000Z");
    expect(ev[0].location).toBe("Main room, lobby");
    expect(ev[0].description).toContain("\nRetakes");
  });
  it("reads all-day events at local midnight across DST", () => {
    expect(ev[1].allDay).toBe(true);
    expect(ev[1].startsAt).toBe("2026-11-26T08:00:00.000Z");
  });
  it("keeps private events private", () => {
    expect(ev[2].private).toBe(true);
  });
});
