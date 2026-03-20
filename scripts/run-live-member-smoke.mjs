import assert from "node:assert/strict";
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
const skipSignup = process.env.SKIP_SIGNUP === "1";

let prisma;
const createdAuthUserIds = [];
const createdUserIds = [];
const createdChallengeIds = [];
const createdPickIds = [];
const createdTierIds = [];
const createdOddsIds = [];

const stamp = `${Date.now()}`;
const memberEmail = `live-member-smoke+${stamp}@example.com`;
const memberPassword = "PlayfundedMember!123";
const signupEmail = `live.signup.smoke.${stamp}@example.com`;
const signupPassword = "PlayfundedSignup!123";
const tierName = `Live Smoke Tier ${stamp.slice(-6)}`;
const oddsEventId = `live-smoke-event-${stamp}`;
const oddsEventName = `Smoke Live Event ${stamp.slice(-4)} A vs B`;

function textMatch(value) {
  return value.replace(/\s+/g, " ").trim();
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
  return data.user;
}

async function createFixtureUser() {
  const authUser = await createAuthUser(
    memberEmail,
    memberPassword,
    "Live Member Smoke",
  );

  const user = await prisma.user.create({
    data: {
      email: memberEmail,
      supabaseId: authUser.id,
      name: "Live Member Smoke",
      country: "ES",
    },
  });
  createdUserIds.push(user.id);

  const tier = await prisma.tier.create({
    data: {
      name: tierName,
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
      userId: user.id,
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

  const startTime = new Date(Date.now() + 3 * 60 * 60 * 1000);
  const odds = await prisma.oddsCache.create({
    data: {
      sport: "basketball",
      league: "nba",
      event: oddsEventId,
      eventName: oddsEventName,
      startTime,
      provider: "smoke",
      isLive: false,
      markets: [
        {
          type: "moneyline",
          key: "moneyline",
          outcomes: [
            { name: "Home", odds: 1.91 },
            { name: "Away", odds: 1.91 },
          ],
        },
      ],
    },
  });
  createdOddsIds.push(odds.id);

  return { authUser, user, tier, challenge, odds };
}

async function deleteAuthUsersByEmail(email) {
  const pageSize = 200;
  for (let page = 1; page <= 5; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: pageSize,
    });
    if (error) throw error;
    const matched = (data.users ?? []).filter((user) => user.email === email);
    if (matched.length === 0 && (data.users?.length ?? 0) < pageSize) break;
    for (const user of matched) {
      await supabase.auth.admin.deleteUser(user.id);
    }
    if ((data.users?.length ?? 0) < pageSize) break;
  }
}

async function loginViaUi(page, loginPath, email, password) {
  await page.goto(`${baseUrl}${loginPath}`, { waitUntil: "domcontentloaded" });
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  const submit = page.locator('form button[type="submit"]').first();
  await submit.click();
  await page.waitForFunction(
    () => !window.location.pathname.includes("/auth/login"),
    undefined,
    { timeout: 30000 },
  );
  const currentUrl = page.url();
  if (currentUrl.includes("/auth/login")) {
    const body = textMatch(await page.locator("body").innerText());
    throw new Error(
      `Login from ${loginPath} stayed on auth/login: ${currentUrl}. Body: ${body.slice(0, 1200)}`,
    );
  }
  return currentUrl;
}

async function signOutIfVisible(page) {
  const signOut = page.getByRole("button", {
    name: /sign out|cerrar sesión|cerrar sesion|sair/i,
  });
  if (await signOut.count()) {
    await signOut.first().click();
    await page.waitForURL(/\/(auth\/login|en|pt-BR|$)/, { timeout: 15000 }).catch(() => {});
  }
}

async function runSignupSmoke(page) {
  await page.goto(`${baseUrl}/en/auth/signup`, { waitUntil: "domcontentloaded" });
  await page.locator('input[name="name"]').fill("Live Signup Smoke");
  await page.locator('input[type="email"]').fill(signupEmail);
  await page.locator('input[type="password"]').fill(signupPassword);
  await page.locator('form button[type="submit"]').click();
  try {
    await page.waitForURL(/\/auth\/verify|\/dashboard/, { timeout: 30000 });
  } catch (error) {
    const currentUrl = page.url();
    const body = textMatch(await page.locator("body").innerText());
    throw new Error(
      `Signup did not redirect. Current URL: ${currentUrl}. Body: ${body.slice(0, 1200)}`,
      { cause: error },
    );
  }
  return {
    finalUrl: page.url(),
  };
}

async function runEnglishMemberFlow(browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    const loginUrl = await loginViaUi(page, "/en/auth/login", memberEmail, memberPassword);

    await page.goto(`${baseUrl}/en/dashboard`, { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: /dashboard/i }).waitFor({ timeout: 15000 });

    await page.goto(`${baseUrl}/en/challenges`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => {});
    await page.waitForTimeout(2000);
    const buyButtons = page.getByRole("button", {
      name: /buy challenge|buy now|comprar/i,
    });
    const firstBuyButton = buyButtons.first();
    await firstBuyButton.waitFor({ timeout: 15000 });
    await firstBuyButton.click();
    const modalHeading = page.getByText(
      /how do you want to pay|select payment method/i,
    ).first();
    await modalHeading.waitFor({ state: "visible", timeout: 15000 });
    const closeButton = page.locator("div.fixed.inset-0").locator("button").first();
    await closeButton.click();
    await modalHeading.waitFor({ state: "hidden", timeout: 10000 });

    await page.goto(`${baseUrl}/en/dashboard/settings`, { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: /settings/i }).waitFor({ timeout: 15000 });
    await page.locator('input[type="number"]').first().waitFor({ timeout: 15000 });

    await page.goto(`${baseUrl}/en/challenges`, { waitUntil: "domcontentloaded" });
    const chatButton = page.getByRole("button", { name: /open chat/i });
    await chatButton.waitFor({ timeout: 15000 });
    await chatButton.click();
    await page.getByText(/PlayFunded Support/i).waitFor({ timeout: 10000 });
    const chatInput = page.locator('input[placeholder*="Ask"]').first();
    await chatInput.fill("What is Phase 1 target?");
    await chatInput.press("Enter");
    await page.waitForTimeout(2000);
    const spinner = page.locator('[class*="animate-spin"]').first();
    await spinner.waitFor({ state: "hidden", timeout: 30000 }).catch(() => {});
    const chatText = textMatch(await page.locator("body").innerText());
    assert(
      /20|temporarily unavailable|chat unavailable/i.test(chatText),
      `Chat did not return expected response: ${chatText.slice(0, 1200)}`,
    );

    await page.goto(`${baseUrl}/en/dashboard/picks`, { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: /place a pick/i }).waitFor({ timeout: 15000 });
    await page.getByText(oddsEventName).waitFor({ timeout: 15000 });
    await page.getByRole("button", { name: /^Home 1\.91$/ }).first().click().catch(async () => {
      await page.getByRole("button", { name: /Home/i }).first().click();
    });
    const stakeInput = page.locator("#stake-input");
    await stakeInput.waitFor({ timeout: 10000 });
    await stakeInput.fill("10");
    const confirmPickButton = page.getByRole("button", { name: /confirm pick|place pick/i }).first();
    await confirmPickButton.click();
    await page.getByText(/pick placed/i).waitFor({ timeout: 15000 });
    await page.getByText(/\$10\.00/).first().waitFor({ timeout: 10000 });

    await signOutIfVisible(page);

    return {
      loginUrl,
      finalUrl: page.url(),
    };
  } finally {
    await context.close();
  }
}

async function runLocaleLoginSmoke(browser, loginPath, dashboardPath, challengesPath, settingsPath) {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    const loginUrl = await loginViaUi(page, loginPath, memberEmail, memberPassword);

    for (const route of [dashboardPath, challengesPath, settingsPath]) {
      await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded" });
      const body = textMatch(await page.locator("body").innerText());
      assert(
        !/application error|internal server error|page not found/i.test(body),
        `${route} rendered fatal text: ${body.slice(0, 800)}`,
      );
    }

    return {
      loginPath,
      loginUrl,
      dashboardPath,
      challengesPath,
      settingsPath,
      finalUrl: page.url(),
    };
  } finally {
    await context.close();
  }
}

try {
  prisma = await connectPrismaWithRetry();
  await createFixtureUser();

  const browser = await chromium.launch({ headless: true, channel: "chrome" });
  try {
    let signup = null;
    if (!skipSignup) {
      const signupContext = await browser.newContext();
      const signupPage = await signupContext.newPage();
      signup = await runSignupSmoke(signupPage);
      await signupContext.close();
    }

    const english = await runEnglishMemberFlow(browser);
    const defaultLocale = await runLocaleLoginSmoke(
      browser,
      "/auth/login",
      "/dashboard",
      "/challenges",
      "/dashboard/settings",
    );
    const portuguese = await runLocaleLoginSmoke(
      browser,
      "/pt-BR/auth/login",
      "/pt-BR/dashboard",
      "/pt-BR/challenges",
      "/pt-BR/dashboard/settings",
    );

    console.log(
      JSON.stringify(
        {
          ok: true,
          baseUrl,
          signup,
          english,
          defaultLocale,
          portuguese,
        },
        null,
        2,
      ),
    );
  } finally {
    await browser.close();
  }
} finally {
  await deleteAuthUsersByEmail(signupEmail).catch(() => {});
  await prisma?.pick.deleteMany({
    where: {
      OR: [
        createdPickIds.length > 0 ? { id: { in: createdPickIds } } : undefined,
        createdChallengeIds.length > 0 ? { challengeId: { in: createdChallengeIds } } : undefined,
        createdUserIds.length > 0 ? { userId: { in: createdUserIds } } : undefined,
      ].filter(Boolean),
    },
  }).catch(() => {});
  if (createdChallengeIds.length > 0) {
    await prisma?.challenge.deleteMany({ where: { id: { in: createdChallengeIds } } }).catch(() => {});
  }
  if (createdOddsIds.length > 0) {
    await prisma?.oddsCache.deleteMany({ where: { id: { in: createdOddsIds } } }).catch(() => {});
  }
  await prisma?.user.deleteMany({
    where: {
      OR: [
        createdUserIds.length > 0 ? { id: { in: createdUserIds } } : undefined,
        { email: signupEmail },
      ].filter(Boolean),
    },
  }).catch(() => {});
  if (createdTierIds.length > 0) {
    await prisma?.tier.deleteMany({ where: { id: { in: createdTierIds } } }).catch(() => {});
  }
  for (const authUserId of createdAuthUserIds) {
    await supabase.auth.admin.deleteUser(authUserId).catch(() => {});
  }
  await prisma?.$disconnect();
}
