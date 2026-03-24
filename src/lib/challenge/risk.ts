import type { Challenge } from "@prisma/client";
import { PLATFORM_POLICY } from "@/lib/platform-policy";
import {
  checkDrawdown as baseCheckDrawdown,
  checkDailyLoss as baseCheckDailyLoss,
  checkStakeCap as baseCheckStakeCap,
  checkMinStake as baseCheckMinStake,
  checkPostSettlement as baseCheckPostSettlement,
} from "../proof/risk-rules";

export type {
  RiskChallengeSnapshot,
  RiskPolicy,
  RiskViolation,
} from "../proof/risk-rules";

export function checkDrawdown(challenge: Challenge) {
  return baseCheckDrawdown(challenge, PLATFORM_POLICY.risk);
}

// Funded accounts have no daily loss limit — only drawdown applies.
export function checkDailyLoss(challenge: Challenge) {
  if (challenge.phase === "funded") return null;
  return baseCheckDailyLoss(challenge, PLATFORM_POLICY.risk);
}

export function checkStakeCap(
  challenge: Challenge,
  proposedStakeCents: number,
) {
  return baseCheckStakeCap(challenge, proposedStakeCents, PLATFORM_POLICY.risk);
}

export function checkMinStake(
  challenge: Challenge,
  proposedStakeCents: number,
) {
  return baseCheckMinStake(challenge, proposedStakeCents, PLATFORM_POLICY.risk);
}

// For funded accounts, only check drawdown. For phases, check both.
export function checkPostSettlement(challenge: Challenge) {
  if (challenge.phase === "funded") {
    return baseCheckDrawdown(challenge, PLATFORM_POLICY.risk);
  }
  return baseCheckPostSettlement(challenge, PLATFORM_POLICY.risk);
}
