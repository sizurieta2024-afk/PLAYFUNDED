import assert from "node:assert/strict";
import crypto from "node:crypto";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { connectPrismaWithRetry } from "./lib/prisma-smoke.mjs";

const baseUrl = process.env.BASE_URL ?? "http://localhost:3004";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  throw new Error("Supabase env vars are required");
}

const adminSupabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const publicSupabase = createClient(supabaseUrl, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function buildRecoveryHash(session) {
  const expiresAt =
    session.expires_at ??
    Math.floor(Date.now() / 1000) + (session.expires_in ?? 3600);
  const params = new URLSearchParams({
    access_token: session.access_token,
    expires_at: String(expiresAt),
    expires_in: String(session.expires_in ?? 3600),
    refresh_token: session.refresh_token,
    token_type: session.token_type ?? "bearer",
    type: "recovery",
  });
  return params.toString();
}

function hasFatalText(text) {
  return /application error|internal server error|unhandled runtime error|page not found/i.test(
    text,
  );
}

let prisma;
let userId = null;

try {
  prisma = await connectPrismaWithRetry();

  const stamp = Date.now();
  const email = `password-reset-smoke+${stamp}-${crypto.randomBytes(3).toString("hex")}@playfunded.local`;
  const originalPassword = "PlayfundedReset!123";
  const updatedPassword = "PlayfundedReset!456";

  const { data: createdUser, error: createError } =
    await adminSupabase.auth.admin.createUser({
      email,
      password: originalPassword,
      email_confirm: true,
      user_metadata: { full_name: "Password Reset Smoke" },
    });
  if (createError) throw createError;
  userId = createdUser.user.id;

  const { data: linkData, error: linkError } =
    await adminSupabase.auth.admin.generateLink({
      type: "recovery",
      email,
      options: {
        redirectTo: `${baseUrl.replace(/\/$/, "")}/auth/callback?next=${encodeURIComponent("/en/auth/reset-password?mode=recovery")}`,
      },
    });
  if (linkError) throw linkError;

  const recoveryOtp = linkData.properties.email_otp;
  assert(recoveryOtp, "Recovery OTP was missing from generated link data");

  const { data: recoveryData, error: recoveryError } =
    await publicSupabase.auth.verifyOtp({
      email,
      token: recoveryOtp,
      type: "recovery",
    });
  if (recoveryError) throw recoveryError;
  assert(recoveryData.session, "Recovery session was not created");

  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({
      ignoreHTTPSErrors: baseUrl.startsWith("https://"),
    });
    const page = await context.newPage();

    const entryUrl = `${baseUrl.replace(/\/$/, "")}/en/dashboard#${buildRecoveryHash(recoveryData.session)}`;
    const response = await page.goto(entryUrl, { waitUntil: "domcontentloaded" });
    assert(response, "No response for recovery entry page");

    await page.waitForURL(
      (current) =>
        current.pathname === "/en/auth/reset-password" &&
        current.searchParams.get("mode") === "recovery",
      { timeout: 20_000 },
    );

    await page.locator('input[name="password"]').fill(updatedPassword);
    await page.locator('input[name="confirmPassword"]').fill(updatedPassword);
    await page.locator('button[type="submit"]').click();

    await page.waitForURL(
      (current) =>
        current.pathname === "/en/auth/login" &&
        current.searchParams.get("reset") === "success",
      { timeout: 20_000 },
    );

    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="password"]').fill(updatedPassword);
    await page.locator('button[type="submit"]').click();

    await page.waitForURL(
      (current) => current.pathname === "/en/dashboard",
      { timeout: 20_000 },
    );

    const body = await page.locator("body").innerText();
    assert(
      !hasFatalText(body),
      `Password reset smoke hit fatal text: ${body.slice(0, 500).replace(/\s+/g, " ")}`,
    );

    console.log(
      JSON.stringify(
        {
          ok: true,
          baseUrl,
          email,
          checks: [
            "recovery session landed on reset-password",
            "password updated successfully",
            "login with updated password reached dashboard",
          ],
          finalUrl: page.url(),
        },
        null,
        2,
      ),
    );
  } finally {
    await browser.close();
  }
} finally {
  if (userId) {
    await prisma?.user.deleteMany({ where: { supabaseId: userId } });
    await adminSupabase.auth.admin.deleteUser(userId);
  }
  await prisma?.$disconnect();
}
