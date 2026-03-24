import { expect, test } from "@playwright/test";

const localeCases = [
  { path: "/auth/login" },
  { path: "/auth/signup" },
  { path: "/en/auth/login" },
  { path: "/en/auth/signup" },
  { path: "/pt-BR/auth/login" },
  { path: "/pt-BR/auth/signup" },
] as const;

for (const { path } of localeCases) {
  test(`Google auth link on ${path} reaches OAuth route instead of locale 404`, async ({
    page,
    request,
  }) => {
    await page.goto(path, { waitUntil: "domcontentloaded" });

    const googleLink = page.locator('a[href="/api/auth/google"]').first();
    await expect(googleLink).toBeVisible({ timeout: 15_000 });
    await expect(googleLink).toHaveAttribute("href", "/api/auth/google");

    const response = await request.get("/api/auth/google", {
      maxRedirects: 0,
      failOnStatusCode: false,
    });
    expect(response.status()).toBeGreaterThanOrEqual(300);
    expect(response.status()).toBeLessThan(400);
    const location = response.headers()["location"] ?? "";
    expect(location).toBeTruthy();
    expect(location).not.toContain("/en/api/auth/google");
    expect(location).not.toContain("/pt-BR/api/auth/google");
    expect(location).not.toContain("/404");
  });
}
