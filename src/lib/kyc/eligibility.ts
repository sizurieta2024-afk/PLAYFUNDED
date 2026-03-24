import type { PrismaClient, KycStatus } from "@prisma/client";
import { resolvePayoutCountry } from "../payout-options";
import {
  evaluateKycPayoutEligibility,
  type KycPayoutEligibilityResult,
} from "../proof/kyc-rules";

export type { KycPayoutEligibilityCode, KycChallengeSnapshot, EvaluateKycPayoutEligibilityInput } from "../proof/kyc-rules";
export { evaluateKycPayoutEligibility };

export async function resolveKycPayoutEligibility(
  db: PrismaClient,
  user: {
    id: string;
    country: string | null;
    kycSubmission?: { status: KycStatus; country: string | null } | null;
  },
): Promise<
  KycPayoutEligibilityResult & {
    payoutCountry: string | null;
  }
> {
  const payoutCountry = resolvePayoutCountry(
    user.kycSubmission?.country,
    user.country,
  );
  const { getResolvedCountryPolicy } = await import("../country-policy-store");
  const policy = await getResolvedCountryPolicy(payoutCountry);
  const fundedChallenges = await db.challenge.findMany({
    where: { userId: user.id, status: "funded" },
    select: {
      balance: true,
      startBalance: true,
    },
  });

  return {
    payoutCountry,
    ...evaluateKycPayoutEligibility({
      kycStatus: user.kycSubmission?.status ?? null,
      payoutsEnabled: policy.payoutsEnabled,
      fundedChallenges,
    }),
  };
}
