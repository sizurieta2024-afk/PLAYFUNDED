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

export function checkDailyLoss(challenge: Challenge) {
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

export function checkPostSettlement(challenge: Challenge) {
  return baseCheckPostSettlement(challenge, PLATFORM_POLICY.risk);
}
