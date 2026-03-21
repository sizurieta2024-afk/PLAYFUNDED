import type { PayoutMethod } from "@prisma/client";
import { PLATFORM_POLICY } from "@/lib/platform-policy";

export type CheckoutMethod = "card" | "crypto" | "pix" | "mercadopago";
export type CountryMarketStatus = "blocked" | "review" | "enabled";

export const ALL_CHECKOUT_METHODS: CheckoutMethod[] = [
  "card",
  "crypto",
  "pix",
];

export const ALL_MARKET_STATUSES: CountryMarketStatus[] = [
  "blocked",
  "review",
  "enabled",
];

export interface LaunchChecklist {
  legalApproved: boolean;
  pspApproved: boolean;
  copyApproved: boolean;
  payoutsEnabled: boolean;
  kycEnabled: boolean;
}

export interface MarketingPolicy {
  showExactCommercialTerms: boolean;
  affiliateProgramEnabled: boolean;
  giftsEnabled: boolean;
  showProcessorNames: boolean;
}

export interface CountryPolicy {
  country: string | null;
  displayName: string;
  marketStatus: CountryMarketStatus;
  publicAccess: boolean;
  challengePurchasesEnabled: boolean;
  payoutsEnabled: boolean;
  requiresReviewNotice: boolean;
  reviewNote: string | null;
  checkoutMethods: CheckoutMethod[];
  payoutMethods: PayoutMethod[];
  marketing: MarketingPolicy;
  launchChecklist: LaunchChecklist;
}

export interface CountryPolicyOverrideInput {
  displayName?: string | null;
  marketStatus?: CountryMarketStatus | null;
  publicAccess?: boolean | null;
  challengePurchasesEnabled?: boolean | null;
  payoutsEnabled?: boolean | null;
  requiresReviewNotice?: boolean | null;
  reviewNote?: string | null;
  overrideCheckoutMethods?: boolean;
  checkoutMethods?: CheckoutMethod[];
  overridePayoutMethods?: boolean;
  payoutMethods?: PayoutMethod[];
  marketing?: Partial<MarketingPolicy>;
  launchChecklist?: Partial<LaunchChecklist>;
}

interface CountryPolicyConfig {
  displayName?: string;
  marketStatus?: CountryMarketStatus;
  publicAccess?: boolean;
  challengePurchasesEnabled?: boolean;
  payoutsEnabled?: boolean;
  requiresReviewNotice?: boolean;
  reviewNote?: string | null;
  launchChecklist?: Partial<LaunchChecklist>;
  marketing?: Partial<MarketingPolicy>;
}

export const COUNTRY_POLICY_VERSION = PLATFORM_POLICY.policyVersion;

export const ALL_PAYOUT_METHODS: PayoutMethod[] = [
  "bank_wire",
  "usdt",
  "usdc",
  "btc",
  "paypal",
];

const COUNTRY_ALIASES: Record<string, string> = {
  UK: "GB",
};

const COUNTRY_NAMES: Record<string, string> = {
  AR: "Argentina",
  BO: "Bolivia",
  BR: "Brazil",
  CL: "Chile",
  CO: "Colombia",
  CR: "Costa Rica",
  DO: "Dominican Republic",
  EC: "Ecuador",
  ES: "Spain",
  GB: "United Kingdom",
  GT: "Guatemala",
  HN: "Honduras",
  MX: "Mexico",
  NI: "Nicaragua",
  PA: "Panama",
  PE: "Peru",
  PY: "Paraguay",
  SV: "El Salvador",
  UY: "Uruguay",
  US: "United States",
  VE: "Venezuela",
};

const PIX_COUNTRIES = new Set(["BR"]);

const DLOCAL_PAYOUT_COUNTRIES = new Set([
  "AR",
  "BO",
  "BR",
  "CL",
  "CO",
  "CR",
  "DO",
  "EC",
  "ES",
  "GB",
  "GT",
  "HN",
  "MX",
  "NI",
  "PA",
  "PE",
  "PY",
  "SV",
  "UY",
  "VE",
]);

const DEFAULT_REVIEW_NOTE =
  "Country remains in compliance review. Do not treat pricing, payouts, affiliate claims, or payment rails as fully approved.";

const DEFAULT_LAUNCH_CHECKLIST: LaunchChecklist = {
  legalApproved: false,
  pspApproved: false,
  copyApproved: false,
  payoutsEnabled: true,
  kycEnabled: true,
};

const DEFAULT_MARKETING_POLICY: MarketingPolicy = {
  showExactCommercialTerms: false,
  affiliateProgramEnabled: false,
  giftsEnabled: false,
  showProcessorNames: false,
};

const COUNTRY_CONFIG: Record<string, CountryPolicyConfig> = {
  US: {
    displayName: "United States",
    marketStatus: "blocked",
    publicAccess: false,
    challengePurchasesEnabled: false,
    payoutsEnabled: false,
    requiresReviewNotice: false,
    reviewNote: "Blocked market. Public access and transactions are disabled.",
    launchChecklist: {
      payoutsEnabled: false,
      kycEnabled: false,
    },
  },
  AR: { reviewNote: DEFAULT_REVIEW_NOTE },
  BR: { reviewNote: DEFAULT_REVIEW_NOTE },
  CL: { reviewNote: DEFAULT_REVIEW_NOTE },
  CO: { reviewNote: DEFAULT_REVIEW_NOTE },
  ES: { reviewNote: DEFAULT_REVIEW_NOTE },
  GB: { reviewNote: DEFAULT_REVIEW_NOTE },
  MX: { reviewNote: DEFAULT_REVIEW_NOTE },
  PE: { reviewNote: DEFAULT_REVIEW_NOTE },
  UY: { reviewNote: DEFAULT_REVIEW_NOTE },
};

function getDisplayName(country: string | null): string {
  if (!country) return "Unknown";
  return COUNTRY_NAMES[country] ?? country;
}

function getDefaultCheckoutMethods(country: string | null): CheckoutMethod[] {
  const methods: CheckoutMethod[] = ["card", "crypto"];

  if (country && PIX_COUNTRIES.has(country)) {
    methods.push("pix");
  }

  return methods;
}

function getDefaultPayoutMethods(country: string | null): PayoutMethod[] {
  const methods: PayoutMethod[] = ["usdt", "usdc", "btc"];

  if (country && DLOCAL_PAYOUT_COUNTRIES.has(country)) {
    methods.unshift("bank_wire");
  }

  return methods;
}

export function normalizeCountry(country?: string | null): string | null {
  if (!country) return null;
  const trimmed = country.trim().toUpperCase();
  if (!trimmed) return null;
  return COUNTRY_ALIASES[trimmed] ?? trimmed;
}

export function resolveCountry(
  ...countryCandidates: Array<string | null | undefined>
): string | null {
  for (const country of countryCandidates) {
    const normalized = normalizeCountry(country);
    if (normalized) return normalized;
  }
  return null;
}

export function getCountryPolicy(country?: string | null): CountryPolicy {
  const normalized = normalizeCountry(country);
  const config = normalized ? COUNTRY_CONFIG[normalized] : undefined;
  const marketStatus = config?.marketStatus ?? "review";
  const publicAccess = config?.publicAccess ?? marketStatus !== "blocked";
  const challengePurchasesEnabled =
    config?.challengePurchasesEnabled ?? publicAccess;
  const payoutsEnabled = config?.payoutsEnabled ?? publicAccess;
  const requiresReviewNotice =
    config?.requiresReviewNotice ?? marketStatus === "review";

  const launchChecklist: LaunchChecklist = {
    ...DEFAULT_LAUNCH_CHECKLIST,
    ...config?.launchChecklist,
    payoutsEnabled,
  };

  const marketing: MarketingPolicy = {
    ...DEFAULT_MARKETING_POLICY,
    ...(marketStatus === "enabled"
      ? {
          showExactCommercialTerms: true,
          affiliateProgramEnabled: true,
          giftsEnabled: true,
          showProcessorNames: true,
        }
      : {}),
    ...config?.marketing,
  };

  const checkoutMethods = challengePurchasesEnabled
    ? getDefaultCheckoutMethods(normalized)
    : [];
  const payoutMethods = payoutsEnabled ? getDefaultPayoutMethods(normalized) : [];

  return {
    country: normalized,
    displayName: config?.displayName ?? getDisplayName(normalized),
    marketStatus,
    publicAccess,
    challengePurchasesEnabled,
    payoutsEnabled,
    requiresReviewNotice,
    reviewNote:
      marketStatus === "blocked"
        ? config?.reviewNote ?? "Market is blocked."
        : config?.reviewNote ?? DEFAULT_REVIEW_NOTE,
    checkoutMethods,
    payoutMethods,
    marketing,
    launchChecklist,
  };
}

export function isGeoBlockedCountry(country?: string | null): boolean {
  return !getCountryPolicy(country).publicAccess;
}

export function isCheckoutMethodAllowed(
  method: CheckoutMethod,
  country?: string | null,
): boolean {
  return getCountryPolicy(country).checkoutMethods.includes(method);
}

export function getAvailableCheckoutMethods(
  country?: string | null,
): CheckoutMethod[] {
  return getCountryPolicy(country).checkoutMethods;
}

export function sanitizeCheckoutMethods(
  methods: CheckoutMethod[] | null | undefined,
): CheckoutMethod[] {
  if (!methods) return [];
  return methods.filter((method) => method !== "mercadopago");
}

export function getAvailablePayoutMethods(
  country?: string | null,
): PayoutMethod[] {
  return getCountryPolicy(country).payoutMethods;
}

export function isPayoutMethodAllowed(
  method: PayoutMethod,
  country?: string | null,
): boolean {
  return getAvailablePayoutMethods(country).includes(method);
}

export function listCountryPolicies(): CountryPolicy[] {
  const countries = new Set([
    ...Object.keys(COUNTRY_NAMES),
    ...Object.keys(COUNTRY_CONFIG),
  ]);

  return Array.from(countries)
    .sort((a, b) => getDisplayName(a).localeCompare(getDisplayName(b)))
    .map((country) => getCountryPolicy(country));
}

export function applyCountryPolicyOverride(
  base: CountryPolicy,
  override?: CountryPolicyOverrideInput | null,
): CountryPolicy {
  if (!override) return base;

  const marketStatus = override.marketStatus ?? base.marketStatus;
  const publicAccess = override.publicAccess ?? base.publicAccess;
  const challengePurchasesEnabled =
    override.challengePurchasesEnabled ?? base.challengePurchasesEnabled;
  const payoutsEnabled = override.payoutsEnabled ?? base.payoutsEnabled;
  const requiresReviewNotice =
    override.requiresReviewNotice ?? base.requiresReviewNotice;

  return {
    ...base,
    displayName: override.displayName ?? base.displayName,
    marketStatus,
    publicAccess,
    challengePurchasesEnabled,
    payoutsEnabled,
    requiresReviewNotice,
    reviewNote:
      override.reviewNote === undefined ? base.reviewNote : override.reviewNote,
    checkoutMethods: override.overrideCheckoutMethods
      ? sanitizeCheckoutMethods(override.checkoutMethods)
      : base.checkoutMethods,
    payoutMethods: override.overridePayoutMethods
      ? override.payoutMethods ?? []
      : base.payoutMethods,
    marketing: {
      ...base.marketing,
      ...override.marketing,
    },
    launchChecklist: {
      ...base.launchChecklist,
      ...override.launchChecklist,
    },
  };
}
