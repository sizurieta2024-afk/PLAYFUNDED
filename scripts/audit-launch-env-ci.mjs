const scope = process.env.CI_AUDIT_SCOPE ?? "full";

const requiredRuntime =
  scope === "launch_smokes"
    ? [
        "DATABASE_URL",
        "DIRECT_URL",
        "NEXT_PUBLIC_SUPABASE_URL",
        "NEXT_PUBLIC_SUPABASE_ANON_KEY",
        "SUPABASE_SERVICE_ROLE_KEY",
        "CRON_SECRET",
        "NEXT_PUBLIC_APP_URL",
      ]
    : [
        "DATABASE_URL",
        "DIRECT_URL",
        "NEXT_PUBLIC_SUPABASE_URL",
        "NEXT_PUBLIC_SUPABASE_ANON_KEY",
        "SUPABASE_SERVICE_ROLE_KEY",
        "CRON_SECRET",
        "STRIPE_SECRET_KEY",
        "STRIPE_WEBHOOK_SECRET",
        "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
        "NOWPAYMENTS_API_KEY",
        "NOWPAYMENTS_IPN_SECRET",
        "NOWPAYMENTS_PAYOUT_EMAIL",
        "NOWPAYMENTS_PAYOUT_PASSWORD",
        "ODDS_API_KEY",
        "API_FOOTBALL_KEY",
        "RESEND_API_KEY",
        "RESEND_FROM_EMAIL",
        "NEXT_PUBLIC_APP_URL",
        "SUPPORT_EMAIL",
      ];

const requiredWorkflow =
  scope === "launch_smokes" ? [] : ["PF_BASE_URL", "PF_CRON_SECRET"];
const recommendedRuntime = [
  "KYC_SCAN_MODE",
  "CLAMAV_HOST",
  "CLAMAV_PORT",
  "CLAMAV_TIMEOUT_MS",
  "KYC_QUARANTINE_BUCKET",
];
const recommendedWorkflow = ["PF_ALERT_WEBHOOK_URL", "PF_ALERT_WEBHOOK_KIND"];

function missing(keys) {
  return keys.filter((key) => !process.env[key]);
}

const report = {
  generatedAt: new Date().toISOString(),
  scope,
  requiredRuntimeMissing: missing(requiredRuntime),
  requiredWorkflowMissing: missing(requiredWorkflow),
  recommendedRuntimeMissing: missing(recommendedRuntime),
  recommendedWorkflowMissing: missing(recommendedWorkflow),
};

console.log(JSON.stringify(report, null, 2));

if (
  report.requiredRuntimeMissing.length > 0 ||
  report.requiredWorkflowMissing.length > 0
) {
  process.exit(1);
}
