import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getNowPaymentsPayoutStatus,
  mapNowPaymentsPayoutStatus,
} from "@/lib/payouts/nowpayments-mass";
import { recordOpsEvent } from "@/lib/ops-events";
import { withRouteMetric } from "@/lib/ops-observability";
import { payoutPaidEmail, payoutRejectedEmail, sendEmail } from "@/lib/email";

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

function extractRequestedProfitAmount(providerData: unknown): number | null {
  if (!providerData || typeof providerData !== "object" || Array.isArray(providerData)) {
    return null;
  }
  const value = (providerData as Record<string, unknown>).requestedProfitAmount;
  return typeof value === "number" && Number.isInteger(value) ? value : null;
}

function mergeProviderData(
  current: unknown,
  next: Prisma.InputJsonObject,
): Prisma.InputJsonValue {
  const base =
    current && typeof current === "object" && !Array.isArray(current)
      ? (current as Prisma.InputJsonObject)
      : {};

  return {
    ...base,
    ...next,
  };
}

async function restoreChallengeBalance(payout: {
  challengeId: string | null;
  providerData: unknown;
}) {
  if (!payout.challengeId) return;
  const requestedProfitAmount = extractRequestedProfitAmount(payout.providerData);
  if (requestedProfitAmount === null) return;
  await prisma.challenge.update({
    where: { id: payout.challengeId },
    data: { balance: { increment: requestedProfitAmount } },
  });
}

async function runPayoutSync(req: NextRequest) {
  const startedAt = Date.now();
  if (!isAuthorized(req)) {
    return NextResponse.json(
      { error: "Unauthorized", code: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  const payouts = await prisma.payout.findMany({
    where: {
      status: "processing",
      providerPayoutId: { not: null },
      method: { in: ["btc", "usdt", "usdc"] },
    },
    select: {
      id: true,
      userId: true,
      challengeId: true,
      method: true,
      providerPayoutId: true,
      providerData: true,
      amount: true,
      user: {
        select: {
          email: true,
          name: true,
        },
      },
    },
    take: 100,
  });

  if (payouts.length === 0) {
    await recordOpsEvent({
      type: "cron_payout_sync_completed",
      source: "api:payouts:sync",
      subjectType: "cron",
      subjectId: "payout-sync",
      details: {
        synced: 0,
        durationMs: Date.now() - startedAt,
        report: [],
        noop: true,
      },
    });
    return NextResponse.json({ ok: true, synced: 0, report: [] });
  }

  const report: Array<{ payoutId: string; status: string }> = [];

  for (const payout of payouts) {
    try {
      const provider = await getNowPaymentsPayoutStatus(payout.providerPayoutId!);
      const mapped = mapNowPaymentsPayoutStatus(provider.status);
      if (mapped === "failed") {
        await restoreChallengeBalance(payout);
      }
      await prisma.payout.update({
        where: { id: payout.id },
        data: {
          status: mapped,
          txRef: provider.hash,
          paidAt: mapped === "paid" ? new Date() : null,
          providerData: mergeProviderData(payout.providerData, {
            payoutStatus: provider.status,
            payoutStatusRaw:
              provider.raw === null
                ? null
                : (provider.raw as Prisma.InputJsonValue),
          }),
        },
      });
      if (mapped === "paid") {
        const { subject, html } = payoutPaidEmail(
          payout.user.name,
          payout.amount,
          payout.method,
          provider.hash,
        );
        void sendEmail(payout.user.email, subject, html);
      } else if (mapped === "failed") {
        const { subject, html } = payoutRejectedEmail(
          payout.user.name,
          payout.amount,
          typeof provider.raw === "object" && provider.raw !== null
            ? JSON.stringify(provider.raw).slice(0, 500)
            : provider.status,
        );
        void sendEmail(payout.user.email, subject, html);
      }
      report.push({ payoutId: payout.id, status: mapped });
    } catch (error) {
      report.push({
        payoutId: payout.id,
        status: error instanceof Error ? error.message : "sync_error",
      });
    }
  }

  await recordOpsEvent({
    type: "cron_payout_sync_completed",
    source: "api:payouts:sync",
    subjectType: "cron",
    subjectId: "payout-sync",
    details: {
      synced: payouts.length,
      durationMs: Date.now() - startedAt,
      report,
    },
  });

  return NextResponse.json({ ok: true, synced: payouts.length, report });
}

export async function POST(req: NextRequest) {
  return withRouteMetric(
    {
      route: "POST /api/payouts/sync",
      source: "api:payouts:sync",
    },
    () => runPayoutSync(req),
  );
}

export async function GET(req: NextRequest) {
  return withRouteMetric(
    {
      route: "GET /api/payouts/sync",
      source: "api:payouts:sync",
    },
    () => runPayoutSync(req),
  );
}
