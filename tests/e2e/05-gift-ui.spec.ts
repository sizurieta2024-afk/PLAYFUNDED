/**
 * Test Suite 5: Gift purchase UI
 * This test is designed for the authenticated flow — the gift checkbox and
 * email field live inside the payment method modal which only shows after
 * clicking "Buy challenge" as an authenticated user.
 *
 * Since we cannot authenticate in this E2E suite without real Supabase
 * credentials, we verify the unauthenticated surface and mark the
 * full gift-modal flow as requiring auth (fixme).
 */
import { test, expect } from "@playwright/test";

test.describe("Gift purchase UI — unauthenticated surface", () => {
  test("challenges page renders without errors", async ({ page }) => {
    await page.goto("/en/challenges");
    await page.waitForLoadState("domcontentloaded");

    // No error overlay or crashed page
    const body = await page.locator("body").innerText();
    expect(body).not.toMatch(/application error|unhandled error/i);
  });

  test("buy buttons are rendered for all tiers", async ({ page }) => {
    await page.goto("/en/challenges");
    await page.waitForSelector("button", { timeout: 20_000 });

    // When unauthenticated, every tier shows "Sign in to purchase"
    const buttons = page.getByRole("button", {
      name: /sign in to purchase|buy challenge/i,
    });
    const count = await buttons.count();
    expect(count).toBeGreaterThanOrEqual(5);
  });

  // NOTE: The gift modal requires authentication.
  // The test below documents the expected behaviour for future auth-assisted runs.
  test.fixme(
    "authenticated: payment modal shows gift checkbox",
    async () => {
      // Requires: valid session cookie injected via page.context().addCookies(...)
      // Steps:
      //   1. goto /en/challenges
      //   2. click "Buy challenge" on the Starter tier
      //   3. modal appears: verify "Send as a gift" checkbox is present
      //   4. check the checkbox: gift email input appears
      //   5. crypto section hides when gift mode is active
    },
  );

  test.fixme(
    "authenticated: toggling gift checkbox shows email input and hides crypto",
    async () => {
      // This test documents the expected gift UI behaviour.
      // It will be enabled once auth helpers are wired into the test fixtures.
    },
  );
});
