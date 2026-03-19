/**
 * Test Suite 4: Dashboard access protection
 * Verifies that unauthenticated users hitting /dashboard are redirected to login.
 */
import { test, expect } from "@playwright/test";

test.describe("Dashboard auth guard", () => {
  test("unauthenticated access to /en/dashboard redirects to login", async ({
    page,
  }) => {
    // Ensure no auth cookies are set
    await page.context().clearCookies();

    await page.goto("/en/dashboard", {
      waitUntil: "domcontentloaded",
    });

    // After redirects, we should be on the login page
    await page.waitForURL(/\/auth\/login/, { timeout: 15_000 });
    expect(page.url()).toContain("/auth/login");
  });

  test("login redirect preserves redirectTo query param", async ({ page }) => {
    await page.context().clearCookies();

    await page.goto("/en/dashboard", { waitUntil: "domcontentloaded" });
    await page.waitForURL(/\/auth\/login/, { timeout: 15_000 });

    const url = new URL(page.url());
    // Middleware adds ?redirectTo=... so the user returns after login
    const redirectTo = url.searchParams.get("redirectTo");
    expect(redirectTo).toBeTruthy();
    expect(redirectTo).toContain("dashboard");
  });

  test("login form is visible after redirect from protected dashboard", async ({
    page,
  }) => {
    await page.context().clearCookies();

    await page.goto("/en/dashboard", { waitUntil: "domcontentloaded" });
    await page.waitForURL(/\/auth\/login/, { timeout: 15_000 });

    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible({ timeout: 10_000 });
  });

  test("unauthenticated access to /en/dashboard/picks redirects to login", async ({
    page,
  }) => {
    await page.context().clearCookies();

    await page.goto("/en/dashboard/picks", { waitUntil: "domcontentloaded" });
    await page.waitForURL(/\/auth\/login/, { timeout: 15_000 });
    expect(page.url()).toContain("/auth/login");
  });
});
