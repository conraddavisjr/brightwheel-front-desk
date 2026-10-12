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
