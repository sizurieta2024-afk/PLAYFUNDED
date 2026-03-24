import assert from "node:assert/strict";
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";

const baseUrl = process.env.BASE_URL ?? "https://playfunded.lat";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  throw new Error("Supabase env vars are required");
}

const prisma = new PrismaClient();
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const stamp = `${Date.now()}`;
const email = `live.min.stake.${stamp}@example.com`;
const password = "PlayfundedMinStake!123";
const tierName = `Min Stake Tier ${stamp.slice(-6)}`;
const oddsEventId = `min-stake-event-${stamp}`;
const oddsEventName = `Min Stake Event ${stamp.slice(-4)} Home vs Away`;

const createdAuthUserIds = [];
const createdUserIds = [];
const createdChallengeIds = [];
const createdTierIds = [];
const createdOddsIds = [];
const createdPickIds = [];

async function createAuthUser() {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Min Stake Smoke" },
  });
  if (error) throw error;
  createdAuthUserIds.push(data.user.id);
  return data.user;
}

async function deleteAuthUsersByEmail(targetEmail) {
  const { data, error } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (error) throw error;
  const matched = (data.users ?? []).filter((user) => user.email === targetEmail);
  for (const user of matched) {
    await supabase.auth.admin.deleteUser(user.id);
  }
}

async function createFixture() {
  const authUser = await createAuthUser();
  const user = await prisma.user.create({
    data: {
      email,
      supabaseId: authUser.id,
      name: "Min Stake Smoke",
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
}

async function cleanup() {
  if (createdPickIds.length > 0) {
    await prisma.pick.deleteMany({ where: { id: { in: createdPickIds } } }).catch(() => {});
  }
  if (createdChallengeIds.length > 0) {
    await prisma.challenge.deleteMany({ where: { id: { in: createdChallengeIds } } }).catch(() => {});
  }
  if (createdOddsIds.length > 0) {
    await prisma.oddsCache.deleteMany({ where: { id: { in: createdOddsIds } } }).catch(() => {});
  }
  if (createdUserIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } }).catch(() => {});
  }
  if (createdTierIds.length > 0) {
    await prisma.tier.deleteMany({ where: { id: { in: createdTierIds } } }).catch(() => {});
  }
  await deleteAuthUsersByEmail(email).catch(() => {});
  await prisma.$disconnect();
}

async function login(page) {
  await page.goto(`${baseUrl}/en/auth/login`, { waitUntil: "domcontentloaded" });
  const form = page.locator("form").filter({ has: page.locator('input[type="email"]') }).first();
  await form.waitFor({ state: "visible", timeout: 15000 });
  await form.locator('input[name="email"]').first().fill(email);
  await form.locator('input[name="password"]').first().fill(password);
  await form.locator('button[type="submit"]').first().click();
  await page.waitForFunction(() => !window.location.pathname.includes("/auth/login"), undefined, {
    timeout: 30000,
  });
}

const browser = await chromium.launch({ headless: true, channel: "chrome" });

try {
  await createFixture();
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page);
  await page.goto(`${baseUrl}/en/dashboard/picks`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: /place a pick/i }).waitFor({ timeout: 15000 });
  await page.getByText(oddsEventName).waitFor({ timeout: 15000 });
  await page.getByRole("button", { name: /^Home 1\.91$/ }).first().click().catch(async () => {
    await page.getByRole("button", { name: /Home/i }).first().click();
  });

  const stakeInput = page.locator("#stake-input");
  await stakeInput.waitFor({ timeout: 10000 });
  await stakeInput.fill("1");
  const stakeError = page.getByText("Min $10.00").first();
  await stakeError.waitFor({ state: "visible", timeout: 10000 });

  const confirmButton = page.getByRole("button", { name: /confirm pick|place pick/i }).first();
  await expectDisabled(confirmButton);

  await stakeInput.fill("10");
  await stakeError.waitFor({ state: "hidden", timeout: 10000 });
  await expectEnabled(confirmButton);

  console.log(
    JSON.stringify(
      {
        ok: true,
        baseUrl,
        minimumShown: await stakeError.textContent().catch(() => "Min $10.00"),
        validStake: "10.00",
      },
      null,
      2,
    ),
  );

  await context.close();
} finally {
  await browser.close();
  await cleanup();
}

async function expectDisabled(locator) {
  await locator.waitFor({ state: "visible", timeout: 10000 });
  const disabled = await locator.isDisabled();
  assert.equal(disabled, true, "Confirm button should be disabled");
}

async function expectEnabled(locator) {
  await locator.waitFor({ state: "visible", timeout: 10000 });
  await locator.waitFor({ state: "attached", timeout: 10000 });
  const disabled = await locator.isDisabled();
  assert.equal(disabled, false, "Confirm button should be enabled");
}
