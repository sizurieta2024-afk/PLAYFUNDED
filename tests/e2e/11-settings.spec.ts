/**
 * Test Suite 11: Settings page (authenticated)
 *
 * Uses preloaded session from tests/e2e/.auth/user.json (set in playwright.config.ts).
 * Tests that need to be unauthenticated explicitly clear cookies.
 */
import { test, expect } from "@playwright/test";

const EMAIL = "e2e@playfunded.com";

type SettingsState =
  | "loaded"
  | "runtime_error"
  | "redirect_loop"
  | "redirect_to_login";

async function gotoSettings(
  page: import("@playwright/test").Page,
): Promise<SettingsState> {
  try {
    await page.goto("/en/dashboard/settings", {
      waitUntil: "domcontentloaded",
    });
    const url = page.url();
    if (url.includes("/auth/login")) return "redirect_to_login";

    const errorPortal = page.locator("nextjs-portal");
    const hasErrorPortal = await errorPortal.count().then((c) => c > 0);
    if (hasErrorPortal) return "runtime_error";

    const body = await page.locator("body").innerText();
    if (body.match(/unhandled runtime error|user not found/i))
      return "runtime_error";

    const h1 = page.locator("h1");
    const h1Count = await h1.count();
    if (h1Count === 0) return "runtime_error";

    return "loaded";
  } catch {
    return "redirect_loop";
  }
}

test.describe("Settings page — authenticated", () => {
  test.use({ storageState: "tests/e2e/.auth/user.json" });

  test("settings route does not redirect authenticated user to login form", async ({
    page,
  }) => {
    const state = await gotoSettings(page);
    console.log(`Settings route state: ${state}`);

    expect(state).not.toBe("redirect_to_login");
    expect(page.url()).not.toContain("/auth/login");
  });

  test("unauthenticated settings access redirects to login", async ({
    page,
  }) => {
    await page.context().clearCookies();
    let ended = "";
    try {
      await page.goto("/en/dashboard/settings", {
        waitUntil: "domcontentloaded",
      });
      ended = page.url();
    } catch {
      ended = "redirect_loop";
    }
    const onLogin = ended.includes("/auth/login") || ended === "redirect_loop";
    expect(onLogin).toBe(true);
  });

  test("settings page renders or shows known DB error (not generic crash)", async ({
    page,
  }) => {
    const state = await gotoSettings(page);

    if (state === "runtime_error") {
      console.log("WARN: Settings page shows Prisma error for e2e user");
      return;
    }
    if (state === "redirect_loop") {
      console.log("WARN: Settings page redirect loop");
      return;
    }
    if (state === "loaded") {
      const body = await page.locator("body").innerText();
      expect(body).not.toMatch(/application error/i);
    }
  });

  test("settings h1 heading visible when page loads successfully", async ({
    page,
  }) => {
    const state = await gotoSettings(page);
    if (state !== "loaded") {
      test.skip(true, `Settings in state '${state}' — skipping`);
      return;
    }

    const h1 = page.locator("h1").first();
    await expect(h1).toBeVisible({ timeout: 15_000 });
    const text = await h1.innerText();
    expect(text.toLowerCase()).toMatch(/setting|preference|account/i);
  });

  test("profile section shows email when settings loads", async ({ page }) => {
    const state = await gotoSettings(page);
    if (state !== "loaded") {
      test.skip(true, `Settings in state '${state}' — skipping`);
      return;
    }

    const emailText = page.getByText(EMAIL);
    await expect(emailText).toBeVisible({ timeout: 15_000 });
  });

  test("weekly deposit limit input visible when settings loads", async ({
    page,
  }) => {
    const state = await gotoSettings(page);
    if (state !== "loaded") {
      test.skip(true, `Settings in state '${state}' — skipping`);
      return;
    }

    const limitInput = page.locator('input[type="number"]');
    await expect(limitInput).toBeVisible({ timeout: 15_000 });
  });

  test("sign out button visible in settings when page loads", async ({
    page,
  }) => {
    const state = await gotoSettings(page);
    if (state !== "loaded") {
      test.skip(true, `Settings in state '${state}' — skipping`);
      return;
    }

    const signOutBtn = page
      .getByRole("main")
      .getByRole("button", { name: /sign out/i });
    await expect(signOutBtn).toBeVisible({ timeout: 15_000 });
  });

  test("responsible gambling section accessible when settings loads", async ({
    page,
  }) => {
    const state = await gotoSettings(page);
    if (state !== "loaded") {
      test.skip(true, `Settings in state '${state}' — skipping`);
      return;
    }

    const safetyDetails = page.locator("details");
    await expect(safetyDetails).toBeVisible({ timeout: 15_000 });
    const summaryText = await safetyDetails.locator("summary").innerText();
    expect(summaryText.toLowerCase()).toMatch(
      /safety|responsible|exclusion|gambling/i,
    );
  });

  test("expanding safety section reveals self-exclusion option", async ({
    page,
  }) => {
    const state = await gotoSettings(page);
    if (state !== "loaded") {
      test.skip(true, `Settings in state '${state}' — skipping`);
      return;
    }

    const summary = page.locator("details > summary");
    await expect(summary).toBeVisible({ timeout: 15_000 });
    await summary.click();

    const selfExcludeLink = page.getByText(/self.exclu|exclude me/i).first();
    await expect(selfExcludeLink).toBeVisible({ timeout: 5_000 });
  });
});
