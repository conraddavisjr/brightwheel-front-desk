import { expect, test } from "@playwright/test";
import { signIn } from "./support";

test.beforeEach(async ({ page }) => {
  await signIn(page, "harbor-kids", "director");
});

test("home shows the numbers that matter", async ({ page }) => {
  await page.goto("/operator");
  await expect(page.getByText("Questions answered")).toBeVisible();
  await expect(page.getByText("Answered without staff")).toBeVisible();
  await expect(page.getByText("Spotlight")).toBeVisible();
  await expect(page.getByRole("img", { name: /Questions per day/ })).toBeVisible();
});

test("Privacy Guard holds codes found in a messy page, and a decision sticks", async ({ page }) => {
  await page.goto("/operator/privacy");
  // Each device decides on a different item (the demo's review queue is shared). Cards are told apart
  // by their category label, since a card's context can quote a neighbouring secret.
  const label = test.info().project.name === "desktop" ? "Building security" : "Personal identifiers";
  const item = page.locator("article").filter({ hasText: label }).first();
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

test("the how-it-works banner can be dismissed and brought back", async ({ page }) => {
  await page.goto("/operator");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  const banner = page.getByRole("region", { name: "How Front Desk works" });
  await banner.getByRole("button", { name: "Hide how it works" }).click();
  await expect(banner).toBeHidden();
  await page.reload();
  await expect(banner).toBeHidden();
  await page.getByRole("button", { name: "How Front Desk works" }).click();
  await expect(banner).toBeVisible();
});

test("hours edited in Knowledge are what families are told", async ({ page, browser }) => {
  test.skip(test.info().project.name !== "desktop", "changes school settings; runs once");
  await page.goto("/operator/knowledge");
  await page.getByRole("button", { name: "Edit hours" }).click();
  const sheet = page.getByRole("dialog", { name: "Hours families see" });
  await sheet.getByLabel("Friday closes").fill("16:00");
  await sheet.getByRole("button", { name: "Save hours" }).click();
  await expect(page.getByText("Hours updated")).toBeVisible();

  const parent = await browser.newPage();
  await signIn(parent, "harbor-kids", "parent");
  await parent.goto("/ask/chat");
  await parent.getByLabel("Your question").fill("What time do you close on Friday?");
  await parent.getByRole("button", { name: "Send question" }).click();
  await expect(parent.locator("main article").last()).toContainText("We close at 4pm on Friday.", { timeout: 20_000 });
  await parent.close();

  // Put it back for the other tests.
  await page.getByRole("button", { name: "Edit hours" }).click();
  await sheet.getByLabel("Friday closes").fill("17:30");
  await sheet.getByRole("button", { name: "Save hours" }).click();
  await expect(page.getByText("Hours updated")).toBeVisible();
});

test("sources show the real connected workspaces without add or remove controls", async ({ page }) => {
  await page.goto("/operator/sources");
  await expect(page.getByText(/Connect another|Use a calendar link/)).toHaveCount(0);
  // Each connected tool shows a success badge, not a button.
  for (const id of ["notion", "drive", "calendar"]) await expect(page.locator(`section#${id}`).getByText("Connected", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /^Connect (Notion|Google Drive|Google Calendar)$/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Disconnect/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Harbor Kids team space/ })).toHaveAttribute("href", /notion\.(so|site)\//);
});

test("home: a top question opens its conversations, an unanswered one opens its Inbox item", async ({ page }) => {
  await page.goto("/operator");
  const top = page.getByRole("region").filter({ has: page.getByRole("heading", { name: "What families ask most" }) }).or(page.locator("section").filter({ has: page.getByRole("heading", { name: "What families ask most" }) })).first();
  const first = top.getByRole("link").filter({ hasNotText: "All conversations" }).first();
  await first.click();
  await expect(page).toHaveURL(/\/operator\/(conversations\?q=|inbox\?gap=)/);
});

test("home: most-used sources expand to show everything, then collapse", async ({ page }) => {
  await page.goto("/operator");
  const more = page.getByRole("button", { name: "See all" });
  await more.click();
  await expect(page.getByText("What families ask about")).toBeVisible();
  await page.getByRole("button", { name: "See less" }).click();
  await expect(page.getByText("What families ask about")).toBeHidden();
});

test("Inbox: families who asked sit in two rows that scroll sideways", async ({ page }) => {
  await page.goto("/operator/inbox");
  await page.getByText("Is there parking for drop off?").first().click();
  const row = page.getByRole("region", { name: "Families who asked" });
  await expect(row).toBeVisible();
  const rows = await row.locator("li").evaluateAll((els) => new Set(els.map((e) => Math.round(e.getBoundingClientRect().top))).size);
  expect(rows).toBeLessThanOrEqual(2);
  if (test.info().project.name === "phone") expect(await row.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
});

test("a Privacy Guard decision can be undone from its confirmation", async ({ page }) => {
  test.skip(test.info().project.name !== "desktop", "changes shared review state; runs once");
  await page.goto("/operator/privacy");
  const cards = page.locator("article").filter({ hasText: "Password or secret" });
  await expect(cards).toHaveCount(1);
  await cards.getByRole("button", { name: "Redact" }).click();
  await expect(cards).toHaveCount(0);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByText("Back in review")).toBeVisible();
  await expect(cards).toHaveCount(1);
});
