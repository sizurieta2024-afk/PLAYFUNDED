/**
 * Test Suite 3: Auth flows
 * Tests login form rendering, error on invalid credentials,
 * signup form rendering, and auth page structure.
 */
import { test, expect } from "@playwright/test";

test.describe("Login page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/en/auth/login");
    await page.waitForLoadState("domcontentloaded");
  });

  test("renders page title and subtitle", async ({ page }) => {
    // Title heading: "PlayFunded"
    const heading = page.locator("h1").first();
    await expect(heading).toBeVisible({ timeout: 15_000 });
    const text = await heading.innerText();
    expect(text).toMatch(/PlayFunded/i);
  });

  test("renders email input", async ({ page }) => {
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible({ timeout: 15_000 });
  });

  test("renders password input", async ({ page }) => {
    const passwordInput = page.locator('input[type="password"]');
    await expect(passwordInput).toBeVisible({ timeout: 15_000 });
  });

  test("renders sign-in submit button", async ({ page }) => {
    const submitBtn = page.getByRole("button", { name: /sign in/i });
    await expect(submitBtn).toBeVisible({ timeout: 15_000 });
  });

  test("renders Google sign-in option", async ({ page }) => {
    const googleBtn = page.getByRole("link", {
      name: /continue with google/i,
    });
    await expect(googleBtn).toBeVisible({ timeout: 15_000 });
  });

  test("renders sign-up link", async ({ page }) => {
    const signupLink = page.getByRole("link", { name: /sign up/i });
    await expect(signupLink).toBeVisible({ timeout: 15_000 });
  });

  test("shows error message on invalid credentials", async ({ page }) => {
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    const submitBtn = page.getByRole("button", { name: /sign in/i });

    await emailInput.fill("notareal@user.example.com");
    await passwordInput.fill("wrongpassword123");
    await submitBtn.click();

    // Wait for the error to appear (server action response).
    // Match the <p> inside the destructive container which has text content.
    const errorMsg = page.locator("p.text-destructive");
    await expect(errorMsg).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("Signup page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/en/auth/signup");
    await page.waitForLoadState("domcontentloaded");
  });

  test("renders page title", async ({ page }) => {
    const heading = page.locator("h1").first();
    await expect(heading).toBeVisible({ timeout: 15_000 });
    const text = await heading.innerText();
    expect(text).toMatch(/PlayFunded/i);
  });

  test("renders email and password inputs", async ({ page }) => {
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    await expect(emailInput).toBeVisible({ timeout: 15_000 });
    await expect(passwordInput).toBeVisible({ timeout: 15_000 });
  });

  test("renders name input (optional field)", async ({ page }) => {
    const nameInput = page.locator('input[id="name"]');
    await expect(nameInput).toBeVisible({ timeout: 15_000 });
  });

  test("renders create account submit button", async ({ page }) => {
    const submitBtn = page.getByRole("button", {
      name: /create account|sign up/i,
    });
    await expect(submitBtn).toBeVisible({ timeout: 15_000 });
  });

  test("renders link back to login", async ({ page }) => {
    // The signup page footer has "Sign in" link inside a <p> tag.
    // Use a scoped locator to avoid picking up the nav "Log in" button.
    const signInLink = page
      .locator("p")
      .getByRole("link", { name: /sign in/i });
    await expect(signInLink).toBeVisible({ timeout: 15_000 });
  });
});
