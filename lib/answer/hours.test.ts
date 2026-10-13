import { describe, expect, it } from "vitest";
import { asksForHours, hoursHeadline, type WeeklyHours } from "./hours";

describe("asksForHours", () => {
  it.each([
    "Hey, what are your operating hours?",
    "What are your hours?",
    "hours?",
    "Hours",
    "What are the school's hours",
    "What are your hours of operation?",
    "when do you open in the morning",
    "What time does the center close on Friday?",
    "What time do you close?",
    "¿A qué hora abren?",
    "What are the business hours",
  ])("hours: %s", (q) => expect(asksForHours(q)).toBe(true));

  it.each([
    "How much does Ms. Rivera make per hour?",
    "How many hours is part-time care?",
    "Is it 20 hours a week for the half-day program?",
    "Are you closed for Thanksgiving?",
    "Tell me about early closures",
    "What are your tuition rates?",
    "Do you have any open spots for toddlers?",
    "Are tours open to grandparents?",
    "When is the open house?",
    "Do you have openings for an infant in March?",
    "My son had a fever, can he come in within 24 hours?",
  ])("not hours: %s", (q) => expect(asksForHours(q)).toBe(false));
});

describe("hoursHeadline", () => {
  const hours = { mon: ["07:30", "17:30"], tue: ["07:30", "17:30"], wed: ["07:30", "17:30"], thu: ["07:30", "17:30"], fri: ["07:30", "17:30"], sat: null, sun: null } as WeeklyHours;
  const tz = "America/Los_Angeles";
  // Tuesday, Oct 13 2026, 10:00am Pacific.
  const tueMorning = new Date("2026-10-13T17:00:00Z");
  // Tuesday 6:30pm Pacific, after close.
  const tueEvening = new Date("2026-10-14T01:30:00Z");
  // Saturday 11am Pacific.
  const saturday = new Date("2026-10-17T18:00:00Z");

  it.each([
    ["What time do you close today?", tueMorning, null, "We close at 5:30pm today."],
    ["When do you open tomorrow?", tueMorning, null, "We open at 7:30am tomorrow."],
    ["Are you open today?", tueMorning, null, "Today we're open 7:30am - 5:30pm."],
    ["What time do you close today?", tueEvening, null, "We closed at 5:30pm today. We open again tomorrow at 7:30am."],
    ["Are you open today?", saturday, null, "We're closed today. We open again Monday at 7:30am."],
    ["What time do you close on Friday?", tueMorning, null, "We close at 5:30pm on Friday."],
    ["What are your hours?", tueMorning, null, "We're open Monday - Friday, 7:30am - 5:30pm."],
    ["Are you open today?", tueMorning, "Veterans Day", "We're closed today for Veterans Day. We open again tomorrow at 7:30am."],
  ])("%s", (q, now, closure, expected) => expect(hoursHeadline(q, hours, tz, now, closure)).toBe(expected));
});

describe("looksLikeFollowUp", async () => {
  const { looksLikeFollowUp } = await import("./pipeline");
  it.each(["And for three days?", "What about Fridays?", "how much is that?", "three days?", "Fridays?"])("follow-up: %s", (q) => expect(looksLikeFollowUp(q)).toBe(true));
  it.each(["When is picture day?", "What are your hours?", "How much is tuition for toddlers?", "Is the school nut-free?"])("standalone: %s", (q) => expect(looksLikeFollowUp(q)).toBe(false));
});
