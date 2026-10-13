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
  await expect(page.getByText(/Rule added/)).toBeVisible();
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
  const link = page.getByRole("link", { name: /Open in Notion/ }).filter({ visible: true });
  await expect(link).toHaveAttribute("href", /notion\.(so|site)\/3f7f8853595081d4a2e2c41f8d5b5c36$/);
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
