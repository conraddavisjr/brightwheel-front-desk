import type { Page } from "@playwright/test";

export async function signIn(page: Page, school: "harbor-kids" | "sunflower-valley", role: "parent" | "director") {
  await page.goto("/");
  const res = await page.request.post("/api/demo/signin", { data: { school, role } });
  if (!res.ok()) throw new Error(`sign-in failed: ${await res.text()}`);
}

export async function ask(page: Page, question: string) {
  await page.getByLabel("Your question").fill(question);
  await page.getByRole("button", { name: "Send question" }).click();
  await page.waitForFunction(() => !document.querySelector('article[aria-busy="true"]'), null, { timeout: 30_000 });
  return page.locator("article").last();
}
