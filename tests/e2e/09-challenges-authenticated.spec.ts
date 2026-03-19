/**
 * Test Suite 9: Buy flow — authenticated, no actual Stripe payment
 * Verifies the payment method modal opens, shows gift checkbox,
 * and that toggling the gift option shows/hides the email input and crypto section.
 *
 * Uses preloaded session from tests/e2e/.auth/user.json (set via test.use).
 */
import { test, expect } from "@playwright/test";

/** Helper: navigate to challenges and open the payment modal for the first Buy button */
async function openPaymentModal(page: import("@playwright/test").Page) {
  await page.goto("/en/challenges");
  await page.waitForSelector("button", { timeout: 20_000 });

  const buyButtons = page.getByRole("button", {
    name: /buy challenge|buy now|comprar/i,
  });
  await buyButtons.first().click();

  // Wait for modal heading
  const modalHeading = page
    .getByRole("heading", {
      name: /how do you want to pay|select payment method/i,
    })
    .first();
  await expect(modalHeading).toBeVisible({ timeout: 10_000 });
  return {
    modal: modalHeading.locator(".."),
    modalHeading,
  };
}

test.describe("Challenges buy flow — authenticated", () => {
  test.use({ storageState: "tests/e2e/.auth/user.json" });

  test("/en/challenges loads without error when authenticated", async ({
    page,
  }) => {
    await page.goto("/en/challenges");
    await page.waitForLoadState("domcontentloaded");

    const body = await page.locator("body").innerText();
    expect(body).not.toMatch(/application error|unhandled error/i);
  });

  test("authenticated buy button says 'Buy Challenge' (not 'Sign in to purchase')", async ({
    page,
  }) => {
    await page.goto("/en/challenges");
    await page.waitForSelector("button", { timeout: 20_000 });

    // For an authenticated user the button should NOT say "Sign in to purchase"
    const loginButtons = page.getByRole("button", {
      name: /sign in to purchase/i,
    });
    const count = await loginButtons.count();
    expect(count).toBe(0);

    // Instead "Buy Challenge" should be present
    const buyButtons = page.getByRole("button", {
      name: /buy challenge|buy now|comprar/i,
    });
    await expect(buyButtons.first()).toBeVisible({ timeout: 15_000 });
  });

  test("clicking Buy on Starter tier opens payment method modal (not login redirect)", async ({
    page,
  }) => {
    await openPaymentModal(page);
    // If we reach here without redirecting to login, the test passes
    expect(page.url()).toContain("/challenges");
  });

  test("payment modal shows card payment option (Visa/Mastercard)", async ({
    page,
  }) => {
    const { modal } = await openPaymentModal(page);

    // Card button shows "Visa, Mastercard, Amex" subtitle text
    const cardPayment = modal
      .getByText(/visa|mastercard|apple pay|google pay/i)
      .first();
    await expect(cardPayment).toBeVisible({ timeout: 10_000 });
  });

  test("payment modal shows crypto section (USDT/USDC/BTC)", async ({
    page,
  }) => {
    const { modal } = await openPaymentModal(page);

    // Crypto section shows currency options
    const cryptoLabel = modal.getByText(/usdt|usdc|btc/i).first();
    await expect(cryptoLabel).toBeVisible({ timeout: 10_000 });
  });

  test("payment modal surfaces gift controls only when enabled for the current policy", async ({
    page,
  }) => {
    const { modal } = await openPaymentModal(page);

    const giftCheckbox = modal.locator('input[type="checkbox"]');
    if ((await giftCheckbox.count()) === 0) {
      await expect(modal.getByText(/send as a gift/i)).toHaveCount(0);
      return;
    }

    await expect(giftCheckbox).toBeVisible({ timeout: 10_000 });

    const giftLabel = modal.getByText(/send as a gift/i);
    await expect(giftLabel).toBeVisible({ timeout: 10_000 });
  });

  test("ticking gift checkbox shows email input and hides crypto section", async ({
    page,
  }) => {
    const { modal } = await openPaymentModal(page);

    // Tick the gift checkbox
    const giftCheckbox = modal.locator('input[type="checkbox"]');
    test.skip(
      (await giftCheckbox.count()) === 0,
      "Gift checkout is disabled for the current country policy",
    );
    await giftCheckbox.check();

    // Gift email input should appear (the one in the modal, not the login page)
    const giftEmailInput = modal.locator('input[type="email"]');
    await expect(giftEmailInput).toBeVisible({ timeout: 5_000 });

    // Crypto section (USDT/USDC) should disappear — conditionally rendered with {!isGift && ...}
    const usdtLabel = modal.getByText(/usdt/i);
    await expect(usdtLabel).not.toBeVisible({ timeout: 5_000 });
  });

  test("unticking gift checkbox hides email input and restores crypto", async ({
    page,
  }) => {
    const { modal } = await openPaymentModal(page);

    const giftCheckbox = modal.locator('input[type="checkbox"]');
    test.skip(
      (await giftCheckbox.count()) === 0,
      "Gift checkout is disabled for the current country policy",
    );
    // Check then uncheck
    await giftCheckbox.check();
    await giftCheckbox.uncheck();

    // Crypto section should reappear — use first() to avoid strict-mode violation
    // (there are two elements matching /usdt/i: the currency label and the "Pay with USDT" button)
    const usdtLabel = modal.getByText(/usdt/i).first();
    await expect(usdtLabel).toBeVisible({ timeout: 5_000 });

    // Gift Stripe-only hint should be gone
    const giftHint = modal.getByText(/gift.*stripe|stripe.*only/i);
    await expect(giftHint).not.toBeVisible({ timeout: 5_000 });
  });

  test("modal closes when floating button / X is clicked", async ({ page }) => {
    const { modal, modalHeading } = await openPaymentModal(page);

    // Find the X button inside the modal — it's positioned absolute top-right
    // The modal contains exactly one X (close) button
    // Closest approach: click the button that contains an SVG X icon
    // We use keyboard Escape as the most reliable close method
    await page.keyboard.press("Escape");

    // Try Escape first
    const headingGone = await modalHeading
      .isVisible()
      .then((v) => !v)
      .catch(() => true);

    if (!headingGone) {
      const closeBtn = modal.getByRole("button").first();
      await closeBtn.click();
    }

    await expect(modalHeading).not.toBeVisible({ timeout: 5_000 });
  });
});
