import { expect, test } from "@playwright/test";
import { ask, signIn } from "./support";

test.beforeEach(async ({ page }) => {
  await signIn(page, "harbor-kids", "parent");
  await page.goto("/ask");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("home shows staff replies, what's waiting, and recent questions", async ({ page }) => {
  await expect(page.getByRole("heading", { name: /Good (morning|afternoon|evening), Maya/ })).toBeVisible();

  const replies = page.getByRole("region", { name: /From the front desk/ });
  await expect(replies.getByRole("listitem").filter({ hasText: "Can grandparents visit for lunch?" }).getByText("Gretchen answered your question")).toBeVisible();
  await expect(replies.getByText(/Grandparents are welcome to join lunch on Fridays/)).toBeVisible();
  await expect(page.getByRole("heading", { name: /From the front desk/ })).toContainText(/\d new/);

  // "Got it" clears the highlight, and it stays cleared.
  const card = replies.getByRole("listitem").filter({ hasText: "Grandparents" });
  await expect(card.getByText("New", { exact: true })).toBeVisible();
  await card.getByRole("button", { name: "Got it" }).click();
  await expect(card.getByText("New", { exact: true })).toBeHidden();
  await page.reload();
  await expect(replies.getByRole("listitem").filter({ hasText: "Grandparents" }).getByText("New", { exact: true })).toBeHidden();

  const waiting = page.getByRole("region", { name: "Waiting on the front desk" });
  await expect(waiting.getByText("Do you offer a summer camp?")).toBeVisible();
  await expect(waiting.getByText(/Otters room in January/)).toBeVisible();

  await expect(page.getByRole("region", { name: "Your recent questions" }).getByRole("link").first()).toBeVisible();
});

test("the banner opens chat, a recent question re-asks it, and the breadcrumb goes home", async ({ page }) => {
  await page.getByRole("link", { name: /Ask Harbor Kids anything/ }).click();
  await expect(page).toHaveURL(/\/ask\/chat$/);
  await page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("link", { name: "Home" }).click();
  await expect(page).toHaveURL(/\/ask$/);

  await page.getByRole("link", { name: "Hours", exact: true }).click();
  await expect(page).toHaveURL(/\/ask\/chat$/); // the question is dropped from the URL once asked
  await expect(page.locator("main article").last()).toContainText(/We're open/, { timeout: 20_000 });
});

test("the sick check opens from home", async ({ page }) => {
  await page.getByRole("link", { name: /Can Lucas come in today\?/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("a staff answer from the Inbox reaches the parent's home", async ({ page, browser }) => {
  // Each device asks about something different, so one run's published answer can't answer the other's question.
  const q = test.info().project.name === "desktop" ? "Do you have a lending library for families?" : "Do you offer Mandarin lessons?";
  await page.goto("/ask/chat");
  await expect(await ask(page, q)).toContainText("don't have that");
  await page.goto("/ask");
  await expect(page.getByRole("region", { name: "Waiting on the front desk" }).getByText(q)).toBeVisible();

  const director = await browser.newPage();
  await signIn(director, "harbor-kids", "director");
  await director.goto("/operator/inbox");
  await director.getByText(q).first().click();
  const answer = test.info().project.name === "desktop" ? "Yes. The lending library shelf is in the lobby; borrow up to two books a week." : "Not yet. We're surveying families about a Mandarin class this spring.";
  await director.getByLabel("Answer, in your words").fill(answer);
  await director.getByRole("button", { name: "Publish answer" }).click();
  await expect(director.getByText(/Published/)).toBeVisible({ timeout: 15_000 });
  await director.close();

  await page.reload();
  await expect(page.getByRole("region", { name: /From the front desk/ }).getByText(answer)).toBeVisible();
});
