import { Prisma } from "@prisma/client";

export const FIXTURE_EMAIL_SUFFIXES = ["@example.com", "@playfunded.local"];

export const FIXTURE_TIER_PREFIXES = [
  "Proof Tier ",
  "Live Smoke Tier ",
  "Admin Smoke Tier ",
  "Smoke Test Tier",
];
export const FIXTURE_TIER_EXACT_NAMES: string[] = [];

export function getFixtureUserWhere(): Prisma.UserWhereInput {
  return {
    OR: FIXTURE_EMAIL_SUFFIXES.map((suffix) => ({
      email: { endsWith: suffix },
    })),
  };
}

export function getNonFixtureUserWhere(
  base: Prisma.UserWhereInput = {},
): Prisma.UserWhereInput {
  return {
    AND: [base, { NOT: getFixtureUserWhere() }],
  };
}

export function getFixtureTierWhere(): Prisma.TierWhereInput {
  return {
    OR: [
      ...FIXTURE_TIER_PREFIXES.map((prefix) => ({
        name: { startsWith: prefix },
      })),
      ...FIXTURE_TIER_EXACT_NAMES.map((name) => ({ name })),
    ],
  };
}

export function getNonFixtureTierWhere(
  base: Prisma.TierWhereInput = {},
): Prisma.TierWhereInput {
  return {
    AND: [base, { NOT: getFixtureTierWhere() }],
  };
}

export function getNonFixtureChallengeWhere(
  base: Prisma.ChallengeWhereInput = {},
): Prisma.ChallengeWhereInput {
  return {
    AND: [
      base,
      { user: { is: getNonFixtureUserWhere() } },
      { tier: { is: getNonFixtureTierWhere() } },
    ],
  };
}

export function getNonFixturePaymentWhere(
  base: Prisma.PaymentWhereInput = {},
): Prisma.PaymentWhereInput {
  return {
    AND: [
      base,
      { user: { is: getNonFixtureUserWhere() } },
      { tier: { is: getNonFixtureTierWhere() } },
    ],
  };
}

export function getNonFixturePayoutWhere(
  base: Prisma.PayoutWhereInput = {},
): Prisma.PayoutWhereInput {
  return {
    AND: [base, { user: { is: getNonFixtureUserWhere() } }],
  };
}

export function getNonFixtureKycWhere(
  base: Prisma.KycSubmissionWhereInput = {},
): Prisma.KycSubmissionWhereInput {
  return {
    AND: [base, { user: { is: getNonFixtureUserWhere() } }],
  };
}

export function getNonFixturePickWhere(
  base: Prisma.PickWhereInput = {},
): Prisma.PickWhereInput {
  return {
    AND: [
      base,
      { user: { is: getNonFixtureUserWhere() } },
      { challenge: { is: getNonFixtureChallengeWhere() } },
    ],
  };
}

export function getFixtureOddsWhere(): Prisma.OddsCacheWhereInput {
  return {
    OR: [
      { provider: "smoke" },
      { event: { contains: "smoke" } },
      { event: { contains: "probe" } },
      { eventName: { contains: "Smoke" } },
      { eventName: { contains: "Probe" } },
      { eventName: { contains: "Min Stake" } },
    ],
  };
}

export function getNonFixtureOddsWhere(
  base: Prisma.OddsCacheWhereInput = {},
): Prisma.OddsCacheWhereInput {
  return {
    AND: [base, { NOT: getFixtureOddsWhere() }],
  };
}
