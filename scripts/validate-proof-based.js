const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const assert = require("node:assert/strict");

const {
  checkDrawdown,
  checkDailyLoss,
  checkStakeCap,
  checkMinStake,
} = require("../src/lib/proof/risk-rules.ts");
const { evaluatePayoutRequest } = require("../src/lib/proof/payout-rules.ts");
const { createPayoutRequest } = require("../src/lib/payouts/request-service.ts");
const {
  reviewPayoutByAdmin,
  reviewKycByAdmin,
} = require("../src/lib/admin/review-service.ts");
const {
  fulfillNowPaymentsPayment,
} = require("../src/lib/payments/nowpayments-fulfillment.ts");
const {
  evaluateKycPayoutEligibility,
} = require("../src/lib/proof/kyc-rules.ts");
const { withWebhookLock } = require("../src/lib/payments/webhook-lock.ts");
const { placePickRequest } = require("../src/lib/picks/place-service.ts");
const { settlePendingPick } = require("../src/lib/settlement/settle-service.ts");
const { setUserBanState } = require("../src/lib/admin/user-moderation-service.ts");
const {
  gradeMoneyline,
  gradeSpread,
  gradeTotal,
  gradePick,
} = require("../src/lib/proof/settlement-rules.ts");

const RISK_POLICY = {
  drawdownLimitPct: 15,
  dailyLossLimitPct: 10,
  maxStakePct: 5,
  minStakePct: 1,
  minStakeFloorCents: 100,
};

const ROOT = path.resolve(__dirname, "..");
const REPORT_PATH = path.join(
  ROOT,
  "docs/security/proof-based-validation-report.md",
);

function readFile(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findEvidence(relativePath, matcher) {
  const content = readFile(relativePath);
  const lines = content.split("\n");
  const regex =
    matcher instanceof RegExp
      ? new RegExp(
          matcher.source,
          matcher.flags.includes("g") ? matcher.flags : `${matcher.flags}g`,
        )
      : new RegExp(escapeRegExp(matcher), "g");

  const matches = [];
  lines.forEach((line, index) => {
    regex.lastIndex = 0;
    if (regex.test(line)) {
      matches.push(`L${index + 1}: ${line.trim()}`);
    }
  });
  return matches;
}

function runSourceCase(testCase) {
  const missing = [];
  const evidence = [];

  for (const check of testCase.checks) {
    const matches = findEvidence(testCase.file, check.matcher);
    if (matches.length === 0) {
      missing.push(check.description);
    } else {
      evidence.push(`${check.description}: ${matches[0]}`);
    }
  }

  return {
    ...testCase,
    status: missing.length === 0 ? "VERIFIED" : "FAILED",
    evidence,
    detail:
      missing.length === 0
        ? "All required proof points were found in source."
        : `Missing proof points: ${missing.join("; ")}`,
  };
}

function runRuntimeCase(testCase) {
  try {
    const evidence = testCase.run();
    return {
      ...testCase,
      status: "VERIFIED",
      evidence,
      detail: "Scenario matched the expected outcome.",
    };
  } catch (error) {
    return {
      ...testCase,
      status: "FAILED",
      evidence: [],
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

async function runDbCase(testCase, db) {
  try {
    const evidence = await testCase.run(db);
    return {
      ...testCase,
      status: "VERIFIED",
      evidence,
      detail: "Database-backed scenario matched the expected persisted outcome.",
    };
  } catch (error) {
    return {
      ...testCase,
      status: "FAILED",
      evidence: [],
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

const sourceCases = [
  {
    id: "auth.protected-routes",
    area: "auth and session handling",
    claim: "Protected routes require a live Supabase session and preserve a redirect target.",
    file: "src/middleware.ts",
    checks: [
      {
        description: "Session is read from Supabase",
        matcher: /supabase\.auth\.getUser\(\)/,
      },
      {
        description: "Protected prefixes are declared",
        matcher: /const PROTECTED_PREFIXES = \["\/dashboard", "\/admin"\]/,
      },
      {
        description: "Redirect target is preserved on login redirect",
        matcher: /loginUrl\.searchParams\.set\("redirectTo", pathname\)/,
      },
    ],
  },
  {
    id: "admin.server-role-check",
    area: "admin authorization",
    claim: "Admin access is enforced with a server-side role lookup.",
    file: "src/middleware.ts",
    checks: [
      {
        description: "Admin role is queried from the User table",
        matcher: /\.from\("User"\)/,
      },
      {
        description: "Role field is selected",
        matcher: /\.select\("role"\)/,
      },
      {
        description: "Non-admin users are redirected away",
        matcher: /user\.role !== "admin"/,
      },
    ],
  },
  {
    id: "payments.stripe-signature",
    area: "payments and webhooks",
    claim: "Stripe fulfillment only runs after signature verification and duplicate-safe locking.",
    file: "src/app/api/webhooks/stripe/route.ts",
    checks: [
      {
        description: "Stripe signature header is required",
        matcher: /stripe-signature/,
      },
      {
        description: "constructEvent verifies the webhook body",
        matcher: /stripe\.webhooks\.constructEvent\(/,
      },
      {
        description: "Invalid signatures are rejected",
        matcher: /Invalid webhook signature/,
      },
      {
        description: "Fulfillment is wrapped in a webhook duplicate lock",
        matcher: /withWebhookLock\(/,
      },
    ],
  },
  {
    id: "payments.nowpayments-signature",
    area: "payments and webhooks",
    claim: "NOWPayments callbacks require a verified provider signature, reject malformed payloads, and deduplicate fulfillment.",
    file: "src/app/api/webhooks/nowpayments/route.ts",
    checks: [
      {
        description: "NOWPayments signature header is read",
        matcher: /x-nowpayments-sig/,
      },
      {
        description: "Signature verifier is called",
        matcher: /verifyNowPaymentsSignature\(/,
      },
      {
        description: "Invalid signatures are rejected",
        matcher: /Invalid signature/,
      },
      {
        description: "Malformed payloads are rejected",
        matcher: /JSON\.parse\(body\)/,
      },
      {
        description: "Fulfillment is delegated to the shared NOWPayments payment service",
        matcher: /fulfillNowPaymentsPayment\(/,
      },
    ],
  },
  {
    id: "payments.nowpayments-fulfillment-service",
    area: "payments and webhooks",
    claim: "NOWPayments fulfillment upgrades pending checkout payments and creates the challenge inside one locked transaction.",
    file: "src/lib/payments/nowpayments-fulfillment.ts",
    checks: [
      {
        description: "Fulfillment is wrapped in a webhook lock",
        matcher: /withWebhookLock\(/,
      },
      {
        description: "Pending checkout payments are upgraded in place",
        matcher: /status: "completed"/,
      },
      {
        description: "Challenge provisioning happens in the same transaction",
        matcher: /tx\.challenge\.create\(/,
      },
    ],
  },
  {
    id: "ops.launch-smokes-dispatchable",
    area: "payments and webhooks",
    claim: "The CI workflow can run launch smokes from either push or manual dispatch once secrets exist.",
    file: ".github/workflows/ci.yml",
    checks: [
      {
        description: "CI supports workflow_dispatch",
        matcher: /workflow_dispatch:/,
      },
      {
        description: "Launch smokes are not limited to push-only events",
        matcher: /github\.event_name != 'pull_request'/,
      },
      {
        description: "Launch smokes run the admin support smoke",
        matcher: /BASE_URL=http:\/\/localhost:3004 node scripts\/run-admin-support-smoke\.mjs/,
      },
    ],
  },
  {
    id: "ops.admin-launch-kyc-status",
    area: "payout flows",
    claim: "The admin launch page exposes whether KYC scanning is configured and which mode production is using.",
    file: "src/app/[locale]/admin/launch/page.tsx",
    checks: [
      {
        description: "The admin launch page reads the KYC scan mode",
        matcher: /getKycScanMode\(/,
      },
      {
        description: "The page shows the KYC scanning card",
        matcher: /KYC scanning/,
      },
      {
        description: "The page shows the scanner configured vs unconfigured state",
        matcher: /Scanner not configured|ClamAV configured/,
      },
    ],
  },
  {
    id: "payments.mercadopago-verification",
    area: "payments and webhooks",
    claim: "Mercado Pago notifications are gated, reconciled against provider data with a timeout, and deduplicate fulfillment.",
    file: "src/app/api/webhooks/mercadopago/route.ts",
    checks: [
      {
        description: "Webhook secret token is checked when configured",
        matcher: /MERCADOPAGO_WEBHOOK_SECRET/,
      },
      {
        description: "Provider payment details are fetched server-side",
        matcher: /fetchMpPayment\(/,
      },
      {
        description: "Mercado Pago API is queried directly",
        matcher: /api\.mercadopago\.com\/v1\/payments\//,
      },
      {
        description: "Provider fetches use a bounded timeout",
        matcher: /fetchWithTimeout\(/,
      },
      {
        description: "Fulfillment is wrapped in a webhook duplicate lock",
        matcher: /withWebhookLock\(/,
      },
    ],
  },
  {
    id: "payout.transactional-request",
    area: "payout flows",
    claim: "Payout creation rechecks pending state inside a serializable transaction before debiting balance.",
    file: "src/lib/payouts/request-service.ts",
    checks: [
      {
        description: "Payout flow runs inside an interactive transaction",
        matcher: /input\.db\.\$transaction\(/,
      },
      {
        description: "Transaction isolation is serializable",
        matcher: /TransactionIsolationLevel\.Serializable/,
      },
      {
        description: "Pending payouts are checked inside the transaction",
        matcher: /status: "pending"/,
      },
      {
        description: "Challenge balance is updated inside the transaction",
        matcher: /tx\.challenge\.update\(/,
      },
    ],
  },
  {
    id: "payout.owner-scoped-query",
    area: "payout flows",
    claim: "Payout eligibility is scoped to the requesting user and funded challenges only.",
    file: "src/app/actions/payouts.ts",
    checks: [
      {
        description: "Payout flow is delegated to the shared payout service",
        matcher: /createPayoutRequest\(/,
      },
      {
        description: "Authenticated user is still required before payout request",
        matcher: /const user = await getAuthenticatedUser\(\)/,
      },
    ],
  },
  {
    id: "admin.payout-audit",
    area: "admin authorization",
    claim: "Admin payout review uses the transactional review service and notifies the user.",
    file: "src/app/api/admin/payouts/route.ts",
    checks: [
      {
        description: "Transactional review service is called",
        matcher: /reviewPayoutByAdmin\(/,
      },
      {
        description: "Conflict responses return 409 from the admin payouts route",
        matcher: /status: 409/,
      },
      {
        description: "Payout approval email is available",
        matcher: /payoutPaidEmail\(/,
      },
      {
        description: "Payout rejection email is available",
        matcher: /payoutRejectedEmail\(/,
      },
    ],
  },
  {
    id: "admin.payout-ui-conflict-message",
    area: "admin authorization",
    claim: "Admin payouts UI shows an explicit already-reviewed message when a concurrent review conflict happens.",
    file: "src/components/admin/AdminPayoutsQueue.tsx",
    checks: [
      {
        description: "The admin payouts UI handles RETRYABLE_CONFLICT explicitly",
        matcher: /result\.code === "RETRYABLE_CONFLICT"/,
      },
      {
        description: "The admin payouts UI shows the already-reviewed message",
        matcher: /Already reviewed by another admin\. The queue is refreshing\./,
      },
      {
        description: "The queue refreshes after the conflict message",
        matcher: /router\.refresh\(\)/,
      },
    ],
  },
  {
    id: "admin.payout-review-transaction",
    area: "admin authorization",
    claim: "Admin payout review writes payout status and audit log in one serializable transaction.",
    file: "src/lib/admin/review-service.ts",
    checks: [
      {
        description: "Pending payouts are updated with compare-and-set semantics",
        matcher: /tx\.payout\.updateMany\(/,
      },
      {
        description: "Pending status is part of the write guard",
        matcher: /status: "pending"/,
      },
      {
        description: "Payout review creates an audit log entry",
        matcher: /targetType: "payout"/,
      },
      {
        description: "Serializable conflicts are normalized instead of leaking 500s",
        matcher: /error\.code === "P2034"/,
      },
      {
        description: "Transaction isolation is serializable",
        matcher: /TransactionIsolationLevel\.Serializable/,
      },
    ],
  },
  {
    id: "admin.kyc-audit",
    area: "admin authorization",
    claim: "Admin KYC review uses the transactional review service and notifies the user.",
    file: "src/app/api/admin/kyc/route.ts",
    checks: [
      {
        description: "Transactional review service is called",
        matcher: /reviewKycByAdmin\(/,
      },
      {
        description: "KYC approval email is available",
        matcher: /kycApprovedEmail\(/,
      },
      {
        description: "KYC rejection email is available",
        matcher: /kycRejectedEmail\(/,
      },
    ],
  },
  {
    id: "admin.kyc-review-transaction",
    area: "admin authorization",
    claim: "Admin KYC review writes submission status and audit log in one serializable transaction.",
    file: "src/lib/admin/review-service.ts",
    checks: [
      {
        description: "Pending submissions are updated with compare-and-set semantics",
        matcher: /tx\.kycSubmission\.updateMany\(/,
      },
      {
        description: "Pending status is part of the write guard",
        matcher: /status: "pending"/,
      },
      {
        description: "KYC review creates an audit log entry",
        matcher: /targetType: "kyc"/,
      },
      {
        description: "Transaction isolation is serializable",
        matcher: /TransactionIsolationLevel\.Serializable/,
      },
    ],
  },
  {
    id: "settlement.admin-role-gate",
    area: "pick settlement logic",
    claim: "Manual settlement is limited to authenticated admins.",
    file: "src/app/api/admin/picks/settle/route.ts",
    checks: [
      {
        description: "Admin requests are authenticated via Supabase",
        matcher: /supabase\.auth\.getUser\(\)/,
      },
      {
        description: "Admin role is checked server-side",
        matcher: /role: "admin"/,
      },
      {
        description: "Non-admins receive a forbidden response",
        matcher: /code: "FORBIDDEN"/,
      },
    ],
  },
  {
    id: "settlement.cron-secret",
    area: "pick settlement logic",
    claim: "Automated settlement requires the CRON secret bearer token.",
    file: "src/app/api/settle/route.ts",
    checks: [
      {
        description: "CRON secret is loaded from environment",
        matcher: /CRON_SECRET/,
      },
      {
        description: "Authorization header is checked",
        matcher: /authorization/,
      },
      {
        description: "Unauthorized requests are rejected",
        matcher: /code: "UNAUTHORIZED"/,
      },
    ],
  },
  {
    id: "settlement.multi-provider-auto",
    area: "pick settlement logic",
    claim: "Automated settlement fetches final scores for both The Odds API and API-Football leagues.",
    file: "src/app/api/settle/route.ts",
    checks: [
      {
        description: "The Odds API scoring path is used",
        matcher: /fetchOddsApiScores\(/,
      },
      {
        description: "API-Football scoring path is used",
        matcher: /fetchApiFootballScores\(/,
      },
      {
        description: "Provider-specific branching chooses the scoring source",
        matcher: /config\.provider === "odds_api"/,
      },
    ],
  },
  {
    id: "picks.optimistic-balance-update",
    area: "challenge risk rules",
    claim: "Pick placement uses optimistic concurrency when deducting challenge balance.",
    file: "src/lib/picks/place-service.ts",
    checks: [
      {
        description: "Stake cap is rechecked inside the transaction",
        matcher: /const stakeViolation = baseCheckStakeCap/,
      },
      {
        description: "Balance update is conditional on the fresh balance",
        matcher: /balance: freshChallenge\.balance/,
      },
      {
        description: "Conflicts return a concrete retry error",
        matcher: /CHALLENGE_BALANCE_CHANGED/,
      },
    ],
  },
  {
    id: "geo.public-geo-block",
    area: "geo-blocking and rate limiting",
    claim: "Public pages are gated by country policy and redirected to the geo-block screen.",
    file: "src/middleware.ts",
    checks: [
      {
        description: "Country policy is resolved in middleware",
        matcher: /getCountryPolicy\(/,
      },
      {
        description: "Blocked countries are redirected",
        matcher: /"\/auth\/geo-blocked"/,
      },
    ],
  },
  {
    id: "rate-limit.webhooks-and-admin-settlement",
    area: "geo-blocking and rate limiting",
    claim: "Webhook and manual settlement routes apply route-specific rate limiting.",
    file: "src/app/api/admin/picks/settle/route.ts",
    checks: [
      {
        description: "Manual settlement uses enforceRateLimit",
        matcher: /enforceRateLimit\(/,
      },
      {
        description: "Rate-limit failures return a structured response",
        matcher: /rateLimitExceededResponse/,
      },
    ],
  },
];

const runtimeCases = [
  {
    id: "risk.drawdown-breach",
    area: "challenge risk rules",
    claim: "Drawdown fails once balance drops below 85% of the peak balance.",
    run() {
      const result = checkDrawdown(
        {
          balance: 8_499,
          highestBalance: 10_000,
          startBalance: 10_000,
          dailyStartBalance: 10_000,
        },
        RISK_POLICY,
      );
      assert.equal(result?.code, "DRAWDOWN_BREACH");
      return [`Violation code: ${result.code}`, `Message: ${result.error}`];
    },
  },
  {
    id: "risk.daily-loss-breach",
    area: "challenge risk rules",
    claim: "Daily loss fails once balance drops more than 10% below daily start balance.",
    run() {
      const result = checkDailyLoss(
        {
          balance: 8_999,
          highestBalance: 10_000,
          startBalance: 10_000,
          dailyStartBalance: 10_000,
        },
        RISK_POLICY,
      );
      assert.equal(result?.code, "DAILY_LOSS_BREACH");
      return [`Violation code: ${result.code}`, `Message: ${result.error}`];
    },
  },
  {
    id: "risk.stake-cap-breach",
    area: "challenge risk rules",
    claim: "Stake cap blocks picks above 5% of the challenge start balance.",
    run() {
      const result = checkStakeCap({ startBalance: 10_000 }, 501, RISK_POLICY);
      assert.equal(result?.code, "STAKE_CAP_EXCEEDED");
      return [`Violation code: ${result.code}`, `Message: ${result.error}`];
    },
  },
  {
    id: "risk.minimum-stake-breach",
    area: "challenge risk rules",
    claim: "Minimum stake tracks current balance with a $1 floor.",
    run() {
      const result = checkMinStake({ balance: 20_000 }, 150, RISK_POLICY);
      assert.equal(result?.code, "STAKE_MIN_VIOLATED");
      return [`Violation code: ${result.code}`, `Message: ${result.error}`];
    },
  },
  {
    id: "payout.rejects-kyc-missing",
    area: "payout flows",
    claim: "Payout requests fail without approved KYC.",
    run() {
      const result = evaluatePayoutRequest({
        payoutsEnabled: true,
        methodAllowed: true,
        kycApproved: false,
        windowOpen: true,
        minimumPayoutCents: 1_000,
        requestedProfitAmount: 1_000,
        hasPendingPayout: false,
        challenge: { startBalance: 10_000, balance: 12_000, profitSplitPct: 80 },
      });
      assert.equal(result.ok, false);
      assert.equal(result.code, "KYC_REQUIRED");
      return [`Code: ${result.code}`];
    },
  },
  {
    id: "payout.rejects-profit-overdraw",
    area: "payout flows",
    claim: "Payout requests cannot exceed available gross profit.",
    run() {
      const result = evaluatePayoutRequest({
        payoutsEnabled: true,
        methodAllowed: true,
        kycApproved: true,
        windowOpen: true,
        minimumPayoutCents: 1_000,
        requestedProfitAmount: 3_000,
        hasPendingPayout: false,
        challenge: { startBalance: 10_000, balance: 12_000, profitSplitPct: 80 },
      });
      assert.equal(result.ok, false);
      assert.equal(result.code, "EXCEEDS_PROFIT");
      return [`Code: ${result.code}`];
    },
  },
  {
    id: "payout.computes-amount-and-new-balance",
    area: "payout flows",
    claim: "Successful payout requests compute user share and remaining challenge balance deterministically.",
    run() {
      const result = evaluatePayoutRequest({
        payoutsEnabled: true,
        methodAllowed: true,
        kycApproved: true,
        windowOpen: true,
        minimumPayoutCents: 1_000,
        requestedProfitAmount: 1_500,
        hasPendingPayout: false,
        challenge: { startBalance: 10_000, balance: 12_000, profitSplitPct: 80 },
      });
      assert.equal(result.ok, true);
      assert.equal(result.payoutAmount, 1_200);
      assert.equal(result.newBalance, 10_500);
      return [
        `Gross profit: ${result.grossProfit}`,
        `Payout amount: ${result.payoutAmount}`,
        `New balance: ${result.newBalance}`,
      ];
    },
  },
  {
    id: "kyc.upload-eligibility-gates",
    area: "payout flows",
    claim: "KYC upload eligibility is blocked until payouts are enabled and the user has funded profit available.",
    run() {
      const blockedNoChallenge = evaluateKycPayoutEligibility({
        kycStatus: null,
        payoutsEnabled: true,
        fundedChallenges: [],
      });
      const blockedNoProfit = evaluateKycPayoutEligibility({
        kycStatus: null,
        payoutsEnabled: true,
        fundedChallenges: [{ startBalance: 10_000, balance: 10_000 }],
      });
      const allowed = evaluateKycPayoutEligibility({
        kycStatus: null,
        payoutsEnabled: true,
        fundedChallenges: [{ startBalance: 10_000, balance: 10_500 }],
      });

      assert.equal(blockedNoChallenge.code, "no_funded_challenge");
      assert.equal(blockedNoProfit.code, "no_profit_available");
      assert.equal(allowed.code, "eligible");

      return [
        `No challenge: ${blockedNoChallenge.code}`,
        `No profit: ${blockedNoProfit.code}`,
        `Eligible: ${allowed.code}`,
      ];
    },
  },
  {
    id: "settlement.moneyline-draw-push",
    area: "pick settlement logic",
    claim: "Moneyline draw handling returns push unless the selection is explicit draw.",
    run() {
      assert.equal(
        gradeMoneyline("Home", {
          homeTeam: "Home",
          awayTeam: "Away",
          homeScore: 1,
          awayScore: 1,
        }),
        "push",
      );
      assert.equal(
        gradeMoneyline("Draw", {
          homeTeam: "Home",
          awayTeam: "Away",
          homeScore: 1,
          awayScore: 1,
        }),
        "won",
      );
      return ["Home selection -> push", "Draw selection -> won"];
    },
  },
  {
    id: "settlement.spread-exact-cover-push",
    area: "pick settlement logic",
    claim: "Spread grading treats exact cover as a push.",
    run() {
      const result = gradeSpread("Home", -3, {
        homeTeam: "Home",
        awayTeam: "Away",
        homeScore: 24,
        awayScore: 21,
      });
      assert.equal(result, "push");
      return [`Spread result: ${result}`];
    },
  },
  {
    id: "settlement.total-over-under",
    area: "pick settlement logic",
    claim: "Total grading distinguishes over, under, and push correctly.",
    run() {
      assert.equal(
        gradeTotal("Over", 44.5, {
          homeTeam: "Home",
          awayTeam: "Away",
          homeScore: 24,
          awayScore: 21,
        }),
        "won",
      );
      assert.equal(
        gradeTotal("Under", 45, {
          homeTeam: "Home",
          awayTeam: "Away",
          homeScore: 24,
          awayScore: 21,
        }),
        "push",
      );
      return ["Over 44.5 -> won", "Under 45 -> push"];
    },
  },
  {
    id: "settlement.pick-payout-on-win-only",
    area: "pick settlement logic",
    claim: "Pick grading only stores actual payout for winning outcomes.",
    run() {
      const won = gradePick(
        {
          marketType: "moneyline",
          selection: "Home",
          linePoint: null,
          stake: 1_000,
          potentialPayout: 1_950,
        },
        {
          homeTeam: "Home",
          awayTeam: "Away",
          homeScore: 2,
          awayScore: 1,
        },
      );
      const lost = gradePick(
        {
          marketType: "moneyline",
          selection: "Away",
          linePoint: null,
          stake: 1_000,
          potentialPayout: 2_100,
        },
        {
          homeTeam: "Home",
          awayTeam: "Away",
          homeScore: 2,
          awayScore: 1,
        },
      );
      assert.equal(won.actualPayout, 1_950);
      assert.equal(lost.actualPayout, 0);
      return [
        `Winning payout: ${won.actualPayout}`,
        `Losing payout: ${lost.actualPayout}`,
      ];
    },
  },
];

const dbCases = [
  {
    id: "db.rls-user-self-scope",
    area: "auth and session handling",
    claim: "The live User table has RLS enabled with an own-row policy tied to auth.uid().",
    async run(db) {
      const [tableState, policies] = await Promise.all([
        db.$queryRawUnsafe(`
          select c.relname::text as table_name, c.relrowsecurity as "rowSecurity"
          from pg_class c
          join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public' and c.relname = 'User'
        `),
        db.$queryRawUnsafe(`
          select policyname::text as policyname, cmd::text as cmd, qual
          from pg_policies
          where schemaname = 'public' and tablename = 'User'
          order by policyname
        `),
      ]);

      assert.equal(tableState.length, 1);
      assert.equal(tableState[0].rowSecurity, true);

      const selfPolicy = policies.find((policy) =>
        policy.policyname === "users_own_row" &&
        policy.cmd === "ALL" &&
        typeof policy.qual === "string" &&
        policy.qual.includes("auth.uid()"),
      );
      assert.ok(selfPolicy, "Expected users_own_row policy tied to auth.uid()");

      return [
        `User table RLS: ${tableState[0].rowSecurity}`,
        `Own-row policy: ${selfPolicy.policyname}`,
      ];
    },
  },
  {
    id: "db.rls-sensitive-public-tables",
    area: "auth and session handling",
    claim: "Sensitive public tables have RLS enabled before app-level access control is trusted.",
    async run(db) {
      const rows = await db.$queryRawUnsafe(`
        select c.relname::text as table_name, c.relrowsecurity as row_security
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public'
          and c.relname in ('User', 'Challenge', 'Pick', 'ParlayLeg', 'Payment', 'Payout', 'PayoutProfile', 'KycSubmission', 'MarketRequest', 'Follow', 'Affiliate', 'AffiliateClick', 'AuditLog', 'CountryPolicyOverride', 'OpsEventLog')
        order by c.relname
      `);

      const missing = rows
        .filter((row) => row.row_security !== true)
        .map((row) => row.table_name);

      assert.deepEqual(
        missing,
        [],
        `RLS disabled on: ${missing.join(", ")}`,
      );

      return rows.map(
        (row) => `${row.table_name} rls=${row.row_security ? "true" : "false"}`,
      );
    },
  },
  {
    id: "db.rls-owner-policies",
    area: "auth and session handling",
    claim: "Owner-scoped read policies exist on the user-facing tables that should remain visible to the authenticated user.",
    async run(db) {
      const policies = await db.$queryRawUnsafe(`
        select tablename::text as tablename, policyname::text as policyname
        from pg_policies
        where schemaname = 'public'
          and (
            (tablename = 'Challenge' and policyname = 'users_select_own_challenges') or
            (tablename = 'Pick' and policyname = 'users_select_own_picks') or
            (tablename = 'ParlayLeg' and policyname = 'users_select_own_parlay_legs') or
            (tablename = 'Payment' and policyname = 'users_select_own_payments') or
            (tablename = 'Payout' and policyname = 'users_select_own_payouts') or
            (tablename = 'PayoutProfile' and policyname = 'users_select_own_payout_profile') or
            (tablename = 'KycSubmission' and policyname = 'users_select_own_kyc_submission') or
            (tablename = 'Affiliate' and policyname = 'users_select_own_affiliate') or
            (tablename = 'AffiliateClick' and policyname = 'users_select_own_affiliate_clicks') or
            (tablename = 'MarketRequest' and policyname = 'users_select_own_market_requests') or
            (tablename = 'Follow' and policyname = 'users_select_own_follows')
          )
        order by tablename, policyname
      `);

      const found = new Set(
        policies.map((policy) => `${policy.tablename}:${policy.policyname}`),
      );
      const expected = [
        "Affiliate:users_select_own_affiliate",
        "AffiliateClick:users_select_own_affiliate_clicks",
        "Challenge:users_select_own_challenges",
        "Follow:users_select_own_follows",
        "KycSubmission:users_select_own_kyc_submission",
        "MarketRequest:users_select_own_market_requests",
        "ParlayLeg:users_select_own_parlay_legs",
        "Payment:users_select_own_payments",
        "Payout:users_select_own_payouts",
        "PayoutProfile:users_select_own_payout_profile",
        "Pick:users_select_own_picks",
      ];
      const missing = expected.filter((entry) => !found.has(entry));

      assert.deepEqual(
        missing,
        [],
        `Owner policies missing: ${missing.join(", ")}`,
      );

      return expected;
    },
  },
  {
    id: "db.payout-persistence-and-pending-guard",
    area: "payout flows",
    claim: "Persisted payout requests debit balance once and block a second pending request on the same challenge.",
    async run(db) {
      return withDbFixture(db, async ({ trader, challenge, created }) => {
        const first = await createPayoutRequest({
          db,
          userId: trader.id,
          challengeId: challenge.id,
          method: "usdt",
          requestedProfitAmount: 1_000,
          payoutsEnabled: true,
          methodAllowed: true,
          kycApproved: true,
          windowOpen: true,
          minimumPayoutCents: 1_000,
        });

        assert.equal(first.ok, true);
        created.payoutIds.push(first.payoutId);

        const storedPayout = await db.payout.findUnique({
          where: { id: first.payoutId },
        });
        const storedChallenge = await db.challenge.findUnique({
          where: { id: challenge.id },
        });

        assert.ok(storedPayout, "Created payout row was not found");
        assert.ok(storedChallenge, "Updated challenge row was not found");
        assert.equal(storedPayout.amount, 800);
        assert.equal(storedPayout.status, "pending");
        assert.equal(storedChallenge.balance, 11_000);

        const second = await createPayoutRequest({
          db,
          userId: trader.id,
          challengeId: challenge.id,
          method: "usdt",
          requestedProfitAmount: 1_000,
          payoutsEnabled: true,
          methodAllowed: true,
          kycApproved: true,
          windowOpen: true,
          minimumPayoutCents: 1_000,
        });

        assert.equal(second.ok, false);
        assert.equal(second.code, "PENDING_EXISTS");

        return [
          `Created payout amount: ${storedPayout.amount}`,
          `Challenge balance after request: ${storedChallenge.balance}`,
          `Second request rejection: ${second.code}`,
        ];
      });
    },
  },
  {
    id: "db.webhook-lock-duplicate-fulfillment",
    area: "payments and webhooks",
    claim: "Concurrent duplicate webhook fulfillment creates only one payment and one challenge.",
    async run(db) {
      return withDbFixture(db, async ({ trader, tier, created }) => {
        const providerRef = `proof-webhook-${crypto.randomUUID().slice(0, 8)}`;

        const fulfill = () =>
          withWebhookLock(db, "stripe", providerRef, async (tx) => {
            const existing = await tx.payment.findFirst({ where: { providerRef } });
            if (existing) {
              return "duplicate";
            }

            const payment = await tx.payment.create({
              data: {
                userId: trader.id,
                tierId: tier.id,
                amount: tier.fee,
                currency: "USD",
                method: "card",
                status: "completed",
                providerRef,
              },
            });
            created.paymentIds.push(payment.id);

            const challenge = await tx.challenge.create({
              data: {
                userId: trader.id,
                tierId: tier.id,
                status: "active",
                phase: "phase1",
                balance: tier.fundedBankroll,
                startBalance: tier.fundedBankroll,
                dailyStartBalance: tier.fundedBankroll,
                highestBalance: tier.fundedBankroll,
                peakBalance: tier.fundedBankroll,
                phase1StartBalance: tier.fundedBankroll,
              },
            });
            created.challengeIds.push(challenge.id);
            return "created";
          });

        const outcomes = await Promise.all([fulfill(), fulfill()]);
        const paymentCount = await db.payment.count({ where: { providerRef } });
        const challengeCount = await db.challenge.count({
          where: {
            userId: trader.id,
            tierId: tier.id,
            status: "active",
            phase: "phase1",
          },
        });

        assert.deepEqual(outcomes.sort(), ["created", "duplicate"]);
        assert.equal(paymentCount, 1);
        assert.equal(challengeCount, 1);

        return [
          `Outcomes: ${outcomes.join(", ")}`,
          `Payment count: ${paymentCount}`,
          `Challenge count: ${challengeCount}`,
        ];
      });
    },
  },
  {
    id: "db.nowpayments-checkout-provisioning-success",
    area: "payments and webhooks",
    claim: "A completed NOWPayments webhook upgrades the pending checkout payment in place and provisions one challenge.",
    async run(db) {
      return withDbFixture(db, async ({ trader, tier, created }) => {
        const providerRef = `proof-now-success-${crypto.randomUUID().slice(0, 8)}`;
        const pendingPayment = await db.payment.create({
          data: {
            userId: trader.id,
            tierId: tier.id,
            amount: tier.fee,
            currency: "USD",
            method: "usdt",
            status: "pending",
            providerRef,
            metadata: {
              currency: "usdttrc20",
              network: "TRC20",
              checkoutCountry: "BR",
              policyVersion: "proof-v1",
            },
          },
        });
        created.paymentIds.push(pendingPayment.id);

        const outcome = await fulfillNowPaymentsPayment({
          db,
          providerRef,
          userId: trader.id,
          tierId: tier.id,
          tierFundedBankroll: tier.fundedBankroll,
          priceAmount: tier.fee / 100,
          priceCurrency: "usd",
          payCurrency: "usdttrc20",
          payAmount: 25.5,
        });

        assert.equal(outcome.status, "created");
        assert.equal(outcome.usedPendingPayment, true);

        const storedPayment = await db.payment.findUnique({
          where: { id: pendingPayment.id },
        });
        const challengeCount = await db.challenge.count({
          where: {
            userId: trader.id,
            tierId: tier.id,
            status: "active",
            phase: "phase1",
          },
        });

        assert.ok(storedPayment, "Pending payment was not found after fulfillment");
        assert.equal(storedPayment.status, "completed");
        assert.equal(storedPayment.amount, tier.fee);
        assert.equal(challengeCount, 1);

        const metadata =
          storedPayment.metadata &&
          typeof storedPayment.metadata === "object" &&
          !Array.isArray(storedPayment.metadata)
            ? storedPayment.metadata
            : null;
        assert.ok(metadata, "Updated payment metadata is missing");
        assert.equal(metadata.checkoutCountry, "BR");
        assert.equal(metadata.paymentId, providerRef);
        assert.equal(metadata.payCurrency, "usdttrc20");

        return [
          `Outcome: ${outcome.status}`,
          `Pending payment upgraded: ${String(outcome.usedPendingPayment)}`,
          `Challenge count: ${challengeCount}`,
        ];
      });
    },
  },
  {
    id: "db.nowpayments-checkout-provisioning-rollback",
    area: "payments and webhooks",
    claim: "If NOWPayments provisioning fails after payment upgrade, the transaction rolls back and the checkout payment stays pending.",
    async run(db) {
      return withDbFixture(db, async ({ trader, tier, created }) => {
        const providerRef = `proof-now-fail-${crypto.randomUUID().slice(0, 8)}`;
        const pendingPayment = await db.payment.create({
          data: {
            userId: trader.id,
            tierId: tier.id,
            amount: tier.fee,
            currency: "USD",
            method: "usdt",
            status: "pending",
            providerRef,
            metadata: {
              currency: "usdttrc20",
            },
          },
        });
        created.paymentIds.push(pendingPayment.id);

        await assert.rejects(
          fulfillNowPaymentsPayment({
            db,
            providerRef,
            userId: trader.id,
            tierId: tier.id,
            tierFundedBankroll: tier.fundedBankroll,
            priceAmount: tier.fee / 100,
            priceCurrency: "usd",
            payCurrency: "usdttrc20",
            payAmount: 25.5,
            beforeChallengeCreate() {
              throw new Error("forced_nowpayments_provision_failure");
            },
          }),
          /forced_nowpayments_provision_failure/,
        );

        const storedPayment = await db.payment.findUnique({
          where: { id: pendingPayment.id },
        });
        const challengeCount = await db.challenge.count({
          where: {
            userId: trader.id,
            tierId: tier.id,
            status: "active",
            phase: "phase1",
          },
        });

        assert.ok(storedPayment, "Pending payment disappeared after rollback");
        assert.equal(storedPayment.status, "pending");
        assert.equal(challengeCount, 0);

        return [
          `Payment status after rollback: ${storedPayment.status}`,
          `Challenge count after rollback: ${challengeCount}`,
        ];
      });
    },
  },
  {
    id: "db.nowpayments-webhook-replay-race",
    area: "payments and webhooks",
    claim: "Concurrent replay of the same NOWPayments completion upgrades the checkout payment once and provisions only one challenge.",
    async run(db) {
      return withDbFixture(db, async ({ trader, tier, created }) => {
        const providerRef = `proof-now-race-${crypto.randomUUID().slice(0, 8)}`;
        const pendingPayment = await db.payment.create({
          data: {
            userId: trader.id,
            tierId: tier.id,
            amount: tier.fee,
            currency: "USD",
            method: "usdt",
            status: "pending",
            providerRef,
            metadata: {
              currency: "usdttrc20",
              checkoutCountry: "MX",
            },
          },
        });
        created.paymentIds.push(pendingPayment.id);

        const fulfill = () =>
          fulfillNowPaymentsPayment({
            db,
            providerRef,
            userId: trader.id,
            tierId: tier.id,
            tierFundedBankroll: tier.fundedBankroll,
            priceAmount: tier.fee / 100,
            priceCurrency: "usd",
            payCurrency: "usdttrc20",
            payAmount: 25.5,
          });

        const [first, second] = await Promise.all([fulfill(), fulfill()]);
        const statuses = [first.status, second.status].sort();

        const storedPayment = await db.payment.findUnique({
          where: { id: pendingPayment.id },
        });
        const paymentCount = await db.payment.count({ where: { providerRef } });
        const challengeCount = await db.challenge.count({
          where: {
            userId: trader.id,
            tierId: tier.id,
            status: "active",
            phase: "phase1",
          },
        });

        assert.deepEqual(statuses, ["created", "duplicate"]);
        assert.ok(storedPayment, "Pending payment missing after replay race");
        assert.equal(storedPayment.status, "completed");
        assert.equal(paymentCount, 1);
        assert.equal(challengeCount, 1);

        return [
          `Statuses: ${statuses.join(", ")}`,
          `Payment count: ${paymentCount}`,
          `Challenge count: ${challengeCount}`,
        ];
      });
    },
  },
  {
    id: "db.webhook-lock-rolls-back-failed-fulfillment",
    area: "payments and webhooks",
    claim: "Webhook fulfillment rolls back partial writes when provisioning fails inside the transaction.",
    async run(db) {
      return withDbFixture(db, async ({ trader, tier }) => {
        const providerRef = `proof-webhook-fail-${crypto.randomUUID().slice(0, 8)}`;

        await assert.rejects(async () => {
          await withWebhookLock(db, "stripe", providerRef, async (tx) => {
            await tx.payment.create({
              data: {
                userId: trader.id,
                tierId: tier.id,
                amount: tier.fee,
                currency: "USD",
                method: "card",
                status: "completed",
                providerRef,
              },
            });
            throw new Error("forced_provision_failure");
          });
        }, /forced_provision_failure/);

        const paymentCount = await db.payment.count({ where: { providerRef } });
        const challengeCount = await db.challenge.count({
          where: {
            userId: trader.id,
            tierId: tier.id,
            status: "active",
            phase: "phase1",
          },
        });

        assert.equal(paymentCount, 0);
        assert.equal(challengeCount, 0);

        return [
          `Payment count after rollback: ${paymentCount}`,
          `Challenge count after rollback: ${challengeCount}`,
        ];
      });
    },
  },
  {
    id: "db.admin-payout-review-audit",
    area: "admin authorization",
    claim: "Admin payout review persists both the payout status change and the audit log entry.",
    async run(db) {
      return withDbFixture(db, async ({ trader, admin, challenge, created }) => {
        const request = await createPayoutRequest({
          db,
          userId: trader.id,
          challengeId: challenge.id,
          method: "usdt",
          requestedProfitAmount: 1_500,
          payoutsEnabled: true,
          methodAllowed: true,
          kycApproved: true,
          windowOpen: true,
          minimumPayoutCents: 1_000,
        });

        assert.equal(request.ok, true);
        created.payoutIds.push(request.payoutId);

        const reviewed = await reviewPayoutByAdmin({
          db,
          adminId: admin.id,
          payoutId: request.payoutId,
          action: "approve",
          txRef: `proof-tx-${crypto.randomUUID().slice(0, 8)}`,
        });

        assert.equal(reviewed.ok, true);
        assert.equal(reviewed.payout.status, "paid");

        const audit = await db.auditLog.findFirst({
          where: {
            adminId: admin.id,
            targetType: "payout",
            targetId: request.payoutId,
            action: "approve_payout",
          },
        });

        assert.ok(audit, "Payout audit row was not created");
        created.auditIds.push(audit.id);

        return [
          `Reviewed payout status: ${reviewed.payout.status}`,
          `Audit action: ${audit.action}`,
        ];
      });
    },
  },
  {
    id: "db.admin-payout-review-race",
    area: "admin authorization",
    claim: "Concurrent payout reviews never throw; one succeeds and the competing review returns a stable non-500 result.",
    async run(db) {
      return withDbFixture(db, async ({ trader, admin, challenge, created }) => {
        const request = await createPayoutRequest({
          db,
          userId: trader.id,
          challengeId: challenge.id,
          method: "usdt",
          requestedProfitAmount: 1_500,
          payoutsEnabled: true,
          methodAllowed: true,
          kycApproved: true,
          windowOpen: true,
          minimumPayoutCents: 1_000,
        });

        assert.equal(request.ok, true);
        created.payoutIds.push(request.payoutId);

        const [first, second] = await Promise.all([
          reviewPayoutByAdmin({
            db,
            adminId: admin.id,
            payoutId: request.payoutId,
            action: "approve",
            txRef: `proof-race-a-${crypto.randomUUID().slice(0, 8)}`,
          }),
          reviewPayoutByAdmin({
            db,
            adminId: admin.id,
            payoutId: request.payoutId,
            action: "approve",
            txRef: `proof-race-b-${crypto.randomUUID().slice(0, 8)}`,
          }),
        ]);

        const successCount = [first, second].filter((result) => result.ok).length;
        const conflictishCount = [first, second].filter(
          (result) =>
            !result.ok &&
            ["RETRYABLE_CONFLICT", "NOT_FOUND_OR_NOT_PENDING"].includes(result.code),
        ).length;

        assert.equal(successCount, 1);
        assert.equal(conflictishCount, 1);

        return [
          `Success count: ${successCount}`,
          `Competing review count: ${conflictishCount}`,
        ];
      });
    },
  },
  {
    id: "db.admin-payout-reject-audit",
    area: "admin authorization",
    claim: "Rejecting a payout restores challenge balance and persists the audit log entry.",
    async run(db) {
      return withDbFixture(db, async ({ trader, admin, challenge, created }) => {
        const request = await createPayoutRequest({
          db,
          userId: trader.id,
          challengeId: challenge.id,
          method: "usdt",
          requestedProfitAmount: 1_500,
          payoutsEnabled: true,
          methodAllowed: true,
          kycApproved: true,
          windowOpen: true,
          minimumPayoutCents: 1_000,
        });

        assert.equal(request.ok, true);
        created.payoutIds.push(request.payoutId);

        const reviewed = await reviewPayoutByAdmin({
          db,
          adminId: admin.id,
          payoutId: request.payoutId,
          action: "reject",
          adminNote: "proof reject",
        });

        assert.equal(reviewed.ok, true);
        assert.equal(reviewed.payout.status, "failed");

        const storedChallenge = await db.challenge.findUnique({
          where: { id: challenge.id },
          select: { balance: true },
        });

        const audit = await db.auditLog.findFirst({
          where: {
            adminId: admin.id,
            targetType: "payout",
            targetId: request.payoutId,
            action: "reject_payout",
          },
        });

        assert.ok(audit, "Payout rejection audit row was not created");
        assert.ok(storedChallenge, "Challenge missing after payout rejection");
        assert.equal(storedChallenge.balance, 12_000);
        created.auditIds.push(audit.id);

        return [
          `Rejected payout status: ${reviewed.payout.status}`,
          `Restored balance: ${storedChallenge.balance}`,
          `Audit action: ${audit.action}`,
        ];
      });
    },
  },
  {
    id: "db.admin-kyc-review-audit",
    area: "admin authorization",
    claim: "Admin KYC review persists both the submission status change and the audit log entry.",
    async run(db) {
      return withDbFixture(db, async ({ admin, pendingKyc, created }) => {
        const reviewed = await reviewKycByAdmin({
          db,
          adminId: admin.id,
          submissionId: pendingKyc.id,
          action: "approve",
        });

        assert.ok(reviewed, "Reviewed KYC submission was not returned");
        assert.equal(reviewed.status, "approved");

        const audit = await db.auditLog.findFirst({
          where: {
            adminId: admin.id,
            targetType: "kyc",
            targetId: pendingKyc.id,
            action: "approve_kyc",
          },
        });

        assert.ok(audit, "KYC audit row was not created");
        created.auditIds.push(audit.id);

        return [
          `Reviewed KYC status: ${reviewed.status}`,
          `Audit action: ${audit.action}`,
        ];
      });
    },
  },
  {
    id: "db.admin-kyc-reject-audit",
    area: "admin authorization",
    claim: "Rejecting KYC persists rejected status and the audit log entry.",
    async run(db) {
      return withDbFixture(db, async ({ admin, pendingKyc, created }) => {
        const reviewed = await reviewKycByAdmin({
          db,
          adminId: admin.id,
          submissionId: pendingKyc.id,
          action: "reject",
          reviewNote: "proof reject",
        });

        assert.ok(reviewed, "Rejected KYC submission was not returned");
        assert.equal(reviewed.status, "rejected");

        const audit = await db.auditLog.findFirst({
          where: {
            adminId: admin.id,
            targetType: "kyc",
            targetId: pendingKyc.id,
            action: "reject_kyc",
          },
        });

        assert.ok(audit, "KYC rejection audit row was not created");
        created.auditIds.push(audit.id);

        return [
          `Rejected KYC status: ${reviewed.status}`,
          `Audit action: ${audit.action}`,
        ];
      });
    },
  },
  {
    id: "db.pick-placement-concurrency",
    area: "challenge risk rules",
    claim: "Concurrent pick placement only debits one pick when both requests race on the same balance snapshot.",
    async run(db) {
      return withDbFixture(db, async ({ trader, tier, created }) => {
        const challenge = await db.challenge.create({
          data: {
            userId: trader.id,
            tierId: tier.id,
            status: "active",
            phase: "phase1",
            balance: 50_000,
            startBalance: 1_000_000,
            dailyStartBalance: 50_000,
            highestBalance: 1_000_000,
            peakBalance: 1_000_000,
            phase1StartBalance: 1_000_000,
          },
        });
        created.challengeIds.push(challenge.id);

        const args = {
          db,
          challengeId: challenge.id,
          userId: trader.id,
          sport: "basketball",
          league: "nba",
          event: `evt-${crypto.randomUUID().slice(0, 8)}`,
          eventName: "Proof Event",
          marketType: "moneyline",
          selection: "Home",
          odds: 2,
          linePoint: null,
          stake: 40_000,
          potentialPayout: 80_000,
          eventStart: new Date("2030-01-01T00:00:00.000Z"),
        };

        const [first, second] = await Promise.all([
          placePickRequest(args),
          placePickRequest(args),
        ]);

        const successCount = [first, second].filter((result) => result.ok).length;
        const blockedCount = [first, second].filter(
          (result) =>
            !result.ok &&
            ["CHALLENGE_BALANCE_CHANGED", "INSUFFICIENT_BALANCE"].includes(result.code),
        ).length;

        const storedChallenge = await db.challenge.findUnique({
          where: { id: challenge.id },
        });
        const pickCount = await db.pick.count({ where: { challengeId: challenge.id } });

        assert.equal(successCount, 1);
        assert.equal(blockedCount, 1);
        assert.ok(storedChallenge, "Challenge not found after concurrent placement");
        assert.equal(storedChallenge.balance, 10_000);
        assert.equal(pickCount, 1);

        return [
          `Success count: ${successCount}`,
          `Blocked count: ${blockedCount}`,
          `Final balance: ${storedChallenge.balance}`,
          `Pick count: ${pickCount}`,
        ];
      });
    },
  },
  {
    id: "db.settlement-sequential-ordering",
    area: "pick settlement logic",
    claim: "Sequential settlement of multiple pending picks on the same challenge preserves cumulative balance updates.",
    async run(db) {
      return withDbFixture(db, async ({ trader, tier, created }) => {
        const challenge = await db.challenge.create({
          data: {
            userId: trader.id,
            tierId: tier.id,
            status: "active",
            phase: "phase1",
            balance: 8_000,
            startBalance: 10_000,
            dailyStartBalance: 8_000,
            highestBalance: 10_000,
            peakBalance: 10_000,
            phase1StartBalance: 10_000,
          },
        });
        created.challengeIds.push(challenge.id);

        const firstPick = await db.pick.create({
          data: {
            challengeId: challenge.id,
            userId: trader.id,
            sport: "basketball",
            league: "nba",
            event: `evt-a-${crypto.randomUUID().slice(0, 8)}`,
            eventName: "Proof Event A",
            marketType: "moneyline",
            selection: "Home",
            odds: 2,
            stake: 1_000,
            potentialPayout: 2_000,
            eventStart: new Date("2025-01-01T00:00:00.000Z"),
          },
        });

        const secondPick = await db.pick.create({
          data: {
            challengeId: challenge.id,
            userId: trader.id,
            sport: "basketball",
            league: "nba",
            event: `evt-b-${crypto.randomUUID().slice(0, 8)}`,
            eventName: "Proof Event B",
            marketType: "moneyline",
            selection: "Away",
            odds: 1.8,
            stake: 1_000,
            potentialPayout: 1_800,
            eventStart: new Date("2025-01-01T00:00:00.000Z"),
          },
        });

        const first = await settlePendingPick(db, {
          pickId: firstPick.id,
          status: "won",
          settledAt: new Date("2025-01-02T00:00:00.000Z"),
        });
        const second = await settlePendingPick(db, {
          pickId: secondPick.id,
          status: "push",
          settledAt: new Date("2025-01-02T00:01:00.000Z"),
        });

        assert.equal(first.ok, true);
        assert.equal(second.ok, true);

        const storedChallenge = await db.challenge.findUnique({
          where: { id: challenge.id },
        });

        assert.ok(storedChallenge, "Challenge missing after settlement sequence");
        assert.equal(storedChallenge.balance, 10_000);

        return [
          `First result balance: ${first.challenge.balance}`,
          `Second result balance: ${second.challenge.balance}`,
          `Final balance: ${storedChallenge.balance}`,
        ];
      });
    },
  },
  {
    id: "db.admin-manual-settlement-override",
    area: "pick settlement logic",
    claim: "Manual settlement override persists the chosen outcome and challenge balance update.",
    async run(db) {
      return withDbFixture(db, async ({ trader, tier, created }) => {
        const challenge = await db.challenge.create({
          data: {
            userId: trader.id,
            tierId: tier.id,
            status: "active",
            phase: "phase1",
            balance: 9_000,
            startBalance: 10_000,
            dailyStartBalance: 9_000,
            highestBalance: 10_000,
            peakBalance: 10_000,
            phase1StartBalance: 10_000,
          },
        });
        created.challengeIds.push(challenge.id);

        const pick = await db.pick.create({
          data: {
            challengeId: challenge.id,
            userId: trader.id,
            sport: "basketball",
            league: "nba",
            event: `evt-manual-${crypto.randomUUID().slice(0, 8)}`,
            eventName: "Manual Override Event",
            marketType: "moneyline",
            selection: "Home",
            odds: 2,
            stake: 1_000,
            potentialPayout: 2_000,
            eventStart: new Date("2025-01-01T00:00:00.000Z"),
          },
        });

        const result = await settlePendingPick(db, {
          pickId: pick.id,
          status: "void",
          settledAt: new Date("2025-01-02T00:00:00.000Z"),
        });

        assert.equal(result.ok, true);
        assert.equal(result.pick.status, "void");
        assert.equal(result.challenge.balance, 10_000);

        return [
          `Settled pick status: ${result.pick.status}`,
          `Challenge balance: ${result.challenge.balance}`,
        ];
      });
    },
  },
  {
    id: "db.admin-user-ban-cycle",
    area: "admin authorization",
    claim: "Admin ban and unban mutations persist user restriction state and audit entries.",
    async run(db) {
      return withDbFixture(db, async ({ trader, admin, created }) => {
        const banned = await setUserBanState(db, {
          adminId: admin.id,
          userId: trader.id,
          banned: true,
          reason: "proof moderation",
        });

        assert.equal(banned.user.isBanned, true);
        assert.equal(banned.user.banReason, "proof moderation");
        created.auditIds.push(banned.audit.id);

        const unbanned = await setUserBanState(db, {
          adminId: admin.id,
          userId: trader.id,
          banned: false,
        });

        assert.equal(unbanned.user.isBanned, false);
        assert.equal(unbanned.user.banReason, null);
        created.auditIds.push(unbanned.audit.id);

        return [
          `Ban audit action: ${banned.audit.action}`,
          `Unban audit action: ${unbanned.audit.action}`,
        ];
      });
    },
  },
];

function formatCase(caseResult) {
  const evidence = caseResult.evidence.length
    ? caseResult.evidence.map((item) => `- ${item}`).join("\n")
    : "- None";
  return [
    `### ${caseResult.status} ${caseResult.id}`,
    `Area: ${caseResult.area}`,
    `Claim: ${caseResult.claim}`,
    `Detail: ${caseResult.detail}`,
    "Evidence:",
    evidence,
    "",
  ].join("\n");
}

function formatUnverifiedCase(item) {
  return `- ${item.area}: ${item.claim} -- ${item.reason}`;
}

function collectSqlArtifacts(rootDir) {
  const locations = ["prisma", "supabase", "db", "sql"];
  const matches = [];

  function walk(currentPath) {
    if (!fs.existsSync(currentPath)) {
      return;
    }

    for (const entry of fs.readdirSync(currentPath, { withFileTypes: true })) {
      const absolutePath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        walk(absolutePath);
        continue;
      }
      if (entry.name.endsWith(".sql")) {
        matches.push(path.relative(ROOT, absolutePath));
      }
    }
  }

  for (const location of locations) {
    walk(path.join(rootDir, location));
  }

  return matches.sort();
}

function buildBaseUnverifiedCases() {
  return [
    {
      area: "payments and webhooks",
      claim: "Provider console settings, secret rotation, and callback allowlists are configured safely.",
      reason: "Unverified because those controls live outside this repository.",
    },
    {
      area: "geo-blocking and rate limiting",
      claim: "Rate limiting is effective across all production instances and regions.",
      reason:
        "Unverified under real production traffic across regions, even though the implementation now uses shared Postgres state.",
    },
    {
      area: "geo-blocking and rate limiting",
      claim: "Geo-IP derivation always reflects the user's real jurisdiction.",
      reason:
        "Unverified because it depends on provider headers and external IP lookup behavior at runtime.",
    },
  ];
}

async function createProofDbClient() {
  const { PrismaClient } = require("@prisma/client");
  const { PrismaPg } = require("@prisma/adapter-pg");
  const { Pool } = require("pg");

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1,
  });
  const adapter = new PrismaPg(pool);
  const db = new PrismaClient({
    adapter,
    log: ["error"],
  });

  return {
    db,
    async close() {
      await db.$disconnect();
      await pool.end();
    },
  };
}

function buildRlsUnavailableReason(context) {
  const sqlArtifacts = collectSqlArtifacts(ROOT);
  const artifactContext =
    sqlArtifacts.length > 0
      ? ` SQL artifacts found: ${sqlArtifacts.join(", ")}.`
      : " No SQL policy files or prisma/migrations directory were found in this repository.";

  return `${context}.${artifactContext}`;
}

async function withDbFixture(db, run) {
  const suffix = crypto.randomUUID().slice(0, 8);
  const created = {
    auditIds: [],
    paymentIds: [],
    payoutIds: [],
    challengeIds: [],
    kycIds: [],
    userIds: [],
    tierIds: [],
  };

  try {
    const tier = await db.tier.create({
      data: {
        name: `Proof Tier ${suffix}`,
        fee: 1_999,
        fundedBankroll: 10_000,
        profitSplitPct: 80,
        minPicks: 15,
        guideIncluded: false,
        sortOrder: 99,
      },
    });
    created.tierIds.push(tier.id);

    const trader = await db.user.create({
      data: {
        email: `proof-trader-${suffix}@example.com`,
        supabaseId: `proof-trader-${suffix}`,
        name: "Proof Trader",
      },
    });
    created.userIds.push(trader.id);

    const admin = await db.user.create({
      data: {
        email: `proof-admin-${suffix}@example.com`,
        supabaseId: `proof-admin-${suffix}`,
        name: "Proof Admin",
        role: "admin",
      },
    });
    created.userIds.push(admin.id);

    const kycApproved = await db.kycSubmission.create({
      data: {
        userId: trader.id,
        status: "approved",
        fullName: "Proof Trader",
        dateOfBirth: new Date("1990-01-01T00:00:00.000Z"),
        country: "US",
        idType: "passport",
        idFrontUrl: `proof://front/${suffix}`,
      },
    });
    created.kycIds.push(kycApproved.id);

    const challenge = await db.challenge.create({
      data: {
        userId: trader.id,
        tierId: tier.id,
        status: "funded",
        phase: "funded",
        balance: 12_000,
        startBalance: 10_000,
        dailyStartBalance: 12_000,
        highestBalance: 12_000,
        peakBalance: 12_000,
      },
    });
    created.challengeIds.push(challenge.id);

    const pendingKycUser = await db.user.create({
      data: {
        email: `proof-kyc-${suffix}@example.com`,
        supabaseId: `proof-kyc-${suffix}`,
        name: "Proof KYC User",
      },
    });
    created.userIds.push(pendingKycUser.id);

    const pendingKyc = await db.kycSubmission.create({
      data: {
        userId: pendingKycUser.id,
        status: "pending",
        fullName: "Proof KYC User",
        dateOfBirth: new Date("1992-02-02T00:00:00.000Z"),
        country: "MX",
        idType: "passport",
        idFrontUrl: `proof://pending-front/${suffix}`,
      },
    });
    created.kycIds.push(pendingKyc.id);

    return await run({
      trader,
      admin,
      tier,
      challenge,
      pendingKyc,
      created,
    });
  } finally {
    if (
      created.auditIds.length > 0 ||
      created.userIds.length > 0 ||
      created.challengeIds.length > 0 ||
      created.payoutIds.length > 0 ||
      created.kycIds.length > 0
    ) {
      await db.auditLog.deleteMany({
        where: {
          OR: [
            created.auditIds.length > 0
              ? { id: { in: created.auditIds } }
              : undefined,
            created.userIds.length > 0
              ? { adminId: { in: created.userIds } }
              : undefined,
            created.userIds.length > 0
              ? { targetType: "user", targetId: { in: created.userIds } }
              : undefined,
            created.challengeIds.length > 0
              ? {
                  targetType: "challenge",
                  targetId: { in: created.challengeIds },
                }
              : undefined,
            created.payoutIds.length > 0
              ? { targetType: "payout", targetId: { in: created.payoutIds } }
              : undefined,
            created.kycIds.length > 0
              ? { targetType: "kyc", targetId: { in: created.kycIds } }
              : undefined,
          ].filter(Boolean),
        },
      });
    }
    if (created.payoutIds.length > 0) {
      await db.payout.deleteMany({ where: { id: { in: created.payoutIds } } });
    }
    if (created.paymentIds.length > 0) {
      await db.payment.deleteMany({ where: { id: { in: created.paymentIds } } });
    }
    if (created.challengeIds.length > 0 || created.userIds.length > 0) {
      await db.pick.deleteMany({
        where:
          created.challengeIds.length > 0
            ? {
                OR: [
                  { challengeId: { in: created.challengeIds } },
                  created.userIds.length > 0
                    ? { challenge: { userId: { in: created.userIds } } }
                    : undefined,
                ].filter(Boolean),
              }
            : { challenge: { userId: { in: created.userIds } } },
      });
      await db.challenge.deleteMany({
        where:
          created.challengeIds.length > 0
            ? {
                OR: [
                  { id: { in: created.challengeIds } },
                  created.userIds.length > 0
                    ? { userId: { in: created.userIds } }
                    : undefined,
                ].filter(Boolean),
              }
            : { userId: { in: created.userIds } },
      });
    }
    if (created.kycIds.length > 0) {
      await db.kycSubmission.deleteMany({ where: { id: { in: created.kycIds } } });
    }
    if (created.userIds.length > 0) {
      await db.user.deleteMany({ where: { id: { in: created.userIds } } });
    }
    if (created.tierIds.length > 0) {
      await db.tier.deleteMany({ where: { id: { in: created.tierIds } } });
    }
  }
}

async function runDbProofsIfEnabled() {
  if (process.env.VALIDATE_PROOF_DB !== "1") {
    return {
      results: [],
      unverified: [
        {
          area: "auth and session handling",
          claim: "Live RLS coverage for public tables was inspected against the development database.",
          reason: buildRlsUnavailableReason(
            "Unverified because VALIDATE_PROOF_DB=1 was not set",
          ),
        },
        {
          area: "database-backed validation",
          claim: "DB-backed payout and admin mutation proofs were executed against a disposable Postgres database.",
          reason: "Unverified because VALIDATE_PROOF_DB=1 was not set.",
        },
      ],
    };
  }

  if (!process.env.DATABASE_URL) {
    return {
      results: [],
      unverified: [
        {
          area: "auth and session handling",
          claim: "Live RLS coverage for public tables was inspected against the development database.",
          reason: buildRlsUnavailableReason(
            "Unverified because DATABASE_URL is not set in this shell environment",
          ),
        },
        {
          area: "database-backed validation",
          claim: "DB-backed payout and admin mutation proofs were executed against a disposable Postgres database.",
          reason: "Unverified because DATABASE_URL is not set in this shell environment.",
        },
      ],
    };
  }

  if (process.env.NODE_ENV === "production") {
    return {
      results: [],
      unverified: [
        {
          area: "auth and session handling",
          claim: "Live RLS coverage for public tables was inspected against the development database.",
          reason: buildRlsUnavailableReason(
            "Unverified because the validator refuses to run DB mutation proofs in NODE_ENV=production",
          ),
        },
        {
          area: "database-backed validation",
          claim: "DB-backed payout and admin mutation proofs were executed against a disposable Postgres database.",
          reason: "Unverified because the validator refuses to run DB mutation proofs in NODE_ENV=production.",
        },
      ],
    };
  }

  const { db, close } = await createProofDbClient();
  try {
    try {
      await db.$queryRawUnsafe("SELECT 1");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (
        /can't reach database server/i.test(message) ||
        /database not reachable/i.test(message) ||
        /ECONN/i.test(message) ||
        /timeout/i.test(message)
      ) {
        return {
          results: [],
          unverified: [
            {
              area: "auth and session handling",
              claim: "Live RLS coverage for public tables was inspected against the development database.",
              reason: buildRlsUnavailableReason(
                "Unverified because the configured DATABASE_URL could not be reached from this environment",
              ),
            },
            {
              area: "database-backed validation",
              claim: "DB-backed payout and admin mutation proofs were executed against a disposable Postgres database.",
              reason:
                "Unverified because the configured DATABASE_URL could not be reached from this environment.",
            },
          ],
        };
      }
      throw error;
    }

    const results = [];
    for (const testCase of dbCases) {
      results.push(await runDbCase(testCase, db));
    }
    return { results, unverified: [] };
  } finally {
    await close();
  }
}

async function main() {
  const dbProofs = await runDbProofsIfEnabled();
  const results = [
    ...sourceCases.map(runSourceCase),
    ...runtimeCases.map(runRuntimeCase),
    ...dbProofs.results,
  ];
  const unverifiedCases = [
    ...buildBaseUnverifiedCases(),
    ...dbProofs.unverified,
  ];

  const counts = results.reduce(
    (acc, result) => {
      acc[result.status] += 1;
      return acc;
    },
    { VERIFIED: 0, FAILED: 0 },
  );

  const report = [
    "# Playfunded Proof-Based Validation Report",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "This report follows a Shannon-style rule: claims must be backed by executable or source-level proof. Anything not proven is listed as unverified.",
    "",
    "## Summary",
    "",
    `- Verified checks: ${counts.VERIFIED}`,
    `- Failed checks: ${counts.FAILED}`,
    `- Unverified claims: ${unverifiedCases.length}`,
    "",
    "## Verified And Failed Checks",
    "",
    ...results.map(formatCase),
    "## Unverified Claims",
    "",
    ...unverifiedCases.map(formatUnverifiedCase),
    "",
  ].join("\n");

  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, report, "utf8");
  process.stdout.write(report);

  if (counts.FAILED > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
