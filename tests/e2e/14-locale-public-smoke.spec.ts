import { expect, test } from "@playwright/test";

const localePaths = [
  "/",
  "/challenges",
  "/auth/login",
  "/auth/signup",
  "/legal",
  "/contact",
  "/en",
  "/en/challenges",
  "/en/auth/login",
  "/en/auth/signup",
  "/en/legal",
  "/en/contact",
  "/pt-BR",
  "/pt-BR/challenges",
  "/pt-BR/auth/login",
  "/pt-BR/auth/signup",
  "/pt-BR/legal",
  "/pt-BR/contact",
] as const;

for (const path of localePaths) {
  test(`public route smoke ${path}`, async ({ page }) => {
    await page.goto(path, { waitUntil: "domcontentloaded" });

    const body = page.locator("body");
    await expect(body).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("h1").first()).toBeVisible({ timeout: 15_000 });

    const bodyText = await body.innerText();
    expect(bodyText).not.toMatch(/application error|internal server error|unhandled runtime error/i);
    await expect(page).not.toHaveURL(/\/404(?:$|\?)/);
  });
}
