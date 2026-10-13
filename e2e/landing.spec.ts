import { expect, test } from "@playwright/test";

// Enter the way a visitor does: by tapping the landing page doors, not the API.
const doors = [
  { button: /View the parent's experience/, url: /\/ask$/, landmark: /Good (morning|afternoon|evening), Maya/ },
  { button: /Chat with Harbor Kids/, url: /\/ask$/, landmark: /Good (morning|afternoon|evening), Maya/ },
  { button: /View the operator's experience/, url: /\/operator$/, landmark: /Harbor Kids/ },
  { button: /Manage Harbor Kids/, url: /\/operator$/, landmark: /Harbor Kids/ },
];

for (const door of doors) {
  test(`landing: ${door.button.source} opens the app`, async ({ page }) => {
    await page.goto("/");
    const button = page.getByRole("link", { name: door.button }).first();
    await button.hover();
    await button.click();
    await expect(page).toHaveURL(door.url, { timeout: 10_000 });
    await expect(page.getByText(door.landmark).filter({ visible: true }).first()).toBeVisible();
  });
}

test("operator: View as parent switches to the parent app", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /Manage Harbor Kids/ }).first().click();
  await expect(page).toHaveURL(/\/operator$/, { timeout: 10_000 });
  await page.getByRole("link", { name: /parent view/i }).filter({ visible: true }).first().click();
  await expect(page).toHaveURL(/\/ask$/, { timeout: 10_000 });
  await expect(page.getByText(/Good (morning|afternoon|evening), Maya/)).toBeVisible();
});

test("theme: light by default even when the OS is dark; dark is a remembered choice", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  const html = page.locator("html");
  await expect(html).not.toHaveAttribute("data-theme", "dark");
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).not.toBe("rgb(15, 17, 32)");

  const toggle = page.getByRole("button", { name: "Dark mode" });
  await toggle.click();
  await expect(html).toHaveAttribute("data-theme", "dark");
  await expect(toggle).toHaveAttribute("aria-pressed", "true");

  // Remembered, and applied before paint on the next page.
  await page.getByRole("link", { name: /Chat with Harbor Kids/ }).first().click();
  await expect(page).toHaveURL(/\/ask$/, { timeout: 10_000 });
  await expect(html).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Dark mode" }).click();
  await page.reload();
  await expect(html).not.toHaveAttribute("data-theme", "dark");
});

test("landing: the section heading says this is a demo", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "What you can do in this demo" })).toBeVisible();
});

test("landing: How it works glides down to the section", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "How it works" }).click();
  // Mid-glide the page is partway down, not already at the section.
  await page.waitForTimeout(120);
  const mid = await page.evaluate(() => window.scrollY);
  await expect(page.getByRole("heading", { name: "What you can do in this demo" })).toBeInViewport();
  const end = await page.evaluate(() => window.scrollY);
  expect(mid).toBeLessThan(end);
  await expect(page).toHaveURL(/#how$/);
});

test("landing: the bottom of the page offers both experiences again", async ({ page }) => {
  await page.goto("/");
  const tryIt = page.getByRole("region", { name: "Try it" });
  await expect(tryIt.getByRole("heading", { name: "Try the parent experience" })).toBeVisible();
  // One school and one person per experience: fewer decisions.
  await expect(tryIt.getByRole("link")).toHaveCount(2);
  await expect(page.getByRole("link", { name: /Sunflower Valley/ })).toHaveCount(0);
  await tryIt.getByRole("link", { name: /Manage Harbor Kids/ }).click();
  await expect(page).toHaveURL(/\/operator$/, { timeout: 10_000 });
});

test("landing: each experience card is one link with no underlined text", async ({ page }) => {
  await page.goto("/");
  const card = page.getByRole("link", { name: /View the parent's experience/ });
  await expect(card.getByRole("heading", { name: "Parent experience" })).toBeVisible();
  const underlined = await card.evaluate((a) => [a, ...a.querySelectorAll("*")].filter((el) => getComputedStyle(el).textDecorationLine.includes("underline")).length);
  expect(underlined).toBe(0);
  // Tapping the card's text, not just the button, goes in.
  await card.getByText(/Ask anything by text, voice or a guided flow/).click();
  await expect(page).toHaveURL(/\/ask$/, { timeout: 10_000 });
});
