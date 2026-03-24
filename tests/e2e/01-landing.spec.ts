/**
 * Test Suite 1: Landing Page
 * Verifies that the home page renders the hero section and key nav links.
 */
import { test, expect } from "@playwright/test";

test.describe("Landing page", () => {
  test("renders hero section with primary heading", async ({ page }) => {
    await page.goto("/en");
    await page.waitForLoadState("domcontentloaded");

    // Hero heading text spans multiple elements; check for the brand keyword
    const heading = page.locator("h1").first();
    await expect(heading).toBeVisible({ timeout: 15_000 });

    // The hero title contains "risk" highlighted in brand colour
    const heroText = await heading.innerText();
    expect(heroText.toLowerCase()).toMatch(/risk|challenge|funded|win/i);
  });

  test("renders hero CTA buttons", async ({ page }) => {
    await page.goto("/en");
    await page.waitForLoadState("domcontentloaded");

    // Primary CTA — "Start your challenge"
    const primaryCta = page.getByRole("link", {
      name: /start your challenge/i,
    });
    await expect(primaryCta).toBeVisible({ timeout: 15_000 });

    // Secondary CTA — "How it works" (may appear multiple times in page; first is in hero)
    const secondaryCta = page
      .getByRole("link", { name: /how it works/i })
      .first();
    await expect(secondaryCta).toBeVisible();
  });

  test("renders nav link to Challenges", async ({ page }) => {
    await page.goto("/en");
    await page.waitForLoadState("domcontentloaded");

    // At least one link pointing to the challenges page should exist
    const challengeLinks = page.locator('a[href*="/challenges"]');
    await expect(challengeLinks.first()).toBeVisible({ timeout: 15_000 });
  });

  test("renders pricing tier preview section", async ({ page }) => {
    await page.goto("/en");
    await page.waitForLoadState("domcontentloaded");

    // The pricing preview heading — use locator scoped to h2 to avoid strict-mode issues
    const tiersHeading = page.locator("h2", { hasText: /choose your tier/i });
    await expect(tiersHeading).toBeVisible({ timeout: 15_000 });
  });

  test("renders sports section", async ({ page }) => {
    await page.goto("/en");
    await page.waitForLoadState("domcontentloaded");

    // Sports labels present in the page
    const basketball = page.getByText(/basketball/i);
    await expect(basketball).toBeVisible({ timeout: 15_000 });
  });

  test("page title reflects PlayFunded branding", async ({ page }) => {
    await page.goto("/en");
    await page.waitForLoadState("domcontentloaded");

    const title = await page.title();
    expect(title.toLowerCase()).toContain("playfunded");
  });
});
