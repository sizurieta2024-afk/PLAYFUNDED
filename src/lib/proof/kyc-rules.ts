import type { KycStatus } from "@prisma/client";

export type KycPayoutEligibilityCode =
  | "eligible"
  | "already_approved"
  | "pending_review"
  | "payouts_disabled_country"
  | "no_funded_challenge"
  | "no_profit_available";

export interface KycChallengeSnapshot {
  balance: number;
  startBalance: number;
}

export interface EvaluateKycPayoutEligibilityInput {
  kycStatus: KycStatus | null;
  payoutsEnabled: boolean;
  fundedChallenges: KycChallengeSnapshot[];
}

export interface KycPayoutEligibilityResult {
  allowed: boolean;
  code: KycPayoutEligibilityCode;
}

export function evaluateKycPayoutEligibility(
  input: EvaluateKycPayoutEligibilityInput,
): KycPayoutEligibilityResult {
  if (input.kycStatus === "approved") {
    return { allowed: false, code: "already_approved" };
  }

  if (input.kycStatus === "pending") {
    return { allowed: false, code: "pending_review" };
  }

  if (!input.payoutsEnabled) {
    return { allowed: false, code: "payouts_disabled_country" };
  }

  if (input.fundedChallenges.length === 0) {
    return { allowed: false, code: "no_funded_challenge" };
  }

  const hasProfitAvailable = input.fundedChallenges.some(
    (challenge) => challenge.balance > challenge.startBalance,
  );
  if (!hasProfitAvailable) {
    return { allowed: false, code: "no_profit_available" };
  }

  return { allowed: true, code: "eligible" };
}
