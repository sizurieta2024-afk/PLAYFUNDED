import assert from "node:assert/strict";
import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function assertContains(file, pattern, message) {
  assert.match(read(file), pattern, message);
}

const requiredEvents = [
  "signup_started",
  "signup_verification_sent",
  "signup_verification_resent",
  "email_verified",
  "login_succeeded",
  "password_reset_requested",
  "password_reset_completed",
  "locale_selected",
  "challenge_tier_cta_clicked",
  "checkout_started",
  "checkout_created",
  "checkout_created_client",
  "checkout_failed_client",
  "payment_completed",
  "first_pick_placed",
  "pick_placed",
  "group_created",
  "group_joined",
  "group_left",
  "group_deleted",
  "affiliate_application_submitted",
  "affiliate_code_change_requested",
  "payout_requested",
  "payout_rollover_requested",
];

const eventsFile = "src/lib/analytics/events.ts";
const serverFile = "src/lib/analytics/posthog-server.ts";
const clientFile = "src/lib/analytics/posthog-client.ts";

for (const eventName of requiredEvents) {
  assertContains(
    eventsFile,
    new RegExp(`["']${eventName}["']`),
    `missing analytics event ${eventName}`,
  );
}

assertContains(
  serverFile,
  /\/i\/v0\/e\/?/,
  "server capture must use PostHog event ingestion endpoint",
);
assertContains(serverFile, /api_key:\s*POSTHOG_TOKEN/, "missing api_key");
assertContains(serverFile, /distinct_id:\s*distinctId/, "missing distinct_id");
assertContains(serverFile, /AbortController/, "missing bounded timeout");
assertContains(serverFile, /sanitizeAnalyticsProperties/, "missing property sanitization");

assertContains(clientFile, /posthog\.capture/, "client helper must capture events");
assertContains(clientFile, /sanitizeAnalyticsProperties/, "client helper must sanitize properties");

const wiring = [
  ["src/app/[locale]/(main)/auth/signup/page.tsx", /SIGNUP_STARTED/],
  ["src/app/actions/auth.ts", /SIGNUP_VERIFICATION_SENT/],
  ["src/app/auth/callback/route.ts", /EMAIL_VERIFIED/],
  ["src/app/api/checkout/stripe/route.ts", /CHECKOUT_CREATED/],
  ["src/app/api/checkout/nowpayments/route.ts", /CHECKOUT_CREATED/],
  ["src/app/api/webhooks/stripe/route.ts", /PAYMENT_COMPLETED/],
  ["src/app/api/webhooks/nowpayments/route.ts", /PAYMENT_COMPLETED/],
  ["src/app/api/picks/route.ts", /FIRST_PICK_PLACED/],
  ["src/app/actions/groups.ts", /GROUP_CREATED/],
  ["src/app/actions/affiliate.ts", /AFFILIATE_APPLICATION_SUBMITTED/],
  ["src/app/actions/payouts.ts", /PAYOUT_REQUESTED/],
  ["src/components/challenges/TierCard.tsx", /CHECKOUT_STARTED/],
  ["src/components/layout/LanguageToggle.tsx", /LOCALE_SELECTED/],
];

for (const [file, pattern] of wiring) {
  assertContains(file, pattern, `missing analytics wiring in ${file}`);
}

console.log("PASS posthog_events");
