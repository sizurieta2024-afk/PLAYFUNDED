const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { validateKycFile } = require("../src/lib/kyc-file.ts");
const {
  getKycScanMode,
  shouldQuarantineKycUpload,
} = require("../src/lib/kyc-malware-scan.ts");

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

function proveSharedRateLimiter() {
  assertMatch(
    "prisma/schema.prisma",
    /model RateLimitBucket /,
    "missing shared rate limit bucket model",
  );
  assertMatch(
    "src/lib/rate-limit.ts",
    /prisma\.\$queryRaw/,
    "missing shared DB-backed limiter write",
  );
  assertMatch(
    "src/lib/rate-limit.ts",
    /export async function enforceRateLimit/,
    "limiter is not async/shared",
  );

  [
    "src/app/api/checkout/stripe/route.ts",
    "src/app/api/checkout/mercadopago/route.ts",
    "src/app/api/checkout/nowpayments/route.ts",
    "src/app/api/webhooks/stripe/route.ts",
    "src/app/api/webhooks/nowpayments/route.ts",
    "src/app/api/webhooks/mercadopago/route.ts",
    "src/app/api/chat/route.ts",
    "src/app/api/admin/picks/settle/route.ts",
  ].forEach((file) =>
    assertMatch(file, /await enforceRateLimit\(/, "route is not awaiting shared limiter"),
  );
  console.log("PASS shared_rate_limiter");
}

function proveKycValidation() {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xee]);
  const pdf = Buffer.from("%PDF-1.4", "ascii");
  const bad = Buffer.from("MZfake", "ascii");

  const makeFile = (name, type, size) => ({
    name,
    type,
    size,
  });

  assert.equal(
    validateKycFile("user-1", makeFile("doc.png", "image/png", png.length), png).ok,
    true,
  );
  assert.equal(
    validateKycFile("user-1", makeFile("doc.jpg", "image/jpeg", jpeg.length), jpeg).ok,
    true,
  );
  assert.equal(
    validateKycFile("user-1", makeFile("doc.pdf", "application/pdf", pdf.length), pdf).ok,
    true,
  );
  assert.deepEqual(
    validateKycFile("user-1", makeFile("evil.png", "image/png", bad.length), bad),
    { ok: false, error: "file_bad_signature" },
  );
  assert.deepEqual(
    validateKycFile("user-1", makeFile("../evil.pdf", "application/pdf", pdf.length), pdf),
    { ok: false, error: "file_name_invalid" },
  );

  assertMatch(
    "src/app/api/kyc/upload/route.ts",
    /validateKycFile\(/,
    "upload route does not validate file signatures",
  );
  assertMatch(
    "src/app/api/kyc/upload/route.ts",
    /scanKycBuffer\(/,
    "upload route does not perform malware scanning",
  );
  assertMatch(
    "src/app/api/kyc/upload/route.ts",
    /kyc_upload_quarantined|kyc_upload_quarantine_failed/,
    "upload route does not quarantine blocked files",
  );

  process.env.KYC_SCAN_MODE = "require_clean";
  assert.equal(getKycScanMode(), "require_clean");
  assert.equal(
    shouldQuarantineKycUpload({ status: "infected", engine: "clamav" }, "best_effort"),
    true,
  );
  assert.equal(
    shouldQuarantineKycUpload(
      { status: "unavailable", engine: "clamav", detail: "timeout" },
      "best_effort",
    ),
    false,
  );
  assert.equal(
    shouldQuarantineKycUpload(
      { status: "unavailable", engine: "clamav", detail: "timeout" },
      "require_clean",
    ),
    true,
  );
  delete process.env.KYC_SCAN_MODE;
  const originalNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  assert.equal(getKycScanMode(), "require_clean");
  process.env.NODE_ENV = "development";
  assert.equal(getKycScanMode(), "best_effort");
  if (originalNodeEnv === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = originalNodeEnv;
  }

  assertMatch(
    "src/lib/proof/kyc-rules.ts",
    /export function evaluateKycPayoutEligibility/,
    "missing payout-triggered KYC eligibility evaluator",
  );
  assertMatch(
    "src/lib/proof/kyc-rules.ts",
    /input\.kycStatus === "pending"[\s\S]*code: "pending_review"/,
    "eligibility evaluator does not block pending KYC resubmission",
  );
  assertMatch(
    "src/lib/proof/kyc-rules.ts",
    /fundedChallenges\.length === 0[\s\S]*code: "no_funded_challenge"/,
    "eligibility evaluator does not block users without funded challenges",
  );
  assertMatch(
    "src/lib/proof/kyc-rules.ts",
    /balance > challenge\.startBalance|challenge\.balance > challenge\.startBalance|hasProfitAvailable/,
    "eligibility evaluator does not require available profit",
  );

  assertMatch(
    "src/app/api/kyc/upload/route.ts",
    /resolveKycPayoutEligibility\(/,
    "upload route does not enforce server-side payout eligibility",
  );
  assertMatch(
    "src/app/actions/kyc.ts",
    /resolveKycPayoutEligibility\(/,
    "submitKyc action does not enforce server-side payout eligibility",
  );
  console.log("PASS kyc_hardening");
}

function proveOpsMonitoringAndDiagnostics() {
  assertMatch(
    "src/app/api/ops/health/route.ts",
    /getOpsHealthSummary\(/,
    "ops health route missing summary check",
  );
  assertMatch(
    "src/app/api/odds/sync/route.ts",
    /cron_odds_sync_(completed|failed)/,
    "odds sync route missing monitoring events",
  );
  assertMatch(
    "src/app/api/settle/route.ts",
    /cron_settle_(completed|failed)/,
    "settle route missing monitoring events",
  );
  assertMatch(
    "src/app/api/settle/route.ts",
    /if \(pendingPicks\.length === 0\)[\s\S]*type: "cron_settle_completed"/,
    "settle route does not record a success heartbeat on no-op runs",
  );
  assertMatch(
    ".github/workflows/ops-health-5m.yml",
    /\/api\/ops\/health|scripts\/check-ops-health\.mjs/,
    "ops health workflow missing health endpoint check",
  );
  assertMatch(
    ".github/workflows/ops-health-5m.yml",
    /PF_ALERT_WEBHOOK_URL|send-ops-alert\.mjs/,
    "ops health workflow missing external alert path",
  );
  assertMatch(
    ".github/workflows/ops-health-5m.yml",
    /continue-on-error:\s*true[\s\S]*exit_code=\$\{status\}/,
    "ops health workflow does not preserve failure output for alerts",
  );
  assertMatch(
    ".env.example",
    /PF_CRON_SECRET=/,
    "env example is missing the GitHub ops health secret",
  );
  console.log("PASS ops_monitoring");
}

function proveAdminFixtureDiagnostics() {
  assertMatch(
    "tests/e2e/global.setup.ts",
    /Smoke check.*non-admin|fixture user is non-admin|\/en\/admin/,
    "global setup does not verify auth fixture is non-admin",
  );
  assertMatch(
    "tests/e2e/10-admin-access.spec.ts",
    /test\.use\(\{ storageState: "tests\/e2e\/\.auth\/user\.json" \}\)/,
    "admin access spec is not using authenticated non-admin storage state",
  );
  console.log("PASS admin_fixture_diagnostics");
}

proveSharedRateLimiter();
proveKycValidation();
proveOpsMonitoringAndDiagnostics();
proveAdminFixtureDiagnostics();
