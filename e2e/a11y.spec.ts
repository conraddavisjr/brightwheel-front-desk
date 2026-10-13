import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { signIn } from "./support";

const PAGES: Array<[string, "parent" | "director" | null]> = [
  ["/", null],
  ["/ask", "parent"],
  ["/ask/chat", "parent"],
  ["/operator", "director"],
  ["/operator/inbox", "director"],
  ["/operator/conversations", "director"],
  ["/operator/knowledge", "director"],
  ["/operator/privacy", "director"],
  ["/operator/sources", "director"],
];

for (const scheme of ["light", "dark"] as const) {
  for (const [path, role] of PAGES) {
    test(`${path} has no WCAG 2.2 AA violations (${scheme})`, async ({ page }) => {
      // The OS is dark in both runs: light must still be the default, and dark is the opt-in theme.
      await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
      if (scheme === "dark") await page.addInitScript(() => localStorage.setItem("fd:theme", "dark"));
      if (role) await signIn(page, "harbor-kids", role);
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
      const summary = results.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} × ${v.nodes[0]?.target.join(" ")}`);
      expect(summary).toEqual([]);
    });
  }
}
