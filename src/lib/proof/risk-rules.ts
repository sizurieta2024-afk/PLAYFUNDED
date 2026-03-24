export interface RiskChallengeSnapshot {
  balance: number;
  highestBalance: number;
  startBalance: number;
  dailyStartBalance: number;
}

export interface RiskPolicy {
  drawdownLimitPct: number;
  dailyLossLimitPct: number;
  maxStakePct: number;
  minStakePct: number;
  minStakeFloorCents: number;
}

export interface RiskViolation {
  rule: "drawdown" | "daily_loss" | "stake_cap";
  code:
    | "DRAWDOWN_BREACH"
    | "DAILY_LOSS_BREACH"
    | "STAKE_CAP_EXCEEDED"
    | "STAKE_MIN_VIOLATED";
  error: string;
}

export function checkDrawdown(
  challenge: RiskChallengeSnapshot,
  policy: Pick<RiskPolicy, "drawdownLimitPct">,
): RiskViolation | null {
  const floor = Math.floor(
    (challenge.startBalance * (100 - policy.drawdownLimitPct)) / 100,
  );
  if (challenge.balance < floor) {
    return {
      rule: "drawdown",
      code: "DRAWDOWN_BREACH",
      error: `Balance dropped more than ${policy.drawdownLimitPct}% from starting balance ($${(challenge.startBalance / 100).toFixed(2)})`,
    };
  }
  return null;
}

export function checkDailyLoss(
  challenge: RiskChallengeSnapshot,
  policy: Pick<RiskPolicy, "dailyLossLimitPct">,
): RiskViolation | null {
  const floor = Math.floor(
    (challenge.dailyStartBalance * (100 - policy.dailyLossLimitPct)) / 100,
  );
  if (challenge.balance < floor) {
    return {
      rule: "daily_loss",
      code: "DAILY_LOSS_BREACH",
      error: `Daily loss limit reached — balance cannot fall below ${100 - policy.dailyLossLimitPct}% of today's starting balance ($${(floor / 100).toFixed(2)})`,
    };
  }
  return null;
}

export function checkStakeCap(
  challenge: Pick<RiskChallengeSnapshot, "startBalance">,
  proposedStakeCents: number,
  policy: Pick<RiskPolicy, "maxStakePct">,
): RiskViolation | null {
  const maxStake = Math.floor(
    (challenge.startBalance * policy.maxStakePct) / 100,
  );
  if (proposedStakeCents > maxStake) {
    return {
      rule: "stake_cap",
      code: "STAKE_CAP_EXCEEDED",
      error: `Stake exceeds ${policy.maxStakePct}% limit. Max allowed: $${(maxStake / 100).toFixed(2)}`,
    };
  }
  return null;
}

export function checkMinStake(
  challenge: Pick<RiskChallengeSnapshot, "startBalance">,
  proposedStakeCents: number,
  policy: Pick<RiskPolicy, "minStakePct" | "minStakeFloorCents">,
): RiskViolation | null {
  const minStake = Math.max(
    policy.minStakeFloorCents,
    Math.floor((challenge.startBalance * policy.minStakePct) / 100),
  );
  if (proposedStakeCents < minStake) {
    return {
      rule: "stake_cap",
      code: "STAKE_MIN_VIOLATED",
      error: `Stake is below the ${policy.minStakePct}% minimum. Min allowed: $${(minStake / 100).toFixed(2)}`,
    };
  }
  return null;
}

export function checkPostSettlement(
  challenge: RiskChallengeSnapshot,
  policy: Pick<RiskPolicy, "drawdownLimitPct" | "dailyLossLimitPct">,
): RiskViolation | null {
  return checkDrawdown(challenge, policy) ?? checkDailyLoss(challenge, policy);
}
