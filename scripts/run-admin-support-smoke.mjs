import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import assert from "node:assert/strict";
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

const createdAuthUserIds = [];
const createdUserIds = [];
const createdChallengeIds = [];
const createdPickIds = [];
const createdPayoutIds = [];
const createdKycIds = [];
const createdAuditIds = [];
const createdTierIds = [];
let fixtureResourceIds = null;
const isSecureBaseUrl = new URL(baseUrl).protocol === "https:";

async function waitFor(check, timeoutMs = 15000, intervalMs = 250) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const result = await check();
    if (result) return result;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`Timed out after ${timeoutMs}ms`);
}

async function createAuthUser(label) {
  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const email = `${slug}+${Date.now()}@playfunded.local`;
  const password = "PlayfundedAdmin!123";
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

async function buildFixture() {
  const suffix = Date.now().toString().slice(-8);
  const tier = await prisma.tier.create({
    data: {
      name: `Admin Smoke Tier ${suffix}`,
      fee: 1_999,
      fundedBankroll: 10_000,
      profitSplitPct: 80,
      minPicks: 10,
      guideIncluded: false,
      isActive: false,
      sortOrder: 9999,
    },
  });
  createdTierIds.push(tier.id);

  const adminAuth = await createAuthUser("Admin Support Smoke");
  const admin = await prisma.user.create({
    data: {
      email: adminAuth.email,
      supabaseId: adminAuth.supabaseId,
      name: "Admin Support Smoke",
      country: "ES",
      role: "admin",
    },
  });
  createdUserIds.push(admin.id);

  const banTarget = await prisma.user.create({
    data: {
      email: `ban-target-${suffix}@example.com`,
      supabaseId: `ban-target-${suffix}`,
      name: "Ban Target",
      country: "ES",
    },
  });
  createdUserIds.push(banTarget.id);

  const payoutUser = await prisma.user.create({
    data: {
      email: `payout-user-${suffix}@example.com`,
      supabaseId: `payout-user-${suffix}`,
      name: "Payout User",
      country: "ES",
    },
  });
  createdUserIds.push(payoutUser.id);

  const payoutChallenge = await prisma.challenge.create({
    data: {
      userId: payoutUser.id,
      tierId: tier.id,
      status: "funded",
      phase: "funded",
      balance: 11_000,
      startBalance: 10_000,
      dailyStartBalance: 11_000,
      highestBalance: 12_000,
      peakBalance: 12_000,
      phase1StartBalance: 10_000,
      phase2StartBalance: 10_000,
      fundedAt: new Date(),
    },
  });
  createdChallengeIds.push(payoutChallenge.id);

  const rejectedPayout = await prisma.payout.create({
    data: {
      userId: payoutUser.id,
      challengeId: payoutChallenge.id,
      amount: 800,
      splitPct: 80,
      method: "usdt",
      status: "pending",
      providerData: {
        requestedProfitAmount: 1_000,
        grossProfit: 2_000,
        priorBalance: 12_000,
        newBalance: 11_000,
      },
    },
  });
  createdPayoutIds.push(rejectedPayout.id);

  const rejectedKycUser = await prisma.user.create({
    data: {
      email: `kyc-reject-${suffix}@example.com`,
      supabaseId: `kyc-reject-${suffix}`,
      name: "KYC Reject User",
      country: "ES",
    },
  });
  createdUserIds.push(rejectedKycUser.id);

  const rejectedKyc = await prisma.kycSubmission.create({
    data: {
      userId: rejectedKycUser.id,
      status: "pending",
      fullName: "KYC Reject User",
      dateOfBirth: new Date("1990-01-01T00:00:00.000Z"),
      country: "ES",
      idType: "passport",
      idFrontUrl: `proof://reject/${suffix}`,
    },
  });
  createdKycIds.push(rejectedKyc.id);

  const approvedKycUser = await prisma.user.create({
    data: {
      email: `kyc-approve-${suffix}@example.com`,
      supabaseId: `kyc-approve-${suffix}`,
      name: "KYC Approve User",
      country: "ES",
    },
  });
  createdUserIds.push(approvedKycUser.id);

  const approvedKyc = await prisma.kycSubmission.create({
    data: {
      userId: approvedKycUser.id,
      status: "pending",
      fullName: "KYC Approve User",
      dateOfBirth: new Date("1991-02-02T00:00:00.000Z"),
      country: "ES",
      idType: "passport",
      idFrontUrl: `proof://approve/${suffix}`,
    },
  });
  createdKycIds.push(approvedKyc.id);

  const settleUser = await prisma.user.create({
    data: {
      email: `settle-user-${suffix}@example.com`,
      supabaseId: `settle-user-${suffix}`,
      name: "Settle User",
      country: "ES",
    },
  });
  createdUserIds.push(settleUser.id);

  const settleChallenge = await prisma.challenge.create({
    data: {
      userId: settleUser.id,
      tierId: tier.id,
      status: "active",
      phase: "phase1",
      balance: 10_000,
      startBalance: 10_000,
      dailyStartBalance: 10_000,
      highestBalance: 10_000,
      peakBalance: 10_000,
      phase1StartBalance: 10_000,
    },
  });
  createdChallengeIds.push(settleChallenge.id);

  const pendingPick = await prisma.pick.create({
    data: {
      challengeId: settleChallenge.id,
      userId: settleUser.id,
      sport: "basketball",
      league: "nba",
      event: `manual-settle-${suffix}`,
      eventName: "Manual Settlement Smoke",
      marketType: "moneyline",
      selection: "Home",
      odds: 2,
      stake: 1_000,
      potentialPayout: 2_000,
      eventStart: new Date("2025-01-01T00:00:00.000Z"),
    },
  });
  createdPickIds.push(pendingPick.id);

  return {
    adminAuth,
    ids: {
      adminId: admin.id,
      banTargetId: banTarget.id,
      rejectedPayoutId: rejectedPayout.id,
      payoutChallengeId: payoutChallenge.id,
      rejectedKycId: rejectedKyc.id,
      approvedKycId: approvedKyc.id,
      pendingPickId: pendingPick.id,
      settleChallengeId: settleChallenge.id,
    },
  };
}

async function collectAuditIds(adminId) {
  const rows = await prisma.auditLog.findMany({
    where: { adminId },
    select: { id: true },
  });
  createdAuditIds.push(...rows.map((row) => row.id));
}

try {
  prisma = await connectPrismaWithRetry();

  const fixture = await buildFixture();
  fixtureResourceIds = fixture.ids;
  const { cookieName, cookieValue } = await loginCookie(
    fixture.adminAuth.email,
    fixture.adminAuth.password,
  );

  const browser = await chromium.launch({ headless: true });
  try {
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

    const kycRejectResponse = await context.request.patch(`${baseUrl}/api/admin/kyc`, {
      data: {
        submissionId: fixture.ids.rejectedKycId,
        action: "reject",
        reviewNote: "smoke reject",
      },
    });
    const kycApproveResponse = await context.request.patch(`${baseUrl}/api/admin/kyc`, {
      data: {
        submissionId: fixture.ids.approvedKycId,
        action: "approve",
      },
    });

    const payoutRejectResponse = await context.request.patch(`${baseUrl}/api/admin/payouts`, {
      data: {
        payoutId: fixture.ids.rejectedPayoutId,
        action: "reject",
        adminNote: "smoke reject",
      },
    });
    const restoredChallenge = await prisma.challenge.findUnique({
      where: { id: fixture.ids.payoutChallengeId },
      select: { balance: true },
    });

    const approvedPayout = await prisma.payout.create({
      data: {
        userId: (await prisma.challenge.findUniqueOrThrow({
          where: { id: fixture.ids.payoutChallengeId },
          select: { userId: true },
        })).userId,
        challengeId: fixture.ids.payoutChallengeId,
        amount: 1_200,
        splitPct: 80,
        method: "usdt",
        status: "pending",
        providerData: {
          requestedProfitAmount: 1_500,
          grossProfit: 2_000,
          priorBalance: 12_000,
          newBalance: 10_500,
        },
      },
    });
    createdPayoutIds.push(approvedPayout.id);
    await prisma.challenge.update({
      where: { id: fixture.ids.payoutChallengeId },
      data: { balance: 10_500 },
    });

    const payoutApproveResponse = await context.request.patch(`${baseUrl}/api/admin/payouts`, {
      data: {
        payoutId: approvedPayout.id,
        action: "approve",
        txRef: `smoke-tx-${Date.now()}`,
      },
    });

    const settleResponse = await context.request.post(`${baseUrl}/api/admin/picks/settle`, {
      data: {
        pickId: fixture.ids.pendingPickId,
        status: "won",
      },
    });

    const page = await context.newPage();
    await page.goto(`${baseUrl}/en/admin/users/${fixture.ids.banTargetId}`, {
      waitUntil: "domcontentloaded",
    });
    await page.getByRole("button", { name: "Ban user" }).click();
    const banReasonInput = page.locator('input[placeholder="Ban reason (required)"]').first();
    await banReasonInput.waitFor({ state: "attached", timeout: 15000 });
    await banReasonInput.scrollIntoViewIfNeeded().catch(() => {});
    await page
      .waitForFunction(() => {
        const input = document.querySelector(
          'input[placeholder="Ban reason (required)"]',
        );
        if (!input) return false;
        const style = window.getComputedStyle(input);
        return style.display !== "none" && style.visibility !== "hidden";
      }, undefined, { timeout: 15000 })
      .catch(() => {});
    await banReasonInput.fill("smoke policy violation");
    await page.getByRole("button", { name: "Confirm ban" }).click();
    await page.getByText(/BANNED:/).waitFor({ state: "visible", timeout: 15000 });

    await page.getByRole("button", { name: "Unban user" }).click();
    await page.getByRole("button", { name: "Ban user" }).waitFor({
      state: "visible",
      timeout: 15000,
    });

    const [
      rejectedKyc,
      approvedKyc,
      rejectedPayout,
      approvedPayoutRow,
      payoutChallenge,
      settledPick,
      settleChallenge,
    ] = await Promise.all([
      prisma.kycSubmission.findUnique({ where: { id: fixture.ids.rejectedKycId } }),
      prisma.kycSubmission.findUnique({ where: { id: fixture.ids.approvedKycId } }),
      prisma.payout.findUnique({ where: { id: fixture.ids.rejectedPayoutId } }),
      prisma.payout.findUnique({ where: { id: approvedPayout.id } }),
      prisma.challenge.findUnique({ where: { id: fixture.ids.payoutChallengeId } }),
      prisma.pick.findUnique({ where: { id: fixture.ids.pendingPickId } }),
      prisma.challenge.findUnique({ where: { id: fixture.ids.settleChallengeId } }),
    ]);
    const banTarget = await waitFor(async () => {
      const user = await prisma.user.findUnique({
        where: { id: fixture.ids.banTargetId },
      });
      return user?.isBanned === false && user.banReason === null ? user : null;
    });

    assert.equal(kycRejectResponse.status(), 200);
    assert.equal(rejectedKyc?.status, "rejected");
    assert.equal(kycApproveResponse.status(), 200);
    assert.equal(approvedKyc?.status, "approved");
    assert.equal(payoutRejectResponse.status(), 200);
    assert.equal(rejectedPayout?.status, "failed");
    assert.equal(restoredChallenge?.balance, 12_000);
    assert.equal(payoutApproveResponse.status(), 200);
    assert.equal(approvedPayoutRow?.status, "paid");
    assert.equal(settleResponse.status(), 200);
    assert.equal(settledPick?.status, "won");
    assert.equal(settleChallenge?.balance, 11_000);
    assert.equal(banTarget?.isBanned, false);
    assert.equal(banTarget?.banReason, null);

    await collectAuditIds(fixture.ids.adminId);

    console.log(
      JSON.stringify(
        {
          ok: true,
          baseUrl,
          checks: {
            kycReject: {
              httpStatus: kycRejectResponse.status(),
              status: rejectedKyc?.status ?? null,
            },
            kycApprove: {
              httpStatus: kycApproveResponse.status(),
              status: approvedKyc?.status ?? null,
            },
            payoutReject: {
              httpStatus: payoutRejectResponse.status(),
              status: rejectedPayout?.status ?? null,
              restoredBalance: restoredChallenge?.balance ?? null,
            },
            payoutApprove: {
              httpStatus: payoutApproveResponse.status(),
              status: approvedPayoutRow?.status ?? null,
              challengeBalance: payoutChallenge?.balance ?? null,
            },
            manualSettlement: {
              httpStatus: settleResponse.status(),
              pickStatus: settledPick?.status ?? null,
              challengeBalance: settleChallenge?.balance ?? null,
            },
            userModeration: {
              banned: banTarget?.isBanned ?? null,
              banReason: banTarget?.banReason ?? null,
            },
          },
        },
        null,
        2,
      ),
    );
  } finally {
    await browser.close();
  }
} finally {
  if (fixtureResourceIds) {
    await prisma.auditLog.deleteMany({
      where: {
        OR: [
          { adminId: fixtureResourceIds.adminId },
          {
            targetId: {
              in: [
                fixtureResourceIds.banTargetId,
                fixtureResourceIds.rejectedPayoutId,
                fixtureResourceIds.rejectedKycId,
                fixtureResourceIds.approvedKycId,
                fixtureResourceIds.pendingPickId,
                fixtureResourceIds.payoutChallengeId,
                fixtureResourceIds.settleChallengeId,
              ],
            },
          },
        ],
      },
    });
  }
  if (createdAuditIds.length > 0) {
    await prisma?.auditLog.deleteMany({ where: { id: { in: createdAuditIds } } });
  }
  if (createdPayoutIds.length > 0) {
    await prisma?.payout.deleteMany({ where: { id: { in: createdPayoutIds } } });
  }
  if (createdPickIds.length > 0) {
    await prisma?.pick.deleteMany({ where: { id: { in: createdPickIds } } });
  }
  if (createdChallengeIds.length > 0) {
    await prisma?.challenge.deleteMany({ where: { id: { in: createdChallengeIds } } });
  }
  if (createdKycIds.length > 0) {
    await prisma?.kycSubmission.deleteMany({ where: { id: { in: createdKycIds } } });
  }
  if (createdUserIds.length > 0) {
    await prisma?.user.deleteMany({ where: { id: { in: createdUserIds } } });
  }
  if (createdTierIds.length > 0) {
    await prisma?.tier.deleteMany({ where: { id: { in: createdTierIds } } });
  }
  for (const authUserId of createdAuthUserIds) {
    await supabase.auth.admin.deleteUser(authUserId);
  }
  await prisma?.$disconnect();
}
