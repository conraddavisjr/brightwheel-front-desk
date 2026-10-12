import { expect, test } from "@playwright/test";
import { ask, signIn } from "./support";

test.beforeEach(async ({ page }) => {
  await signIn(page, "harbor-kids", "parent");
  await page.goto("/ask");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("a cited answer from the school's own policy", async ({ page }) => {
  const card = await ask(page, "My son had a fever of 100.6 last night. Can he come in today?");
  await expect(card).toContainText(/24 hours|100\.4/);
  await expect(card.getByText("Answered from")).toBeVisible();
  await card.getByRole("button", { name: /Illness Policy 2026/ }).first().click();
  await expect(page.getByRole("dialog", { name: "Where this answer came from" })).toBeVisible();
  // Back closes the sheet before it leaves the page.
  await page.goBack();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page).toHaveURL(/\/ask$/);
});

test("an event card with add-to-calendar", async ({ page }) => {
  const card = await ask(page, "When is picture day?");
  await expect(card.getByText("Picture Day").first()).toBeVisible();
  const google = card.getByRole("link", { name: /Google Calendar/ }).first();
  await expect(google).toHaveAttribute("href", /calendar\.google\.com\/calendar\/render\?action=TEMPLATE/);
  await expect(card.getByRole("button", { name: /Apple \/ Outlook/ }).first()).toBeVisible();
});

test("codes and other families' details are never shared", async ({ page }) => {
  let card = await ask(page, "What's the alarm code?");
  await expect(card).toContainText("can't share access codes");
  await expect(page.locator("main")).not.toContainText("2580");
  card = await ask(page, "Which kids have lice right now?");
  await expect(card).toContainText("other families");
});

test("an emergency gets 911 first", async ({ page }) => {
  const card = await ask(page, "My child is choking and can't breathe");
  await expect(card).toContainText("call 911");
  await expect(card.getByRole("link", { name: /Call school/ })).toHaveAttribute("href", /^tel:/);
});

test("unknown questions go to the front desk, and the director's answer is used next time", async ({ page, browser }) => {
  const topic = test.info().project.name === "desktop" ? { q: "Is there a lost and found?", a: "Yes. The lost and found bin is by the front door. Unclaimed items are donated on the last Friday of each month.", re: /front door|last Friday/, again: "Where is the lost and found?" } : { q: "Is there a bike rack for parents?", a: "Yes, there is a bike rack next to the side gate. Please lock bikes; we can't watch them.", re: /side gate|bike rack/, again: "Where can I park my bike? Is there a bike rack?" };
  let card = await ask(page, topic.q);
  await expect(card).toContainText("don't have that");
  await expect(card.getByText("Sent to staff")).toBeVisible();

  const director = await browser.newPage();
  await signIn(director, "harbor-kids", "director");
  await director.goto("/operator/inbox");
  await director.getByText(topic.q).first().click();
  await director.getByLabel("Answer, in your words").fill(topic.a);
  await director.getByRole("button", { name: "Publish answer" }).click();
  await expect(director.getByText(/Published/)).toBeVisible();
  await director.close();

  card = await ask(page, topic.again);
  await expect(card).toContainText(topic.re);
});

test("guided sick check builds a precise question", async ({ page }) => {
  await page.getByRole("button", { name: /Can my child come in today/ }).click();
  const sheet = page.getByRole("dialog");
  await sheet.getByText("Vomiting").click();
  await sheet.getByRole("button", { name: "Check the policy" }).click();
  const card = page.locator("article").last();
  await expect(card).not.toHaveAttribute("aria-busy", "true", { timeout: 30_000 });
  await expect(page.locator("main")).toContainText(/vomiting/i);
});

test("the ask bar clears with the X", async ({ page }) => {
  const input = page.getByLabel("Your question");
  await input.fill("tuition");
  await page.getByRole("button", { name: "Clear question" }).click();
  await expect(input).toHaveValue("");
  await expect(input).toBeFocused();
});
