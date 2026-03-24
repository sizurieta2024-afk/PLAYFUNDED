export interface PayoutChallengeSnapshot {
  balance: number;
  startBalance: number;
  profitSplitPct: number;
}

export interface PayoutRequestEvaluationInput {
  payoutsEnabled: boolean;
  methodAllowed: boolean;
  kycApproved: boolean;
  windowOpen: boolean;
  minimumPayoutCents: number;
  requestedProfitAmount: number;
  hasPendingPayout: boolean;
  challenge: PayoutChallengeSnapshot | null;
}

export type PayoutRequestEvaluation =
  | {
      ok: false;
      error: string;
      code: string;
    }
  | {
      ok: true;
      payoutAmount: number;
      grossProfit: number;
      newBalance: number;
    };

export function evaluatePayoutRequest(
  input: PayoutRequestEvaluationInput,
): PayoutRequestEvaluation {
  if (!input.payoutsEnabled) {
    return {
      ok: false,
      error: "method_unavailable",
      code: "PAYOUTS_DISABLED_COUNTRY",
    };
  }

  if (!input.methodAllowed) {
    return {
      ok: false,
      error: "method_unavailable",
      code: "METHOD_UNAVAILABLE",
    };
  }

  if (!input.kycApproved) {
    return { ok: false, error: "kyc_required", code: "KYC_REQUIRED" };
  }

  if (!input.windowOpen) {
    return { ok: false, error: "window_closed", code: "PAYOUT_WINDOW_CLOSED" };
  }

  if (
    !Number.isInteger(input.requestedProfitAmount) ||
    input.requestedProfitAmount < input.minimumPayoutCents
  ) {
    return { ok: false, error: "below_minimum", code: "BELOW_MINIMUM" };
  }

  if (!input.challenge) {
    return { ok: false, error: "challenge_not_found", code: "NOT_FOUND" };
  }

  const grossProfit = input.challenge.balance - input.challenge.startBalance;
  if (grossProfit <= 0) {
    return { ok: false, error: "profit_zero", code: "PROFIT_ZERO" };
  }

  if (input.requestedProfitAmount > grossProfit) {
    return { ok: false, error: "exceeds_profit", code: "EXCEEDS_PROFIT" };
  }

  const payoutAmount = Math.floor(
    (input.requestedProfitAmount * input.challenge.profitSplitPct) / 100,
  );
  if (payoutAmount <= 0) {
    return { ok: false, error: "profit_zero", code: "PROFIT_ZERO" };
  }

  if (input.hasPendingPayout) {
    return { ok: false, error: "pending_exists", code: "PENDING_EXISTS" };
  }

  return {
    ok: true,
    payoutAmount,
    grossProfit,
    newBalance:
      input.challenge.startBalance +
      (grossProfit - input.requestedProfitAmount),
  };
}
