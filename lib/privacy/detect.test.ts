import { describe, expect, it } from "vitest";
import { abaValid, detect, luhnValid, mask, suggestVisibility } from "./detect";

const cats = (text: string, allow: string[] = []) => detect(text, { allow }).map((f) => f.category);

describe("checksums", () => {
  it("validates Luhn card numbers", () => {
    expect(luhnValid("4539 1488 0343 6467")).toBe(true);
    expect(luhnValid("4539 1488 0343 6468")).toBe(false);
  });
  it("validates ABA routing numbers", () => {
    expect(abaValid("021000021")).toBe(true);
    expect(abaValid("021000022")).toBe(false);
  });
});

describe("detect", () => {
  it("finds SSNs, cards and routing numbers", () => {
    const f = detect("Maria Lopez, SSN 523-48-1937, card 4539 1488 0343 6467, routing 021000021");
    expect(f.map((x) => x.label)).toEqual(expect.arrayContaining(["Social Security number", "Card number", "Bank routing number"]));
  });

  it("ignores a phone number that only looks like a card", () => {
    expect(cats("Call us at (510) 555-0142 any time.", ["(510) 555-0142"])).toEqual([]);
  });

  it("flags a personal phone but not the school's main line", () => {
    expect(cats("Front desk (510) 555-0142. Teacher cell 510-555-0199.", ["(510) 555-0142"])).toEqual(["personal_contact"]);
  });

  it("keeps role mailboxes and flags personal emails", () => {
    const f = detect("Email hello@sunflower.example.com or jenny.park@gmail.com");
    expect(f).toHaveLength(1);
    expect(f[0].excerpt).toBe("jenny.park@gmail.com");
  });

  it("finds door and alarm codes in messy notes", () => {
    const f = detect("btw alarm code is 2580, gate code 1129 - don't share");
    expect(f.filter((x) => x.category === "facility_security").map((x) => x.excerpt)).toEqual(["alarm code is 2580", "gate code 1129"]);
    expect(f.some((x) => x.category === "embargoed")).toBe(true);
  });

  it("holds a whole sentence about custody", () => {
    const text = "Pickup is at 5:30. Per the court order, Raj Patel is not authorized to pick up Anaya. Thanks!";
    const f = detect(text).find((x) => x.category === "family_safety");
    expect(f?.excerpt).toBe("Per the court order, Raj Patel is not authorized to pick up Anaya.");
  });

  it("flags a named child's allergy but not the general nut-free policy", () => {
    expect(cats("We are a nut-free campus because many children have allergies.")).toEqual([]);
    expect(cats("Theo Ramirez has a severe peanut allergy and an epi-pen in the office.")).toContain("health_record");
  });

  it("flags embargoed tuition news", () => {
    expect(cats("Tuition goes up 6% in January. DO NOT SHARE until board approves.")).toContain("embargoed");
  });

  it("applies a director's quoted-phrase rule", () => {
    const f = detect("We are planning Project Falcon for spring.", {
      rules: [{ id: "r1", name: "Expansion plans", description: 'Anything about "Project Falcon"', pattern: null, category: "embargoed", enabled: true }],
    });
    expect(f[0]?.ruleId).toBe("r1");
  });
});

describe("policy text is not a record", () => {
  it.each([
    "If there is a court order limiting a parent's access to a child, we must have a copy on file.",
    "We are required to report any reasonable suspicion of child abuse or neglect to Child Protective Services.",
    "Any head injury, however small, results in a phone call to you.",
    "Families must submit a Food Allergy Action Plan signed by a health care provider for any food allergy.",
    "We do not share the name of the other child involved in any incident, including biting.",
    "Court documents are stored securely in your child's confidential file.",
  ])("%s", (text) => {
    expect(detect(text)).toEqual([]);
  });

  it("holds the same topics when a child is named, in any case", () => {
    expect(cats("**THEO RAMIREZ - SEVERE PEANUT ALLERGY - EPI-PEN**")).toContain("health_record");
    expect(cats("Jonah - inhaler for asthma, as needed, form on file")).toContain("health_record");
    expect(cats("Ava Chen bumped her head on the slide; incident report filed.")).toContain("child_record");
  });
});

describe("mask", () => {
  it("replaces overlapping spans once", () => {
    expect(mask("door code 4417# ok", [{ start: 0, end: 15 }, { start: 5, end: 10 }])).toBe("[withheld] ok");
  });
});

describe("suggestVisibility", () => {
  it("moves payroll to staff-only by title", () => {
    expect(suggestVisibility("Staff Payroll Sept 2026", "", []).visibility).toBe("staff");
  });
  it("keeps a handbook family-visible", () => {
    expect(suggestVisibility("Family Handbook", "Hours are 7 to 6.", []).visibility).toBe("family");
  });
});
