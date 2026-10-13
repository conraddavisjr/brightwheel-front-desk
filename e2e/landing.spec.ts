import { expect, test } from "@playwright/test";

// Sign in the way a visitor does: by tapping the landing page buttons, not the API.
const doors = [
  { button: "Ask Harbor Kids as Maya", url: /\/ask$/, landmark: /Good (morning|afternoon|evening), Maya/ },
  { button: "Ask Sunflower Valley as Priya", url: /\/ask$/, landmark: /Good (morning|afternoon|evening), Priya/ },
  { button: "Harbor Kids · Notion, Drive and Calendar", url: /\/operator$/, landmark: /Harbor Kids/ },
  { button: "Sunflower Valley · Notion only", url: /\/operator$/, landmark: /Sunflower Valley/ },
];

for (const door of doors) {
  test(`landing: "${door.button}" opens the app`, async ({ page }) => {
    await page.goto("/");
    const button = page.getByRole("button", { name: door.button });
    await button.hover();
    await button.click();
    await expect(page).toHaveURL(door.url, { timeout: 10_000 });
    await expect(page.getByText(door.landmark).filter({ visible: true }).first()).toBeVisible();
  });
}

test("operator: View as parent switches to the parent app", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Harbor Kids · Notion, Drive and Calendar" }).click();
  await expect(page).toHaveURL(/\/operator$/, { timeout: 10_000 });
  await page.getByRole("button", { name: /parent view/i }).first().click();
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
  await page.getByRole("button", { name: "Ask Harbor Kids as Maya" }).click();
  await expect(page).toHaveURL(/\/ask$/, { timeout: 10_000 });
  await expect(html).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Dark mode" }).click();
  await page.reload();
  await expect(html).not.toHaveAttribute("data-theme", "dark");
});
