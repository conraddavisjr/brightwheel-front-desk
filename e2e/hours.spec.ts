import { expect, test } from "@playwright/test";
import { ask, signIn } from "./support";

test.beforeEach(async ({ page }) => {
  await signIn(page, "sunflower-valley", "parent");
  await page.goto("/ask/chat");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

// However a parent words it, hours come from the school's own settings.
for (const question of ["Hey, what are your operating hours?", "What are your hours?", "when do you open in the morning", "What time does the center close on Friday?"]) {
  test(`hours: "${question}"`, async ({ page }) => {
    const card = await ask(page, question);
    await expect(card).toContainText(/We're open/);
    await expect(card).not.toContainText(/don't have that/i);
  });
}
