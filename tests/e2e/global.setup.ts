/**
 * Playwright global setup — runs once before all test suites (as a setup project).
 *
 * Logs in as the e2e test user via Supabase REST API (no UI, no rate limits),
 * then saves the resulting session cookie to tests/e2e/.auth/user.json so that
 * authenticated test suites can use test.use({ storageState }) without re-logging in.
 */
import { test as setup } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`[setup] Missing required env var: ${name}`);
  }
  return value;
}

const SUPABASE_URL = requireEnv("E2E_SUPABASE_URL");
const SUPABASE_ANON_KEY = requireEnv("E2E_SUPABASE_ANON_KEY");
const EMAIL = requireEnv("E2E_USER_EMAIL");
const PASSWORD = requireEnv("E2E_USER_PASSWORD");
const AUTH_FILE = path.join(__dirname, ".auth", "user.json");

setup("authenticate e2e user via Supabase API", async ({ page }) => {
  // Call Supabase auth REST API to get a fresh session
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase login failed (${res.status}): ${body}`);
  }

  const session = await res.json();
  const { access_token, refresh_token, expires_at } = session;
  console.log(
    `\n[setup] Token obtained, expires ${new Date(expires_at * 1000).toISOString()}`,
  );

  // Build the Supabase session cookie (same format as @supabase/ssr)
  const cookieName = "sb-pvwynjnifdmaisswtwiz-auth-token";
  const cookieValue =
    "base64-" +
    Buffer.from(
      JSON.stringify({
        access_token,
        token_type: "bearer",
        expires_in: 3600,
        expires_at,
        refresh_token,
        user: session.user,
      }),
    ).toString("base64");

  // Inject the cookie into the browser context
  await page.context().addCookies([
    {
      name: cookieName,
      value: cookieValue,
      domain: "localhost",
      path: "/",
      expires: expires_at,
      httpOnly: false,
      secure: false,
      sameSite: "Lax",
    },
  ]);

  // Smoke-check: navigate to challenges — should stay authenticated (not redirect to login)
  await page.goto("/en/challenges", { waitUntil: "domcontentloaded" });
  const url = page.url();
  console.log(`[setup] Smoke check URL: ${url}`);
  if (url.includes("/auth/login")) {
    throw new Error("[setup] Smoke check FAILED — cookie not accepted by Next.js middleware");
  }
  console.log("[setup] Smoke check passed — session is active");

  // Save storageState so other tests can reuse it
  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });
  await page.context().storageState({ path: AUTH_FILE });
  console.log(`[setup] Saved auth state to ${AUTH_FILE}`);
});
