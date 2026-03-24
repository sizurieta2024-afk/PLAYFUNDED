export const PLATFORM_POLICY = {
  policyVersion: "2026-03-07-country-review-v1",
  risk: {
    drawdownLimitPct: 15,
    dailyLossLimitPct: 10,
    maxStakePct: 5,
    minStakePct: 1,
    minStakeFloorCents: 100,
    minPicksPerPhase: 15,
  },
  trading: {
    liveBettingAllowed: false,
    eventLockMinutes: 5,
    maxParlayLegs: 4,
  },
  payouts: {
    minimumCents: 1000,
    settlementCurrency: "USD",
    requestWindowStartDayUtc: 1,
    requestWindowEndDayUtc: 5,
  },
  commercial: {
    entryFeesRefundable: false,
    retryRequiresNewPurchase: true,
    giftPurchasesCardOnly: true,
    affiliateBaseRatePct: 5,
    affiliateTopRatePct: 10,
  },
} as const;

export function isPayoutWindowOpen(now = new Date()): boolean {
  const utcDay = now.getUTCDate();
  return (
    utcDay >= PLATFORM_POLICY.payouts.requestWindowStartDayUtc &&
    utcDay <= PLATFORM_POLICY.payouts.requestWindowEndDayUtc
  );
}

export function getPayoutWindowLabel(): string {
  return `${PLATFORM_POLICY.payouts.requestWindowStartDayUtc}-${PLATFORM_POLICY.payouts.requestWindowEndDayUtc} UTC`;
}
