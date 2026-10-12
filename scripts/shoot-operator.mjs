// Visual QA for the operator app: every page, phone + desktop, light + dark, plus key drawers.
// Usage: node scripts/shoot-operator.mjs <baseUrl> <outDir> [pages=all] [schemes=light,dark]
import { chromium, devices } from "@playwright/test";
const [base, out, pagesArg = "all", schemesArg = "light,dark"] = process.argv.slice(2);
const PAGES = { home: "/operator", inbox: "/operator/inbox", conversations: "/operator/conversations", knowledge: "/operator/knowledge", privacy: "/operator/privacy", sources: "/operator/sources" };
const pick = pagesArg === "all" ? Object.keys(PAGES) : pagesArg.split(",");
const browser = await chromium.launch();
for (const [dev, label] of [[{ viewport: { width: 1440, height: 1000 } }, "desktop"], [devices["Pixel 7"], "phone"]]) {
  for (const scheme of schemesArg.split(",")) {
    const ctx = await browser.newContext({ ...dev, colorScheme: scheme });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => console.log(`[pageerror ${label} ${scheme}]`, e.message));
    page.on("console", (m) => m.type() === "error" && console.log(`[console ${label} ${scheme}]`, m.text().slice(0, 240)));
    await page.goto(base + "/");
    await page.request.post(base + "/api/demo/signin", { data: { school: "harbor-kids", role: "director" } });
    for (const name of pick) {
      await page.goto(base + PAGES[name]);
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${out}/${name}-${label}-${scheme}.png`, fullPage: label === "desktop" });
      if (name === "inbox") {
        await page.getByText("Is there parking", { exact: false }).first().click();
        await page.waitForTimeout(900);
        await page.screenshot({ path: `${out}/inbox-drawer-${label}-${scheme}.png` });
        await page.keyboard.press("Escape");
      }
      if (name === "privacy") {
        await page.screenshot({ path: `${out}/privacy-${label}-${scheme}.png`, fullPage: true });
      }
    }
    await ctx.close();
  }
}
await browser.close();
