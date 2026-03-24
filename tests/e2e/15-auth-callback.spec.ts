import { expect, test } from "@playwright/test";

test.describe("Auth callback", () => {
  test("missing code redirects to login with missing_code error", async ({ page }) => {
    await page.goto("/auth/callback", { waitUntil: "domcontentloaded" });
    await page.waitForURL(/\/auth\/login\?error=missing_code/, {
      timeout: 15_000,
    });
    expect(page.url()).toContain("/auth/login?error=missing_code");
  });

  test("invalid code redirects to login with auth_failed error instead of 500", async ({
    page,
  }) => {
    await page.goto("/auth/callback?code=definitely-invalid", {
      waitUntil: "domcontentloaded",
    });
    await page.waitForURL(/\/auth\/login\?error=auth_failed/, {
      timeout: 15_000,
    });
    expect(page.url()).toContain("/auth/login?error=auth_failed");
  });
});
