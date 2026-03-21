const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function assertMatch(relativePath, matcher, message) {
  const content = read(relativePath);
  if (!matcher.test(content)) {
    throw new Error(`${relativePath}: ${message}`);
  }
}

function proveSchema() {
  const file = "prisma/schema.prisma";
  assertMatch(file, /model CountryPolicyOverride /, "missing CountryPolicyOverride model");
  assertMatch(file, /model OpsEventLog /, "missing OpsEventLog model");
  console.log("PASS schema_models");
}

function proveCheckoutPolicyEnforcement() {
  const files = [
    "src/app/api/checkout/stripe/route.ts",
    "src/app/api/checkout/nowpayments/route.ts",
  ];

  for (const file of files) {
    assertMatch(file, /getResolvedCountryPolicy\(/, "missing DB-backed policy resolver");
    assertMatch(file, /policy\.challengePurchasesEnabled/, "missing country purchase gate");
    assertMatch(file, /recordOpsEvent\(/, "missing persisted checkout ops event");
  }

  assertMatch(
    "src/app/api/checkout/stripe/route.ts",
    /policy\.checkoutMethods\.includes\(paymentMethod\)/,
    "missing country-specific Stripe method gate",
  );
  assertMatch(
    "src/app/api/checkout/nowpayments/route.ts",
    /policy\.checkoutMethods\.includes\("crypto"\)/,
    "missing country-specific crypto method gate",
  );
  assertMatch(
    "src/app/api/checkout/mercadopago/route.ts",
    /PAYMENT_METHOD_DISABLED/,
    "Mercado Pago checkout route is not explicitly disabled",
  );
  console.log("PASS checkout_policy");
}

function proveWebhookVerificationAndIdempotency() {
  assertMatch(
    "src/app/api/webhooks/stripe/route.ts",
    /stripe\.webhooks\.constructEvent\(/,
    "missing Stripe signature verification",
  );
  assertMatch(
    "src/app/api/webhooks/nowpayments/route.ts",
    /verifyNowPaymentsSignature\(/,
    "missing NOWPayments signature verification",
  );
  assertMatch(
    "src/app/api/webhooks/mercadopago/route.ts",
    /PAYMENT_METHOD_DISABLED/,
    "Mercado Pago webhook route is not explicitly disabled",
  );

  const files = [
    "src/app/api/webhooks/stripe/route.ts",
    "src/app/api/webhooks/nowpayments/route.ts",
  ];
  for (const file of files) {
    assertMatch(file, /providerRef/, "missing provider reference handling");
    assertMatch(file, /webhook_duplicate/, "missing duplicate webhook path");
    assertMatch(file, /recordOpsEvent\(/, "missing persisted webhook ops event");
  }

  assertMatch(
    "src/app/api/webhooks/mercadopago/route.ts",
    /recordOpsEvent\(/,
    "missing persisted Mercado Pago disabled-provider event",
  );

  assertMatch(
    "src/app/api/webhooks/nowpayments/route.ts",
    /fulfillNowPaymentsPayment\(/,
    "missing NOWPayments fulfillment service call",
  );
  assertMatch(
    "src/lib/payments/nowpayments-fulfillment.ts",
    /dailyStartBalance:\s*input\.tierFundedBankroll/,
    "missing dailyStartBalance on NOWPayments challenge creation",
  );
  console.log("PASS webhook_verification");
}

function provePersistentOpsLogger() {
  const file = "src/lib/ops-events.ts";
  assertMatch(file, /prisma\.opsEventLog\.create\(/, "missing persistent ops log write");
  assertMatch(file, /export async function recordOpsEvent/, "missing awaited ops event writer");
  console.log("PASS ops_logger");
}

function main() {
  proveSchema();
  proveCheckoutPolicyEnforcement();
  proveWebhookVerificationAndIdempotency();
  provePersistentOpsLogger();
}

try {
  main();
} catch (error) {
  console.error(`FAIL ${error.message}`);
  process.exit(1);
}
