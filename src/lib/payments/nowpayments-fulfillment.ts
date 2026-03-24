import type { PaymentMethod, Prisma, PrismaClient } from "@prisma/client";
import { withWebhookLock } from "./webhook-lock";

export interface FulfillNowPaymentsPaymentInput {
  db: PrismaClient;
  providerRef: string;
  userId: string;
  tierId: string;
  tierFundedBankroll: number;
  priceAmount: number;
  priceCurrency: string;
  payCurrency: string;
  payAmount: number;
  discountCode?: string | null;
  listPriceAmount?: number | null;
  discountAmount?: number | null;
  discountPct?: number | null;
  beforeChallengeCreate?: (
    tx: Prisma.TransactionClient,
  ) => Promise<void> | void;
}

export type FulfillNowPaymentsPaymentResult =
  | {
      status: "created";
      paymentId: string;
      usedPendingPayment: boolean;
    }
  | {
      status: "duplicate";
    };

function resolvePayMethod(payCurrency: string): PaymentMethod {
  if (payCurrency === "btc") {
    return "btc";
  }
  if (payCurrency.startsWith("usdc")) {
    return "usdc";
  }
  return "usdt";
}

function mergePendingMetadata(
  metadata: Prisma.JsonValue | null,
  payCurrency: string,
  payAmount: number,
  providerRef: string,
): Prisma.InputJsonValue {
  return {
    ...(typeof metadata === "object" && metadata !== null && !Array.isArray(metadata)
      ? metadata
      : {}),
    paymentId: providerRef,
    payCurrency,
    payAmount,
  };
}

export async function fulfillNowPaymentsPayment(
  input: FulfillNowPaymentsPaymentInput,
): Promise<FulfillNowPaymentsPaymentResult> {
  return withWebhookLock(
    input.db,
    "nowpayments",
    input.providerRef,
    async (tx) => {
      const existing = await tx.payment.findFirst({
        where: { providerRef: input.providerRef },
      });
      if (existing?.status === "completed") {
        return { status: "duplicate" as const };
      }

      const pendingPayment = await tx.payment.findFirst({
        where: { providerRef: input.providerRef, status: "pending" },
      });

      let paymentId: string;
      if (pendingPayment) {
        const updated = await tx.payment.update({
          where: { id: pendingPayment.id },
          data: {
            status: "completed",
            metadata: mergePendingMetadata(
              pendingPayment.metadata,
              input.payCurrency,
              input.payAmount,
              input.providerRef,
            ),
          },
          select: { id: true },
        });
        paymentId = updated.id;
      } else {
        const created = await tx.payment.create({
          data: {
            userId: input.userId,
            tierId: input.tierId,
            amount: Math.round(input.priceAmount * 100),
            listPriceAmount:
              input.listPriceAmount !== null && input.listPriceAmount !== undefined
                ? input.listPriceAmount
                : Math.round(input.priceAmount * 100),
            discountAmount: input.discountAmount ?? 0,
            discountPct: input.discountPct ?? 0,
            discountCode: input.discountCode ?? null,
            currency: input.priceCurrency.toUpperCase(),
            method: resolvePayMethod(input.payCurrency),
            status: "completed",
            providerRef: input.providerRef,
            metadata: {
              paymentId: input.providerRef,
              payCurrency: input.payCurrency,
              payAmount: input.payAmount,
              affiliateCode: input.discountCode ?? null,
              policyVersion: null,
            },
          },
          select: { id: true },
        });
        paymentId = created.id;
      }

      await input.beforeChallengeCreate?.(tx);

      await tx.challenge.create({
        data: {
          userId: input.userId,
          tierId: input.tierId,
          status: "active",
          phase: "phase1",
          balance: input.tierFundedBankroll,
          startBalance: input.tierFundedBankroll,
          dailyStartBalance: input.tierFundedBankroll,
          highestBalance: input.tierFundedBankroll,
          peakBalance: input.tierFundedBankroll,
          phase1StartBalance: input.tierFundedBankroll,
        },
      });

      return {
        status: "created" as const,
        paymentId,
        usedPendingPayment: !!pendingPayment,
      };
    },
  );
}
