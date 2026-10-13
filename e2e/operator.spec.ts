import { expect, test } from "@playwright/test";
import { signIn } from "./support";

test.beforeEach(async ({ page }) => {
  await signIn(page, "harbor-kids", "director");
});

test("home shows the numbers that matter", async ({ page }) => {
  await page.goto("/operator");
  await expect(page.getByText("Questions answered")).toBeVisible();
  await expect(page.getByText("Resolved without staff")).toBeVisible();
  await expect(page.getByText("Spotlight")).toBeVisible();
  await expect(page.getByRole("img", { name: /Questions per day/ })).toBeVisible();
});

test("Privacy Guard holds codes found in a messy page, and a decision sticks", async ({ page }) => {
  await page.goto("/operator/privacy");
  const item = page.locator("article").filter({ hasText: "alarm code is 2580" }).first();
  await expect(item).toBeVisible();
  await item.getByRole("button", { name: "Redact" }).click();
  await expect(page.getByText(/redaction list is updated/)).toBeVisible();
});

test("payroll and incident reports stay staff-only", async ({ page }) => {
  await page.goto("/operator/knowledge");
  await page.getByRole("button", { name: /Staff Payroll Sept 2026/ }).click();
  await expect(page.getByRole("radio", { name: "Staff-only" })).toHaveAttribute("aria-checked", "true");
});

test("adding a rule scans existing documents", async ({ page }) => {
  await page.goto("/operator/privacy");
  await page.getByRole("tab", { name: /Protected info rules/ }).click();
  await page.getByRole("button", { name: /Add a rule/ }).click();
  await page.getByLabel("Name").fill(`Caterer ${test.info().project.name}`);
  await page.getByLabel("What should we look for?").fill(test.info().project.name === "desktop" ? 'Anything about "Little Fork"' : 'Anything about "Fairbanks Farm"');
  await page.getByRole("button", { name: /Add rule and scan/ }).click();
  // The new rule rescans every document before confirming.
  await expect(page.getByText(/Rule added/)).toBeVisible({ timeout: 20_000 });
});

test("a conflict between two documents can be resolved by retiring the old one", async ({ page }) => {
  await page.goto("/operator/inbox");
  test.skip(test.info().project.name !== "desktop", "one-shot change; runs once per seed");
  await page.getByText(/says 100\.4F but/).first().click();
  const old = page.getByRole("listitem").filter({ hasText: "Illness policy (OLD 2024)" });
  await expect(old.getByText("Looks outdated")).toBeVisible();
  await old.getByRole("button", { name: /Retire this one/ }).click();
  await expect(page.getByText(/Only the current document is used now/)).toBeVisible();
});

test("Privacy Guard summary cards open their sections, and rule switches work", async ({ page }) => {
  await page.goto("/operator/privacy");
  await page.getByRole("button", { name: /Rules on/ }).click();
  await expect(page.getByRole("tab", { name: /Protected info rules/ })).toHaveAttribute("aria-selected", "true");

  // The knob stays inside its track, and a tap flips it right away (then flip it back).
  const sw = page.getByRole("switch", { name: "Custody and court orders" });
  const track = (await sw.boundingBox())!;
  const knob = (await sw.locator("span").boundingBox())!;
  expect(knob.x).toBeGreaterThanOrEqual(track.x);
  expect(knob.x + knob.width).toBeLessThanOrEqual(track.x + track.width);
  await expect(sw).toHaveAttribute("aria-checked", "true");
  await sw.click();
  await expect(sw).toHaveAttribute("aria-checked", "false");
  await sw.click();
  await expect(sw).toHaveAttribute("aria-checked", "true");

  await page.getByRole("button", { name: /Details protected/ }).click();
  await expect(page.getByRole("tab", { name: /Activity/ })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("button", { name: /Waiting for you/ }).click();
  await expect(page.getByRole("tab", { name: /Held for review/ })).toHaveAttribute("aria-selected", "true");
});

test("knowledge pages link to the real Notion page", async ({ page }) => {
  await page.goto("/operator/knowledge");
  await page.getByRole("button", { name: /Parent Info/ }).first().click();
  // Desktop shows the page inline; only phones get the sheet.
  if (test.info().project.name === "desktop") await expect(page.getByRole("dialog")).toHaveCount(0);
  const link = page.getByRole("link", { name: /Open in Notion/ }).filter({ visible: true });
  await expect(link).toHaveAttribute("href", /notion\.(so|site)\/3f7f8853595081d4a2e2c41f8d5b5c36$/, { timeout: 15_000 });
  await expect(link).toHaveAttribute("target", "_blank");
});

test("phone: the page drawer opens at full height and stays there while content loads", async ({ page }) => {
  test.skip(test.info().project.name !== "phone", "bottom sheet is phone-only");
  await page.goto("/operator/knowledge");
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  await page.route(/\/api\/operator\/documents\/[0-9a-f-]+$/, async (route) => {
    if (route.request().method() === "GET") await gate;
    await route.continue();
  });
  await page.getByRole("button", { name: /Behavior|Admissions/ }).first().click();
  const drawer = page.locator("[data-vaul-drawer]");
  await expect(drawer.getByLabel("Loading page")).toBeVisible();
  await page.waitForTimeout(700); // let the open animation finish
  const viewport = page.viewportSize()!;
  const loading = (await drawer.boundingBox())!;
  expect(loading.height).toBeGreaterThan(viewport.height * 0.85);
  release();
  const staff = drawer.getByRole("radio", { name: "Staff-only" });
  await expect(staff).toBeVisible();
  expect((await drawer.boundingBox())!.height).toBeCloseTo(loading.height, 0);

  // Changing who can see it reloads the page inside the drawer without resizing it.
  await staff.click();
  await expect(staff).toHaveAttribute("aria-checked", "true");
  expect((await drawer.boundingBox())!.height).toBeCloseTo(loading.height, 0);
  await drawer.getByRole("radio", { name: "Family-visible" }).click();
  await expect(drawer.getByRole("radio", { name: "Family-visible" })).toHaveAttribute("aria-checked", "true");
});

test("the how-it-works banner keeps one height through every step", async ({ page }) => {
  await page.goto("/operator");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  const banner = page.getByRole("region", { name: "How Front Desk works" });
  await expect(banner).toBeVisible();
  const heights: number[] = [];
  for (const n of ["1", "2", "3", "1"]) {
    await banner.getByRole("button", { name: new RegExp(`^${n}`) }).click();
    await page.waitForTimeout(450); // let the step's entrance animation settle
    heights.push(Math.round((await banner.boundingBox())!.height));
  }
  expect(new Set(heights).size, `heights per step: ${heights.join(", ")}`).toBe(1);
});

test("an uploaded file can be opened from the confirmation", async ({ page }) => {
  const name = `Rain gear note ${test.info().project.name}.md`;
  await page.goto("/operator/sources", { waitUntil: "networkidle" }); // the file input works once the page is interactive
  await page.locator('input[type="file"]').setInputFiles({ name, mimeType: "text/markdown", buffer: Buffer.from("# Rain gear\n\nSend rain boots and a rain jacket every day. We play outside in the rain.") });
  const view = page.getByRole("link", { name: "View it" });
  await expect(view).toBeVisible({ timeout: 20_000 });
  await view.click();
  await expect(page).toHaveURL(/\/operator\/knowledge\?doc=/);
  await expect(page.getByText("Send rain boots and a rain jacket every day.").filter({ visible: true }).first()).toBeVisible({ timeout: 15_000 });
});

test("the rule kind picker is a labeled list with descriptions, keyboard friendly", async ({ page }) => {
  await page.goto("/operator/privacy");
  await page.getByRole("tab", { name: /Protected info rules/ }).click();
  await page.getByRole("button", { name: /Add a rule/ }).click();
  await expect(page.getByText(/exact pattern/i)).toHaveCount(0);
  const picker = page.getByRole("button", { name: /Kind of information/ });
  await picker.click();
  const list = page.getByRole("listbox", { name: "Kind of information" });
  await expect(list.getByRole("option")).toHaveCount(10);
  await expect(list.getByRole("option", { name: /Building security/ })).toContainText("Door, alarm and gate codes");
  await list.getByRole("option", { name: /Building security/ }).click();
  await expect(list).toBeHidden();
  await expect(picker).toContainText("Building security");

  // Keyboard: open, move, choose; Escape closes the list but not the drawer.
  await picker.press("ArrowDown");
  await expect(list).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(list).toBeHidden();
  await expect(page.getByRole("dialog", { name: /Add a protected-info rule/ })).toBeVisible();
});
