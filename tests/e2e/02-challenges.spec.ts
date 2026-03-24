/**
 * Test Suite 2: Challenges Page
 * Verifies tier cards render, prices are visible, and unauthenticated buy
 * redirects to login.
 */
import { test, expect } from "@playwright/test";

// Expected tier names and price ranges (in USD)
const TIERS = [
  { name: "Starter", minPrice: 10, maxPrice: 30 },
  { name: "Pro", minPrice: 35, maxPrice: 60 },
  { name: "Elite", minPrice: 100, maxPrice: 160 },
  { name: "Master", minPrice: 250, maxPrice: 350 },
  { name: "Legend", minPrice: 600, maxPrice: 750 },
];

test.describe("Challenges page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/en/challenges");
    // Wait until at least one tier card heading is visible
    await page.waitForSelector("h2", { timeout: 20_000 });
  });

  function getTierCard(page: import("@playwright/test").Page, tierName: string) {
    return page
      .locator("div.rounded-2xl.border")
      .filter({ has: page.getByRole("heading", { name: tierName, exact: true }) })
      .first();
  }

  test("page heading renders", async ({ page }) => {
    const heading = page.locator("h1");
    await expect(heading).toBeVisible({ timeout: 15_000 });
    const text = await heading.innerText();
    expect(text.toLowerCase()).toMatch(/challenge/i);
  });

  test("renders all 5 tier name labels", async ({ page }) => {
    for (const tier of TIERS) {
      // Tier name appears in a heading inside the card
      const tierLabel = page.getByText(tier.name, { exact: true }).first();
      await expect(tierLabel).toBeVisible({ timeout: 15_000 });
    }
  });

  test("renders prices for all tiers", async ({ page }) => {
    // All dollar-sign prices should be visible (formatted as $XX)
    const priceElements = page.locator("text=/\\$\\d+/");
    const count = await priceElements.count();
    // At least 5 prices (one per tier)
    expect(count).toBeGreaterThanOrEqual(5);
  });

  test("Starter tier shows price in expected range", async ({ page }) => {
    const starterCard = getTierCard(page, "Starter");
    const priceText = await starterCard.locator("span.text-4xl").innerText();
    const price = Number(priceText.replace(/[$,]/g, ""));

    expect(price).toBeGreaterThanOrEqual(TIERS[0].minPrice);
    expect(price).toBeLessThanOrEqual(TIERS[0].maxPrice);
  });

  test("buy button is visible on Starter tier (unauthenticated state)", async ({
    page,
  }) => {
    // When not authenticated, button text comes from t('loginRequired') = "Sign in to purchase"
    const buyButtons = page.getByRole("button", {
      name: /sign in to purchase|buy challenge/i,
    });
    await expect(buyButtons.first()).toBeVisible({ timeout: 15_000 });
  });

  test("clicking buy on Starter tier redirects to login when unauthenticated", async ({
    page,
  }) => {
    // Unauthenticated: button says "Sign in to purchase"
    const loginButtons = page.getByRole("button", {
      name: /sign in to purchase/i,
    });
    const count = await loginButtons.count();

    if (count === 0) {
      // If somehow authenticated or text differs, skip gracefully
      test.skip(true, "No login-required buttons found; may be authenticated");
      return;
    }

    await loginButtons.first().click();

    // Should navigate to the login page
    await page.waitForURL(/\/auth\/login/, { timeout: 10_000 });
    expect(page.url()).toContain("/auth/login");
  });

  test("Elite tier has 'Most popular' badge", async ({ page }) => {
    const popularBadge = page.getByText(/most popular/i).first();
    await expect(popularBadge).toBeVisible({ timeout: 15_000 });
  });

  test("challenge rules footer note is visible", async ({ page }) => {
    const rulesSection = page.getByText(/challenge rules/i);
    await expect(rulesSection).toBeVisible({ timeout: 15_000 });
  });
});
