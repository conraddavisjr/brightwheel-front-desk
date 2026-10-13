import { expect, test } from "@playwright/test";

// Enter the way a visitor does: by tapping the landing page doors, not the API.
const doors = [
  { button: /Chat with Harbor Kids/, url: /\/ask$/, landmark: /Good (morning|afternoon|evening), Maya/ },
  { button: /Chat with Sunflower Valley/, url: /\/ask$/, landmark: /Good (morning|afternoon|evening), Priya/ },
  { button: /Manage Harbor Kids/, url: /\/operator$/, landmark: /Harbor Kids/ },
  { button: /Manage Sunflower Valley/, url: /\/operator$/, landmark: /Sunflower Valley/ },
];

for (const door of doors) {
  test(`landing: ${door.button.source} opens the app`, async ({ page }) => {
    await page.goto("/");
    const button = page.getByRole("link", { name: door.button });
    await button.hover();
    await button.click();
    await expect(page).toHaveURL(door.url, { timeout: 10_000 });
    await expect(page.getByText(door.landmark).filter({ visible: true }).first()).toBeVisible();
  });
}

test("operator: View as parent switches to the parent app", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /Manage Harbor Kids/ }).click();
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
  await page.getByRole("link", { name: /Chat with Harbor Kids/ }).click();
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
