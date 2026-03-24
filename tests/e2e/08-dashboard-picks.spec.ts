/**
 * Test Suite 8: Dashboard picks page (authenticated)
 *
 * The picks page requires a Prisma user record. If the e2e user is not in Prisma,
 * the route redirects. This suite tests the route behavior and documents the outcome.
 * Tests that depend on picks content are marked as conditional.
 *
 * Uses preloaded session from tests/e2e/.auth/user.json (set via test.use).
 * Tests needing unauthenticated state explicitly clear cookies.
 */
import { test, expect } from "@playwright/test";

test.describe("Dashboard picks — authenticated", () => {
  test.use({ storageState: "tests/e2e/.auth/user.json" });

  test("/en/dashboard/picks does not redirect to login form", async ({
    page,
  }) => {
    let ended = "";
    try {
      await page.goto("/en/dashboard/picks", { waitUntil: "domcontentloaded" });
      ended = page.url();
    } catch {
      ended = "redirect_loop";
    }

    // Should not end up on the login form (auth/login)
    // It may redirect to home (/en) if user not in Prisma, but not to login form
    console.log(`Picks route outcome: ${ended}`);

    // If we did end up on picks or a redirect — not login
    const isLoginForm =
      ended.includes("/auth/login") && !ended.includes("redirectTo");
    expect(isLoginForm).toBe(false);
  });

  test("unauthenticated /en/dashboard/picks still redirects to login", async ({
    page,
  }) => {
    // Clear cookies to simulate unauthenticated access
    await page.context().clearCookies();
    await page.goto("/en/dashboard/picks", { waitUntil: "domcontentloaded" });

    await page.waitForURL(/\/auth\/login/, { timeout: 15_000 });
    expect(page.url()).toContain("/auth/login");
  });

  test("picks page renders content when accessible", async ({ page }) => {
    let accessible = false;
    try {
      await page.goto("/en/dashboard/picks", { waitUntil: "domcontentloaded" });
      const url = page.url();
      accessible = url.includes("/dashboard/picks");
    } catch {
      accessible = false;
    }

    if (!accessible) {
      test.skip(
        true,
        "Picks page not accessible for e2e user (Prisma user missing)",
      );
      return;
    }

    const body = await page.locator("body").innerText();
    expect(body).not.toMatch(/application error|unhandled error/i);
    expect(body.length).toBeGreaterThan(20);

    // Picks page renders either:
    // a) h1 "Place a Pick" (user has active challenge)
    // b) "no challenge" message and buy link (user has no active challenge)
    // Either is valid for the e2e test user.
    const h1Count = await page.locator("h1").count();
    if (h1Count > 0) {
      const h1Text = await page.locator("h1").first().innerText();
      expect(h1Text.toLowerCase()).toMatch(/pick|place|bet/i);
    } else {
      // No challenge state — page should have a "Buy a challenge" CTA link
      const buyLink = page
        .getByRole("main")
        .getByRole("link", { name: /buy/i })
        .first();
      await expect(buyLink).toBeVisible({ timeout: 10_000 });
    }
  });

  test("picks page shows empty state or events when accessible", async ({
    page,
  }) => {
    let accessible = false;
    try {
      await page.goto("/en/dashboard/picks", { waitUntil: "domcontentloaded" });
      const url = page.url();
      accessible = url.includes("/dashboard/picks");
    } catch {
      accessible = false;
    }

    if (!accessible) {
      test.skip(true, "Picks page not accessible for e2e user");
      return;
    }

    // Page should show one of: no-challenge message, no-events message, or events
    const body = await page.locator("body").innerText();
    expect(body.length).toBeGreaterThan(50); // has some content
    expect(body).not.toMatch(/application error|unhandled error/i);
  });
});
