import { describe, expect, it } from "vitest";
import { asksForHours } from "./hours";

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
    "My son had a fever, can he come in within 24 hours?",
  ])("not hours: %s", (q) => expect(asksForHours(q)).toBe(false));
});
