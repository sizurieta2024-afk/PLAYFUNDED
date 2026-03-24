import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { connectPrismaWithRetry } from "./lib/prisma-smoke.mjs";

const baseUrl = process.env.BASE_URL ?? "https://playfunded.lat";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  throw new Error("Supabase env vars are required");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let prisma;
const createdAuthUserIds = [];
const createdUserIds = [];
const createdTierIds = [];
const createdChallengeIds = [];

async function loginCookie(email, password) {
  const loginResponse = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
    body: JSON.stringify({ email, password }),
  });
  if (!loginResponse.ok) {
    throw new Error(`Supabase login failed: ${loginResponse.status} ${await loginResponse.text()}`);
  }
  const session = await loginResponse.json();
  const ref = new URL(supabaseUrl).hostname.split(".")[0];
  const cookieName = `sb-${ref}-auth-token`;
  const cookieValue =
    "base64-" +
    Buffer.from(
      JSON.stringify({
        access_token: session.access_token,
        token_type: "bearer",
        expires_in: 3600,
        expires_at: session.expires_at,
        refresh_token: session.refresh_token,
        user: session.user,
      }),
    ).toString("base64");
  return { cookieName, cookieValue };
}

async function createAuthUser(email, password, fullName) {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error) throw error;
  createdAuthUserIds.push(data.user.id);
  return data.user.id;
}

function text(value) {
  return (value || "").replace(/\s+/g, " ").trim();
}

try {
  prisma = await connectPrismaWithRetry();
  const stamp = Date.now().toString();

  const adminEmail = `probe-admin-${stamp}@example.com`;
  const adminPassword = "PlayfundedAdmin!123";
  const adminSupabaseId = await createAuthUser(adminEmail, adminPassword, "Probe Admin");
  const admin = await prisma.user.create({
    data: {
      email: adminEmail,
      supabaseId: adminSupabaseId,
      name: "Probe Admin",
      country: "ES",
      role: "admin",
    },
  });
  createdUserIds.push(admin.id);

  const banTarget = await prisma.user.create({
    data: {
      email: `probe-ban-target-${stamp}@example.com`,
      supabaseId: `probe-ban-target-${stamp}`,
      name: "Probe Ban Target",
      country: "ES",
    },
  });
  createdUserIds.push(banTarget.id);

  const memberEmail = `probe-member-${stamp}@example.com`;
  const memberPassword = "PlayfundedMember!123";
  const memberSupabaseId = await createAuthUser(memberEmail, memberPassword, "Probe Member");
  const member = await prisma.user.create({
    data: {
      email: memberEmail,
      supabaseId: memberSupabaseId,
      name: "Probe Member",
      country: "ES",
    },
  });
  createdUserIds.push(member.id);

  const tier = await prisma.tier.create({
    data: {
      name: `Probe Tier ${stamp.slice(-6)}`,
      fee: 1900,
      fundedBankroll: 100000,
      profitSplitPct: 80,
      minPicks: 1,
      guideIncluded: false,
      isActive: false,
      sortOrder: 9999,
    },
  });
  createdTierIds.push(tier.id);

  const challenge = await prisma.challenge.create({
    data: {
      userId: member.id,
      tierId: tier.id,
      status: "active",
      phase: "phase1",
      balance: 100000,
      startBalance: 100000,
      dailyStartBalance: 100000,
      highestBalance: 100000,
      peakBalance: 100000,
      phase1StartBalance: 100000,
    },
  });
  createdChallengeIds.push(challenge.id);

  const browser = await chromium.launch({ headless: true, channel: "chrome" });
  try {
    const { cookieName: adminCookieName, cookieValue: adminCookieValue } = await loginCookie(
      adminEmail,
      adminPassword,
    );
    const adminContext = await browser.newContext();
    await adminContext.addCookies([
      {
        name: adminCookieName,
        value: adminCookieValue,
        url: baseUrl,
        httpOnly: false,
        secure: new URL(baseUrl).protocol === "https:",
        sameSite: "Lax",
      },
    ]);
    const adminPage = await adminContext.newPage();
    await adminPage.goto(`${baseUrl}/en/admin/users/${banTarget.id}`, { waitUntil: "domcontentloaded" });
    await adminPage.getByRole("button", { name: "Ban user" }).click();
    await adminPage.waitForTimeout(2000);
    const adminBody = text(await adminPage.locator("body").innerText());

    const { cookieName: memberCookieName, cookieValue: memberCookieValue } = await loginCookie(
      memberEmail,
      memberPassword,
    );
    const memberContext = await browser.newContext();
    await memberContext.addCookies([
      {
        name: memberCookieName,
        value: memberCookieValue,
        url: baseUrl,
        httpOnly: false,
        secure: new URL(baseUrl).protocol === "https:",
        sameSite: "Lax",
      },
    ]);
    const memberPage = await memberContext.newPage();
    await memberPage.goto(`${baseUrl}/en/challenges`, { waitUntil: "domcontentloaded" });
    await memberPage.getByRole("button", { name: /buy challenge|buy now|comprar/i }).first().click();
    await memberPage.waitForTimeout(2000);
    await memberPage.keyboard.press("Escape");
    await memberPage.waitForTimeout(2000);
    const memberBody = text(await memberPage.locator("body").innerText());

    console.log(JSON.stringify({
      ok: true,
      admin: {
        url: adminPage.url(),
        body: adminBody.slice(0, 2000),
      },
      member: {
        url: memberPage.url(),
        body: memberBody.slice(0, 2000),
      },
    }, null, 2));

    await adminContext.close();
    await memberContext.close();
  } finally {
    await browser.close();
  }
} finally {
  await prisma?.pick.deleteMany({ where: { challengeId: { in: createdChallengeIds } } }).catch(() => {});
  await prisma?.challenge.deleteMany({ where: { id: { in: createdChallengeIds } } }).catch(() => {});
  await prisma?.tier.deleteMany({ where: { id: { in: createdTierIds } } }).catch(() => {});
  await prisma?.user.deleteMany({ where: { id: { in: createdUserIds } } }).catch(() => {});
  for (const authUserId of createdAuthUserIds) {
    await supabase.auth.admin.deleteUser(authUserId).catch(() => {});
  }
  await prisma?.$disconnect();
}
