import type { CountryPolicyOverride as PrismaCountryPolicyOverride } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  applyCountryPolicyOverride,
  getCountryPolicy,
  listCountryPolicies,
  normalizeCountry,
  sanitizeCheckoutMethods,
  type CountryPolicy,
  type CountryPolicyOverrideInput,
} from "@/lib/country-policy";

export interface ResolvedCountryPolicy extends CountryPolicy {
  hasOverride: boolean;
  overrideUpdatedAt: Date | null;
}

function optionalBoolean(value: boolean | null): boolean | undefined {
  return value ?? undefined;
}

function mapOverride(
  override: PrismaCountryPolicyOverride,
): CountryPolicyOverrideInput {
  return {
    displayName: override.displayName,
    marketStatus: override.marketStatus,
    publicAccess: override.publicAccess,
    challengePurchasesEnabled: override.challengePurchasesEnabled,
    payoutsEnabled: override.payoutsEnabled,
    requiresReviewNotice: override.requiresReviewNotice,
    reviewNote: override.reviewNote,
    overrideCheckoutMethods: override.overrideCheckoutMethods,
    checkoutMethods: sanitizeCheckoutMethods(
      override.checkoutMethods.map((method) =>
        method === "crypto" ? "crypto" : method,
      ),
    ),
    overridePayoutMethods: override.overridePayoutMethods,
    payoutMethods: override.payoutMethods,
    marketing: {
      showExactCommercialTerms: optionalBoolean(
        override.showExactCommercialTerms,
      ),
      affiliateProgramEnabled: optionalBoolean(
        override.affiliateProgramEnabled,
      ),
      giftsEnabled: optionalBoolean(override.giftsEnabled),
      showProcessorNames: optionalBoolean(override.showProcessorNames),
    },
    launchChecklist: {
      legalApproved: optionalBoolean(override.legalApproved),
      pspApproved: optionalBoolean(override.pspApproved),
      copyApproved: optionalBoolean(override.copyApproved),
      kycEnabled: optionalBoolean(override.kycEnabled),
    },
  };
}

function withMeta(
  base: CountryPolicy,
  override?: PrismaCountryPolicyOverride | null,
): ResolvedCountryPolicy {
  return {
    ...applyCountryPolicyOverride(base, override ? mapOverride(override) : null),
    hasOverride: Boolean(override),
    overrideUpdatedAt: override?.updatedAt ?? null,
  };
}

export async function getResolvedCountryPolicy(
  country?: string | null,
): Promise<ResolvedCountryPolicy> {
  const normalized = normalizeCountry(country);
  const base = getCountryPolicy(normalized);
  if (!normalized) {
    return withMeta(base, null);
  }

  const override = await prisma.countryPolicyOverride.findUnique({
    where: { country: normalized },
  });
  return withMeta(base, override);
}

export async function listResolvedCountryPolicies(): Promise<
  ResolvedCountryPolicy[]
> {
  const basePolicies = listCountryPolicies();
  const baseNames = new Map(
    basePolicies
      .filter((policy): policy is CountryPolicy & { country: string } =>
        Boolean(policy.country),
      )
      .map((policy) => [policy.country, policy.displayName]),
  );
  const overrides = await prisma.countryPolicyOverride.findMany({
    orderBy: { country: "asc" },
  });
  const overrideMap = new Map(overrides.map((row) => [row.country, row]));
  const countries = new Set<string>();

  for (const policy of basePolicies) {
    if (policy.country) {
      countries.add(policy.country);
    }
  }
  for (const override of overrides) {
    countries.add(override.country);
  }

  return Array.from(countries)
    .sort((a, b) => (baseNames.get(a) ?? a).localeCompare(baseNames.get(b) ?? b))
    .map((country) =>
      withMeta(getCountryPolicy(country), overrideMap.get(country)),
    );
}

export async function listRecentOpsEvents(limit = 100) {
  return prisma.opsEventLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
