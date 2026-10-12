// Visual QA helper: screenshots of key screens on a phone and a desktop, light and dark.
// Usage: node scripts/shoot.mjs <baseUrl> <outDir> [flow]
import { chromium, devices } from "@playwright/test";

const [base = "http://localhost:3100", out = "shots", flow = "parent"] = process.argv.slice(2);
const browser = await chromium.launch();

async function session(device, scheme, role, school) {
  const ctx = await browser.newContext({ ...device, colorScheme: scheme });
  const page = await ctx.newPage();
  page.on("console", (m) => m.type() === "error" && console.log(`[console:${scheme}]`, m.text()));
  page.on("pageerror", (e) => console.log(`[pageerror:${scheme}]`, e.message));
  if (role) {
    await page.goto(base + "/");
    const res = await page.request.post(base + "/api/demo/signin", { data: { school, role } });
    if (!res.ok()) throw new Error(await res.text());
  }
  return { ctx, page };
}

const phone = devices["Pixel 7"];
const desktop = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 };

if (flow === "landing") {
  for (const scheme of ["light", "dark"]) {
    for (const [name, dev] of [["phone", phone], ["desktop", desktop]]) {
      const { ctx, page } = await session(dev, scheme);
      await page.goto(base + "/");
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${out}/landing-${name}-${scheme}.png`, fullPage: true });
      await ctx.close();
    }
  }
}

if (flow === "parent") {
  for (const scheme of ["light", "dark"]) {
    const { ctx, page } = await session(phone, scheme, "parent", "harbor-kids");
    await page.goto(base + "/ask");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.getByRole("button", { name: /Sick policy/ }).waitFor();
    await page.screenshot({ path: `${out}/ask-home-${scheme}.png` });
    for (const [i, q] of ["When is picture day?", "Is my kid too sick to come in with a fever of 100.6?", "What are your hours?", "What's the alarm code?", "Do you offer summer camp?"].entries()) {
      await page.getByLabel("Your question").fill(q);
      await page.getByRole("button", { name: "Send question" }).click();
      await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'), null, { timeout: 30000 });
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${out}/ask-${i}-${scheme}.png` });
    }
    await ctx.close();
  }
}
await browser.close();
