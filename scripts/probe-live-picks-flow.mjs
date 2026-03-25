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
const createdOddsIds = [];

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

async function loginCookie(email, password) {
  const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    throw new Error(`login failed: ${res.status} ${await res.text()}`);
  }
  const session = await res.json();
  const ref = new URL(supabaseUrl).hostname.split(".")[0];
  return {
    name: `sb-${ref}-auth-token`,
    value:
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
      ).toString("base64"),
  };
}

function text(value) {
  return (value || "").replace(/\s+/g, " ").trim();
}

try {
  prisma = await connectPrismaWithRetry();
  const stamp = Date.now().toString();
  const email = `probe-picks-${stamp}@example.com`;
  const password = "PlayfundedMember!123";
  const authUserId = await createAuthUser(email, password, "Probe Picks");
  const user = await prisma.user.create({
    data: {
      email,
      supabaseId: authUserId,
      name: "Probe Picks",
      country: "ES",
    },
  });
  createdUserIds.push(user.id);

  const tier = await prisma.tier.create({
    data: {
      name: `Probe Picks Tier ${stamp.slice(-6)}`,
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

  const odds = await prisma.oddsCache.create({
    data: {
      sport: "basketball",
      league: "nba",
      event: `probe-picks-event-${stamp}`,
      eventName: `Probe Picks Event ${stamp.slice(-4)} A vs B`,
      startTime: new Date(Date.now() + 3 * 60 * 60 * 1000),
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

  const browser = await chromium.launch({ headless: true, channel: "chrome" });
  try {
    const context = await browser.newContext();
    const cookie = await loginCookie(email, password);
    await context.addCookies([
      {
        ...cookie,
        url: baseUrl,
        httpOnly: false,
        secure: true,
        sameSite: "Lax",
      },
    ]);
    const page = await context.newPage();

    await page.goto(`${baseUrl}/en/dashboard/picks`, { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: /place a pick/i }).waitFor({ timeout: 15000 });
    const pickResponse = await page.evaluate(
      async ({ challengeId, odds }) => {
        const response = await fetch("/api/picks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            challengeId,
            sport: odds.sport,
            league: odds.league,
            event: odds.event,
            eventName: odds.eventName,
            marketType: "moneyline",
            selection: "Home",
            odds: 1.91,
            stake: 1000,
          }),
        });

        return {
          status: response.status,
          body: await response.text(),
        };
      },
      {
        challengeId: challenge.id,
        odds: {
          sport: odds.sport,
          league: odds.league,
          event: odds.event,
          eventName: odds.eventName,
        },
      },
    );
    await page.waitForTimeout(2000);

    const body = text(await page.locator("body").innerText());
    const dbPicks = await prisma.pick.findMany({
      where: { challengeId: challenge.id },
      orderBy: { placedAt: "desc" },
      take: 5,
      select: {
        selection: true,
        status: true,
        stake: true,
        eventName: true,
      },
    });

    console.log(JSON.stringify({
      ok: true,
      url: page.url(),
      pickResponse,
      body: body.slice(0, 2500),
      dbPicks,
    }, null, 2));

    await context.close();
  } finally {
    await browser.close();
  }
} finally {
  await prisma?.pick.deleteMany({ where: { challengeId: { in: createdChallengeIds } } }).catch(() => {});
  await prisma?.challenge.deleteMany({ where: { id: { in: createdChallengeIds } } }).catch(() => {});
  await prisma?.oddsCache.deleteMany({ where: { id: { in: createdOddsIds } } }).catch(() => {});
  await prisma?.tier.deleteMany({ where: { id: { in: createdTierIds } } }).catch(() => {});
  await prisma?.user.deleteMany({ where: { id: { in: createdUserIds } } }).catch(() => {});
  for (const authUserId of createdAuthUserIds) {
    await supabase.auth.admin.deleteUser(authUserId).catch(() => {});
  }
  await prisma?.$disconnect();
}
