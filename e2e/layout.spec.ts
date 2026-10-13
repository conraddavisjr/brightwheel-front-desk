import { expect, test } from "@playwright/test";
import { signIn } from "./support";

// No page may scroll sideways on a small phone. 360px is narrower than any current flagship.
test.use({ viewport: { width: 360, height: 780 } });

const PAGES: Array<[string, "harbor-kids" | "sunflower-valley", "parent" | "director" | null]> = [
  ["/", "harbor-kids", null],
  ["/ask", "harbor-kids", "parent"],
  ["/ask/chat", "harbor-kids", "parent"],
  ["/operator", "harbor-kids", "director"],
  ["/operator", "sunflower-valley", "director"],
  ["/operator/inbox", "harbor-kids", "director"],
  ["/operator/conversations", "harbor-kids", "director"],
  ["/operator/knowledge", "harbor-kids", "director"],
  ["/operator/privacy", "harbor-kids", "director"],
  ["/operator/sources", "harbor-kids", "director"],
];

for (const [path, school, role] of PAGES) {
  test(`${path}${role ? ` (${school} ${role})` : ""} never scrolls sideways at 360px`, async ({ page }) => {
    test.skip(test.info().project.name !== "phone", "one width is enough; runs once");
    if (role) await signIn(page, school, role);
    await page.goto(path, { waitUntil: "networkidle" });
    const overflow = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const wide = [...document.querySelectorAll("body *")]
        .filter((el) => getComputedStyle(el).position !== "fixed" && !el.closest('[role="dialog"]'))
        .filter((el) => el.getBoundingClientRect().right > vw + 0.5)
        .slice(0, 3)
        .map((el) => `${el.tagName.toLowerCase()} "${(el.textContent ?? "").trim().slice(0, 30)}"`);
      return { by: document.documentElement.scrollWidth - vw, wide };
    });
    expect(overflow.by, `wider than the screen: ${overflow.wide.join(", ")}`).toBeLessThanOrEqual(0);
  });
}
