import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseUrl = process.env.LIVE_BASE_URL ?? "https://playfunded-gamma.vercel.app";
const email = process.env.GOOGLE_TEST_EMAIL;
const password = process.env.GOOGLE_TEST_PASSWORD;
const loginPath = process.env.GOOGLE_TEST_LOGIN_PATH ?? "/en/auth/login";
const channel = process.env.PLAYWRIGHT_CHANNEL;
const hostResolverRules = process.env.HOST_RESOLVER_RULES;

if (!email || !password) {
  throw new Error("GOOGLE_TEST_EMAIL and GOOGLE_TEST_PASSWORD are required");
}

async function clickIfVisible(page, locator, timeout = 5_000) {
  try {
    await locator.waitFor({ state: "visible", timeout });
    await locator.click();
    return true;
  } catch {
    return false;
  }
}

async function maybeHandleGoogleIntermediates(page) {
  await clickIfVisible(page, page.getByRole("button", { name: /continue/i }).first(), 2_000);
  await clickIfVisible(page, page.getByRole("button", { name: /continuar/i }).first(), 2_000);
  await clickIfVisible(page, page.getByRole("button", { name: /confirm/i }).first(), 2_000);
  await clickIfVisible(page, page.getByRole("button", { name: /next/i }).first(), 2_000);
  await clickIfVisible(page, page.getByRole("button", { name: /siguiente/i }).first(), 2_000);
  await clickIfVisible(page, page.getByRole("button", { name: /accept/i }).first(), 2_000);
  await clickIfVisible(page, page.getByRole("button", { name: /allow/i }).first(), 2_000);
  await clickIfVisible(page, page.getByRole("button", { name: /permitir/i }).first(), 2_000);
  await clickIfVisible(page, page.getByRole("button", { name: /continue as/i }).first(), 2_000);
  await clickIfVisible(page, page.getByRole("button", { name: /yes/i }).first(), 2_000);
}

const browser = await chromium.launch({
  headless: true,
  ...(channel ? { channel } : {}),
  ...(hostResolverRules ? { args: [`--host-resolver-rules=${hostResolverRules}`] } : {}),
});

try {
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(`${baseUrl}${loginPath}`, { waitUntil: "domcontentloaded" });

  const googleLink = page.locator('a[href="/api/auth/google"]').first();
  await googleLink.waitFor({ state: "visible", timeout: 15_000 });
  await googleLink.click();

  await page.waitForURL(/accounts\.google\.com|google\.com/, { timeout: 30_000 });

  const emailInput = page.locator('input[type="email"]').first();
  await emailInput.waitFor({ state: "visible", timeout: 20_000 });
  await emailInput.fill(email);
  await page.getByRole("button", { name: /next/i }).click();

  const passwordInput = page.locator('input[type="password"]').first();
  await passwordInput.waitFor({ state: "visible", timeout: 20_000 });
  await passwordInput.fill(password);
  await page.getByRole("button", { name: /next/i }).click();

  await maybeHandleGoogleIntermediates(page);

  try {
    await page.waitForURL(new RegExp(baseUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), {
      timeout: 60_000,
    });
  } catch (error) {
    const currentUrl = page.url();
    const body = await page.locator("body").innerText().catch(() => "");
    await page.screenshot({ path: "test-results/google-oauth-live-timeout.png", fullPage: true });
    throw new Error(
      `Google OAuth did not return to ${baseUrl}. Current URL: ${currentUrl}. Body: ${body
        .slice(0, 800)
        .replace(/\s+/g, " ")}`,
      { cause: error },
    );
  }

  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(3_000);

  const finalUrl = page.url();
  const body = await page.locator("body").innerText();

  assert(
    !/auth\/login/.test(finalUrl),
    `Google OAuth returned to login instead of an authenticated page: ${finalUrl}`,
  );
  assert(
    !/internal server error|application error|page not found/i.test(body),
    `Google OAuth landed on an error page: ${body.slice(0, 500).replace(/\s+/g, " ")}`,
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        loginPath,
        finalUrl,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
