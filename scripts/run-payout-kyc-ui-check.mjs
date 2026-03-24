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

let prisma;
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const tierName = "Smoke Test Tier";
const createdAuthUserIds = [];
const createdUserIds = [];
const createdChallengeIds = [];
const isSecureBaseUrl = new URL(baseUrl).protocol === "https:";

async function ensureTier() {
  const existing = await prisma.tier.findUnique({ where: { name: tierName } });
  if (existing) return existing;

  return prisma.tier.create({
    data: {
      name: tierName,
      fee: 19_00,
      fundedBankroll: 10_000_00,
      profitSplitPct: 80,
      minPicks: 1,
      guideIncluded: false,
      isActive: false,
      sortOrder: 9999,
    },
  });
}

async function createAuthUser(label) {
  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const email = `${slug}+${Date.now()}@playfunded.local`;
  const password = "PlayfundedUITest!123";
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: label },
  });
  if (error) throw error;
  createdAuthUserIds.push(data.user.id);
  return { email, password, supabaseId: data.user.id };
}

async function createAppUser({ email, supabaseId, name, country = "ES" }) {
  const user = await prisma.user.create({
    data: {
      email,
      supabaseId,
      name,
      country,
    },
  });
  createdUserIds.push(user.id);
  return user;
}

async function createFundedChallenge({ userId, tierId, startBalance, balance }) {
  const challenge = await prisma.challenge.create({
    data: {
      userId,
      tierId,
      status: "funded",
      phase: "funded",
      balance,
      startBalance,
      dailyStartBalance: startBalance,
      highestBalance: balance,
      peakBalance: balance,
      phase1StartBalance: startBalance,
      phase2StartBalance: startBalance,
      fundedAt: new Date(),
    },
  });
  createdChallengeIds.push(challenge.id);
  return challenge;
}

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

  return { cookieName, cookieValue, accessToken: session.access_token };
}

async function makeContext(browser, email, password) {
  const { cookieName, cookieValue } = await loginCookie(email, password);
  const context = await browser.newContext();
  await context.addCookies([
    {
      name: cookieName,
      value: cookieValue,
      url: baseUrl,
      httpOnly: false,
      secure: isSecureBaseUrl,
      sameSite: "Lax",
    },
  ]);
  return { context };
}

async function expectBlockedState(browser, email, password) {
  const { context } = await makeContext(browser, email, password);
  try {
    const page = await context.newPage();
    await page.goto(`${baseUrl}/en/dashboard/payouts`, { waitUntil: "domcontentloaded" });
    await page.getByText("Identity verification required").waitFor({
      state: "visible",
      timeout: 15000,
    });

    const uploadButtons = page.getByRole("button", { name: /upload file/i });
    const uploadCount = await uploadButtons.count();

    const response = await context.request.post(`${baseUrl}/api/kyc/upload`, {
      multipart: {
        file: {
          name: "doc.pdf",
          mimeType: "application/pdf",
          buffer: Buffer.from("%PDF-1.4\n% smoke\n", "utf8"),
        },
      },
    });
    const responseJson = await response.json();

    return {
      route: "/en/dashboard/payouts",
      uploadButtonsVisible: uploadCount,
      buyChallengeVisible: await page.getByRole("link", { name: /buy challenge/i }).isVisible().catch(() => false),
      apiStatus: response.status(),
      apiError: responseJson.error ?? null,
    };
  } finally {
    await context.close();
  }
}

async function expectEligibleState(browser, email, password) {
  const { context } = await makeContext(browser, email, password);
  try {
    const page = await context.newPage();
    await page.goto(`${baseUrl}/en/dashboard/payouts`, { waitUntil: "domcontentloaded" });
    await page.getByText("Identity verification required").waitFor({
      state: "visible",
      timeout: 15000,
    });

    const uploadButtons = page.getByRole("button", { name: /upload file/i });
    await uploadButtons.first().waitFor({ state: "visible", timeout: 15000 });

    return {
      route: "/en/dashboard/payouts",
      uploadButtonsVisible: await uploadButtons.count(),
      promptVisible: await page.getByText(
        "Before your first payout, you must verify your identity. This is required by our compliance policy.",
      ).isVisible(),
    };
  } finally {
    await context.close();
  }
}

try {
  prisma = await connectPrismaWithRetry();

  const tier = await ensureTier();

  const blockedAuth = await createAuthUser("Payout KYC Blocked");
  const eligibleAuth = await createAuthUser("Payout KYC Eligible");

  const blockedUser = await createAppUser({
    email: blockedAuth.email,
    supabaseId: blockedAuth.supabaseId,
    name: "Payout KYC Blocked",
  });
  const eligibleUser = await createAppUser({
    email: eligibleAuth.email,
    supabaseId: eligibleAuth.supabaseId,
    name: "Payout KYC Eligible",
  });

  await createFundedChallenge({
    userId: eligibleUser.id,
    tierId: tier.id,
    startBalance: 10_000_00,
    balance: 10_500_00,
  });

  const browser = await chromium.launch({ headless: true });
  try {
    const blocked = await expectBlockedState(browser, blockedAuth.email, blockedAuth.password);
    const eligible = await expectEligibleState(browser, eligibleAuth.email, eligibleAuth.password);

    console.log(
      JSON.stringify(
        {
          ok: true,
          baseUrl,
          blocked,
          eligible,
        },
        null,
        2,
      ),
    );
  } finally {
    await browser.close();
  }
} finally {
  if (createdChallengeIds.length > 0) {
    await prisma?.challenge.deleteMany({ where: { id: { in: createdChallengeIds } } });
  }
  if (createdUserIds.length > 0) {
    await prisma?.user.deleteMany({ where: { id: { in: createdUserIds } } });
  }
  for (const authUserId of createdAuthUserIds) {
    await supabase.auth.admin.deleteUser(authUserId);
  }
  await prisma?.$disconnect();
}
