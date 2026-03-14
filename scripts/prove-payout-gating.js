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

function provePayoutEvaluation() {
  const file = "src/lib/proof/payout-rules.ts";
  assertMatch(
    file,
    /if \(!input\.payoutsEnabled\)/,
    "missing country-enabled gate",
  );
  assertMatch(
    file,
    /if \(!input\.methodAllowed\)/,
    "missing payout-method gate",
  );
  assertMatch(
    file,
    /if \(!input\.kycApproved\)/,
    "missing KYC gate",
  );
  assertMatch(
    file,
    /if \(!input\.windowOpen\)/,
    "missing payout-window gate",
  );
  assertMatch(
    file,
    /input\.requestedProfitAmount < input\.minimumPayoutCents/,
    "missing payout minimum gate",
  );
  console.log("PASS payout_evaluation");
}

function proveTransactionalPayoutRequest() {
  const file = "src/lib/payouts/request-service.ts";
  assertMatch(
    file,
    /TransactionIsolationLevel\.Serializable/,
    "missing serializable transaction isolation",
  );
  assertMatch(
    file,
    /status: "funded"/,
    "missing funded challenge constraint",
  );
  assertMatch(
    file,
    /status: "pending"/,
    "missing in-transaction pending payout check",
  );
  assertMatch(
    file,
    /tx\.challenge\.update\(/,
    "missing in-transaction challenge balance update",
  );
  console.log("PASS payout_transaction");
}

function proveCountryAwarePayoutAction() {
  const file = "src/app/actions/payouts.ts";
  assertMatch(
    file,
    /getResolvedCountryPolicy/,
    "missing DB-backed country policy resolver",
  );
  assertMatch(
    file,
    /policy\.payoutMethods\.includes\(method\)/,
    "missing country-specific payout method gate",
  );
  assertMatch(
    file,
    /createPayoutRequest\(/,
    "missing transactional payout request service usage",
  );
  assertMatch(
    file,
    /recordOpsEvent\(/,
    "missing persisted ops event logging for payout requests",
  );
  console.log("PASS payout_action");
}

function main() {
  provePayoutEvaluation();
  proveTransactionalPayoutRequest();
  proveCountryAwarePayoutAction();
}

try {
  main();
} catch (error) {
  console.error(`FAIL ${error.message}`);
  process.exit(1);
}
