export const AnalyticsEvents = {
  SIGNUP_STARTED: "signup_started",
  SIGNUP_VERIFICATION_SENT: "signup_verification_sent",
  SIGNUP_VERIFICATION_RESENT: "signup_verification_resent",
  EMAIL_VERIFIED: "email_verified",
  LOGIN_SUCCEEDED: "login_succeeded",
  PASSWORD_RESET_REQUESTED: "password_reset_requested",
  PASSWORD_RESET_COMPLETED: "password_reset_completed",
  LOCALE_SELECTED: "locale_selected",
  CHALLENGE_TIER_CTA_CLICKED: "challenge_tier_cta_clicked",
  CHECKOUT_STARTED: "checkout_started",
  CHECKOUT_CREATED: "checkout_created",
  CHECKOUT_CREATED_CLIENT: "checkout_created_client",
  CHECKOUT_FAILED_CLIENT: "checkout_failed_client",
  PAYMENT_COMPLETED: "payment_completed",
  FIRST_PICK_PLACED: "first_pick_placed",
  PICK_PLACED: "pick_placed",
  GROUP_CREATED: "group_created",
  GROUP_JOINED: "group_joined",
  GROUP_LEFT: "group_left",
  GROUP_DELETED: "group_deleted",
  AFFILIATE_APPLICATION_SUBMITTED: "affiliate_application_submitted",
  AFFILIATE_CODE_CHANGE_REQUESTED: "affiliate_code_change_requested",
  PAYOUT_REQUESTED: "payout_requested",
  PAYOUT_ROLLOVER_REQUESTED: "payout_rollover_requested",
} as const;

export type AnalyticsEventName =
  (typeof AnalyticsEvents)[keyof typeof AnalyticsEvents];

export type AnalyticsPropertyPrimitive =
  | string
  | number
  | boolean
  | null
  | undefined
  | Date;

export type AnalyticsPropertyValue =
  | AnalyticsPropertyPrimitive
  | AnalyticsPropertyPrimitive[];

export type AnalyticsProperties = Record<string, AnalyticsPropertyValue>;

const SENSITIVE_KEY_PARTS = [
  "address",
  "destination",
  "document",
  "email",
  "message",
  "note",
  "password",
  "providerref",
  "secret",
  "token",
  "wallet",
];

function isSensitiveAnalyticsKey(key: string) {
  const normalized = key.replace(/[^a-z0-9]/gi, "").toLowerCase();
  return SENSITIVE_KEY_PARTS.some((part) => normalized.includes(part));
}

function normalizeAnalyticsValue(
  value: AnalyticsPropertyValue,
): string | number | boolean | null | Array<string | number | boolean | null> | undefined {
  if (value === undefined) return undefined;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    return value
      .map((entry) => normalizeAnalyticsValue(entry))
      .filter((entry) => entry !== undefined) as Array<
      string | number | boolean | null
    >;
  }
  if (typeof value === "string") {
    return value.replaceAll("\u0000", "").slice(0, 200);
  }
  return value;
}

export function sanitizeAnalyticsProperties(properties: AnalyticsProperties = {}) {
  return Object.fromEntries(
    Object.entries(properties).flatMap(([key, value]) => {
      if (isSensitiveAnalyticsKey(key)) return [];
      const normalized = normalizeAnalyticsValue(value);
      return normalized === undefined ? [] : [[key, normalized]];
    }),
  );
}
