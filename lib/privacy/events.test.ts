import { describe, expect, it } from "vitest";
import { screenEvent } from "./events";

describe("screenEvent", () => {
  it("withholds a code in an event description", () => {
    const e = screenEvent({ title: "Pumpkin Patch Field Trip", description: "Meet at the side gate. Gate code is 1129 if you're early.", location: "Fairbanks Farm" });
    expect(e.description).not.toContain("1129");
    expect(e.description).toContain("[withheld]");
    expect(e.staffOnly).toBe(false);
  });

  it("keeps an event with a sensitive title staff-only", () => {
    const e = screenEvent({ title: "Custody hearing - Patel family", description: null, location: null });
    expect(e.staffOnly).toBe(true);
  });

  it("leaves ordinary events alone", () => {
    const e = screenEvent({ title: "Picture Day", description: "Wear your favorite outfit. Retakes in November.", location: "Harbor Kids play yard" });
    expect(e).toMatchObject({ staffOnly: false, held: 0, description: "Wear your favorite outfit. Retakes in November." });
  });
});
