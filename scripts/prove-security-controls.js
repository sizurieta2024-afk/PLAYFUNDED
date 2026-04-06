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

function proveDocsExist() {
  [
    "docs/security/route-review-matrix.md",
    "docs/security/launch-security-checklist.md",
  ].forEach((file) => {
    if (!fs.existsSync(path.join(ROOT, file))) {
      throw new Error(`${file}: missing required security review doc`);
    }
  });
  console.log("PASS security_docs");
}

function proveProviderResilience() {
  [
    "src/lib/odds/odds-api.ts",
    "src/lib/odds/api-football.ts",
    "src/lib/odds/scores.ts",
  ].forEach((file) =>
    assertMatch(
      file,
      /fetchExternalJson(?:<|\()/,
      "provider read path missing shared external-read wrapper",
    ),
  );
  assertMatch(
    "src/lib/net/external-read.ts",
    /provider_read_(completed|failed)/,
    "external read wrapper missing provider observability events",
  );
  console.log("PASS provider_resilience");
}

function proveRouteMetrics() {
  [
    "src/app/api/checkout/stripe/route.ts",
    "src/app/api/checkout/nowpayments/route.ts",
    "src/app/api/webhooks/stripe/route.ts",
    "src/app/api/webhooks/nowpayments/route.ts",
    "src/app/api/picks/route.ts",
    "src/app/api/chat/route.ts",
    "src/app/api/kyc/upload/route.ts",
    "src/app/api/admin/kyc/route.ts",
    "src/app/api/admin/payouts/route.ts",
    "src/app/api/admin/picks/settle/route.ts",
    "src/app/api/odds/sync/route.ts",
    "src/app/api/settle/route.ts",
    "src/app/api/payouts/sync/route.ts",
  ].forEach((file) =>
    assertMatch(file, /withRouteMetric\(/, "critical route missing route timing wrapper"),
  );
  assertMatch(
    "src/lib/ops-observability.ts",
    /pg_stat_activity/,
    "observability snapshot missing DB connection pressure query",
  );
  console.log("PASS route_observability");
}

function proveCaching() {
  assertMatch(
    "src/lib/catalog.ts",
    /unstable_cache/,
    "tier catalog missing shared cache wrapper",
  );
  assertMatch(
    "src/app/api/odds/events/route.ts",
    /Cache-Control/,
    "public odds events route missing cache-control header",
  );
  assertMatch(
    "src/app/[locale]/(main)/page.tsx",
    /getActiveTiers\(/,
    "home page missing cached tier catalog read",
  );
  assertMatch(
    "src/app/[locale]/(main)/challenges/page.tsx",
    /getActiveTiers\(/,
    "challenges page missing cached tier catalog read",
  );
  console.log("PASS intentional_caching");
}

function proveChecklistWiring() {
  assertMatch(
    ".github/workflows/ci.yml",
    /prove-security-controls\.js/,
    "CI proofs job missing security controls proof",
  );
  assertMatch(
    "package.json",
    /"proof:security-controls"/,
    "package.json missing security controls proof script",
  );
  console.log("PASS checklist_wiring");
}

function proveInputValidationCoverage() {
  [
    "src/app/api/checkout/stripe/route.ts",
    "src/app/api/checkout/nowpayments/route.ts",
    "src/app/api/chat/route.ts",
    "src/app/api/picks/route.ts",
    "src/app/api/admin/kyc/route.ts",
    "src/app/api/admin/payouts/route.ts",
    "src/app/api/admin/picks/settle/route.ts",
  ].forEach((file) =>
    assertMatch(file, /z\.(object|union|enum|literal|array)/, "route missing structured zod validation"),
  );
  console.log("PASS input_validation_coverage");
}

proveDocsExist();
proveProviderResilience();
proveRouteMetrics();
proveCaching();
proveChecklistWiring();
proveInputValidationCoverage();
