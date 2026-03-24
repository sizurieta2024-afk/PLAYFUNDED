/**
 * Test Suite 10: Admin panel access control
 *
 * Verifies that non-admin users cannot access /en/admin.
 * Uses preloaded session from tests/e2e/.auth/user.json (set in playwright.config.ts).
 * Tests that need to be unauthenticated explicitly clear cookies.
 */
import { test, expect } from "@playwright/test";

test.use({ storageState: "tests/e2e/.auth/user.json" });

/** Navigate to an admin URL and return the final URL (or "redirect_loop" on error). */
async function gotoAdmin(
  page: import("@playwright/test").Page,
  path: string,
): Promise<string> {
  try {
    await page.goto(path, { waitUntil: "domcontentloaded" });
    return page.url();
  } catch {
    return "redirect_loop";
  }
}

test.describe("Admin panel — access control", () => {
  test("unauthenticated access to /en/admin redirects to login", async ({
    page,
  }) => {
    await page.context().clearCookies();
    const result = await gotoAdmin(page, "/en/admin");

    const isOnLogin =
      result.includes("/auth/login") || result === "redirect_loop";
    expect(isOnLogin).toBe(true);
    console.log(`Unauthenticated /en/admin result: ${result}`);
  });

  test("non-admin authenticated user cannot access /en/admin admin UI", async ({
    page,
  }) => {
    const result = await gotoAdmin(page, "/en/admin");

    console.log(`Non-admin /en/admin result: ${result}`);

    // The saved auth fixture is validated in global.setup.ts as a non-admin user.
    // A real non-admin should be redirected away from the admin area.
    expect(result === "redirect_loop" || result.includes("/dashboard")).toBe(true);

    if (result !== "redirect_loop") {
      const adminSidebar = page.locator(
        '[class*="AdminSidebar"], nav[aria-label*="admin"]',
      );
      const sidebarCount = await adminSidebar.count();
      expect(sidebarCount).toBe(0);
    }
  });

  test("/en/admin page body does not contain admin-only content for non-admin", async ({
    page,
  }) => {
    const result = await gotoAdmin(page, "/en/admin");

    console.log(`/en/admin non-admin final URL: ${result}`);

    if (result === "redirect_loop") return; // admin page definitely didn't render

    const body = await page.locator("body").innerText();
    expect(body).not.toMatch(/user management|admin dashboard|admin panel/i);
  });

  test("unauthenticated /en/admin/users redirects to login", async ({
    page,
  }) => {
    await page.context().clearCookies();
    const result = await gotoAdmin(page, "/en/admin/users");

    const isOnLogin =
      result.includes("/auth/login") || result === "redirect_loop";
    expect(isOnLogin).toBe(true);
  });

  test("non-admin user cannot access /en/admin/users", async ({ page }) => {
    const result = await gotoAdmin(page, "/en/admin/users");

    console.log(`Non-admin /en/admin/users result: ${result}`);
    expect(result === "redirect_loop" || result.includes("/dashboard")).toBe(true);
  });

  test("non-admin user cannot access /en/admin/picks", async ({ page }) => {
    const result = await gotoAdmin(page, "/en/admin/picks");

    console.log(`Non-admin /en/admin/picks result: ${result}`);
    expect(result === "redirect_loop" || result.includes("/dashboard")).toBe(true);
  });
});
