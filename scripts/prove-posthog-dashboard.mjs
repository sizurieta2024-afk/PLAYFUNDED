#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs";

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL posthog_dashboard: ${message}`);
    process.exit(1);
  }
}

const setupPath = "scripts/setup-posthog-launch-dashboard.mjs";
const docsPath = "docs/ops/posthog-launch-dashboard-setup-2026-05-14.md";
const eventsPath = "src/lib/analytics/events.ts";
const packagePath = "package.json";

for (const file of [setupPath, docsPath, eventsPath, packagePath]) {
  assert(fs.existsSync(file), `${file} is missing`);
}

const dryRun = spawnSync(process.execPath, [setupPath, "--dry-run"], {
  encoding: "utf8",
});

assert(dryRun.status === 0, dryRun.stderr || "dashboard dry-run failed");

let report;
try {
  report = JSON.parse(dryRun.stdout);
} catch (error) {
  assert(false, `dry-run did not emit JSON: ${error.message}`);
}

assert(report.mode === "dry-run", "dry-run report must identify dry-run mode");
assert(
  report.dashboard === "PlayFunded Launch Command Center",
  "dashboard name changed unexpectedly",
);
assert(Array.isArray(report.insights), "dry-run report must include insights");
assert(report.insights.length >= 7, "dashboard must include launch-critical insights");

for (const scope of [
  "dashboard:read",
  "dashboard:write",
  "insight:read",
  "insight:write",
]) {
  assert(
    report.requiredPersonalApiKeyScopes.includes(scope),
    `missing required PostHog scope ${scope}`,
  );
}

const eventSource = fs.readFileSync(eventsPath, "utf8");
const dashboardEvents = new Set(
  report.insights.flatMap((insight) => insight.events).filter((event) => event !== "$pageview"),
);

for (const event of dashboardEvents) {
  assert(
    eventSource.includes(`"${event}"`),
    `dashboard references event not defined in AnalyticsEvents: ${event}`,
  );
}

for (const requiredEvent of [
  "signup_started",
  "email_verified",
  "checkout_started",
  "checkout_created",
  "payment_completed",
  "first_pick_placed",
  "group_created",
  "affiliate_application_submitted",
  "payout_requested",
]) {
  assert(
    dashboardEvents.has(requiredEvent),
    `dashboard is missing required launch event ${requiredEvent}`,
  );
}

const docs = fs.readFileSync(docsPath, "utf8");
assert(
  docs.includes("npm run posthog:dashboard:setup"),
  "dashboard setup docs must include the setup command",
);
assert(
  docs.includes("POSTHOG_PERSONAL_API_KEY"),
  "dashboard setup docs must explain the private API key",
);

const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
assert(
  packageJson.scripts["posthog:dashboard:setup"]?.includes(setupPath),
  "package script posthog:dashboard:setup must run setup script",
);
assert(
  packageJson.scripts["proof:posthog-dashboard"]?.includes("prove-posthog-dashboard"),
  "package script proof:posthog-dashboard is missing",
);

console.log("PASS posthog_dashboard");
