import { describe, expect, it } from "vitest";
import { chunkMarkdown } from "./chunk";

describe("chunkMarkdown", () => {
  it("splits on headings and keeps the heading path", () => {
    const md = "# Health\n\nOur health policies keep everyone well.\n\n## Fever\n\nStay home until fever-free for 24 hours.\n\n## Meds\n\nWe need a signed form.";
    const c = chunkMarkdown(md, "Family Handbook");
    expect(c.map((x) => x.heading)).toEqual(["Family Handbook > Health", "Family Handbook > Health > Fever", "Family Handbook > Health > Meds"]);
  });

  it("keeps a table whole and a list with its lead-in", () => {
    const md = "## Tuition\n\n| Program | Monthly |\n|---|---|\n| Infant | $2,150 |\n| Toddler | $1,890 |\n\nKeep your child home if:\n- fever over 100.4\n- vomiting\n";
    const c = chunkMarkdown(md, "Fees");
    expect(c).toHaveLength(1);
    expect(c[0].text).toContain("| Infant | $2,150 |");
    expect(c[0].text).toContain("Keep your child home if:\n- fever over 100.4");
  });

  it("packs long sections into several chunks", () => {
    const para = "Families are welcome to visit. ".repeat(30);
    const md = `## Visits\n\n${para}\n\n${para}\n\n${para}`;
    expect(chunkMarkdown(md, "X").length).toBeGreaterThan(1);
  });

  it("drops chunks that are only withheld markers", () => {
    expect(chunkMarkdown("## Codes\n\n[withheld]", "X")).toHaveLength(0);
  });
});
