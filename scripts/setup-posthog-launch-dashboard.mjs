#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const ENV_FILE = path.join(ROOT, ".env.local");
const DASHBOARD_NAME = "PlayFunded Launch Command Center";
const DASHBOARD_TAGS = ["playfunded", "launch"];
const REQUIRED_SCOPES = ["dashboard:read", "dashboard:write", "insight:read", "insight:write"];

function loadLocalEnv() {
  if (!fs.existsSync(ENV_FILE)) return;
  const content = fs.readFileSync(ENV_FILE, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key]) continue;
    process.env[key] = rawValue.trim().replace(/^["']|["']$/g, "");
  }
}

function stripTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}

function derivePrivatePostHogHost(publicHost) {
  if (!publicHost) return "https://eu.posthog.com";
  const host = stripTrailingSlash(publicHost);
  if (host.includes("eu.i.posthog.com")) return "https://eu.posthog.com";
  if (host.includes("us.i.posthog.com")) return "https://us.posthog.com";
  if (host.includes("app.posthog.com")) return "https://app.posthog.com";
  if (host.includes(".i.posthog.com")) return host.replace(".i.posthog.com", ".posthog.com");
  return host;
}

function eventNode(event, name) {
  return {
    kind: "EventsNode",
    event,
    name,
    custom_name: name,
    math: "total",
  };
}

function trend(name, events) {
  return {
    name,
    query: {
      kind: "InsightVizNode",
      source: {
        kind: "TrendsQuery",
        dateRange: { date_from: "-30d" },
        interval: "day",
        filterTestAccounts: true,
        series: events.map(([event, label]) => eventNode(event, label)),
      },
    },
  };
}

function funnel(name, steps, conversionWindowDays = 14) {
  return {
    name,
    query: {
      kind: "InsightVizNode",
      source: {
        kind: "FunnelsQuery",
        dateRange: { date_from: "-30d" },
        filterTestAccounts: true,
        funnelsFilter: {
          layout: "horizontal",
          conversionWindow: {
            unit: "day",
            value: conversionWindowDays,
          },
        },
        series: steps.map(([event, label]) => eventNode(event, label)),
      },
    },
  };
}

const INSIGHTS = [
  {
    ...trend("01 Acquisition: traffic, locale, and buy intent", [
      ["$pageview", "Page views"],
      ["locale_selected", "Locale changed"],
      ["challenge_tier_cta_clicked", "Buy challenge CTA clicked"],
    ]),
    description:
      "Top-of-funnel signal: visits, language switching, and challenge purchase intent.",
  },
  {
    ...funnel("02 Auth: signup to verified account", [
      ["signup_started", "Signup started"],
      ["signup_verification_sent", "Verification email sent"],
      ["email_verified", "Email verified"],
      ["login_succeeded", "Login succeeded"],
    ]),
    description:
      "Shows whether email/password users complete verification before becoming active users.",
  },
  {
    ...funnel("03 Revenue: buy intent to paid challenge", [
      ["challenge_tier_cta_clicked", "Buy challenge CTA clicked"],
      ["checkout_started", "Checkout started"],
      ["checkout_created", "Checkout created"],
      ["payment_completed", "Payment completed"],
    ]),
    description:
      "Launch revenue funnel from product CTA through confirmed payment webhook.",
  },
  {
    ...funnel("04 Activation: paid user to first useful action", [
      ["payment_completed", "Payment completed"],
      ["first_pick_placed", "First pick placed"],
      ["group_created", "Group created"],
    ]),
    description:
      "Checks whether paid users reach the first pick and social activation moments.",
  },
  {
    ...trend("05 Groups: social feature adoption", [
      ["group_created", "Groups created"],
      ["group_joined", "Groups joined"],
      ["group_left", "Groups left"],
      ["group_deleted", "Groups deleted"],
    ]),
    description:
      "Tracks whether challenge groups are helping users engage with friends.",
  },
  {
    ...funnel("06 Affiliate: application to attributed revenue", [
      ["affiliate_application_submitted", "Affiliate application submitted"],
      ["challenge_tier_cta_clicked", "Buy challenge CTA clicked"],
      ["checkout_started", "Checkout started"],
      ["payment_completed", "Payment completed"],
    ]),
    description:
      "Soft-launch affiliate funnel. Use payment properties to segment by affiliate/discount code presence.",
  },
  {
    ...trend("07 Payout intent and rollover behavior", [
      ["payout_requested", "Payout requested"],
      ["payout_rollover_requested", "Rollover requested"],
    ]),
    description:
      "Late-funnel operational signal for payout demand and rollover preference.",
  },
];

function getConfig() {
  loadLocalEnv();
  const personalApiKey = process.env.POSTHOG_PERSONAL_API_KEY;
  const environmentId =
    process.env.POSTHOG_ENVIRONMENT_ID || process.env.POSTHOG_PROJECT_ID;
  const apiHost = stripTrailingSlash(
    process.env.POSTHOG_API_HOST ||
      derivePrivatePostHogHost(process.env.NEXT_PUBLIC_POSTHOG_HOST),
  );
  return { personalApiKey, environmentId, apiHost };
}

function isDryRun() {
  return process.argv.includes("--dry-run");
}

function endpoint(config, pathname, query = {}) {
  const url = new URL(
    `/api/environments/${encodeURIComponent(config.environmentId)}${pathname}`,
    `${config.apiHost}/`,
  );
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  }
  return url;
}

async function requestJson(config, method, pathname, body, query) {
  const response = await fetch(endpoint(config, pathname, query), {
    method,
    headers: {
      Authorization: `Bearer ${config.personalApiKey}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const detail =
      typeof data?.detail === "string"
        ? data.detail
        : typeof data?.message === "string"
          ? data.message
          : text.slice(0, 300);
    throw new Error(`${method} ${pathname} failed with ${response.status}: ${detail}`);
  }
  return data;
}

async function findDashboard(config) {
  const data = await requestJson(config, "GET", "/dashboards/", null, {
    search: DASHBOARD_NAME,
    limit: 100,
  });
  return data.results?.find((dashboard) => dashboard.name === DASHBOARD_NAME && !dashboard.deleted);
}

async function ensureDashboard(config) {
  const existing = await findDashboard(config);
  if (existing) return existing;

  return requestJson(config, "POST", "/dashboards/", {
    name: DASHBOARD_NAME,
    description:
      "Launch command center for acquisition, auth verification, checkout, activation, groups, affiliates, and payouts.",
    pinned: true,
    tags: DASHBOARD_TAGS,
  });
}

async function findInsight(config, name) {
  const data = await requestJson(config, "GET", "/insights/", null, {
    search: name,
    saved: true,
    limit: 100,
  });
  return data.results?.find((insight) => insight.name === name && !insight.deleted);
}

async function ensureInsight(config, dashboardId, insight) {
  const existing = await findInsight(config, insight.name);
  const body = {
    name: insight.name,
    description: insight.description,
    query: insight.query,
    dashboards: [dashboardId],
    tags: DASHBOARD_TAGS,
    favorited: true,
  };

  if (existing) {
    return requestJson(config, "PATCH", `/insights/${existing.id}/`, body);
  }
  return requestJson(config, "POST", "/insights/", body);
}

function printDryRun(config) {
  const configured = Boolean(config.personalApiKey && config.environmentId);
  console.log(
    JSON.stringify(
      {
        mode: "dry-run",
        dashboard: DASHBOARD_NAME,
        apiHost: config.apiHost,
        environmentConfigured: Boolean(config.environmentId),
        personalApiKeyConfigured: Boolean(config.personalApiKey),
        canRunLive: configured,
        requiredPersonalApiKeyScopes: REQUIRED_SCOPES,
        insights: INSIGHTS.map((insight) => ({
          name: insight.name,
          description: insight.description,
          queryKind: insight.query.source.kind,
          events: insight.query.source.series.map((series) => series.event),
        })),
      },
      null,
      2,
    ),
  );
}

async function main() {
  const config = getConfig();
  if (isDryRun()) {
    printDryRun(config);
    return;
  }

  if (!config.personalApiKey || !config.environmentId) {
    console.error(
      [
        "Missing PostHog dashboard credentials.",
        "Set POSTHOG_PERSONAL_API_KEY and POSTHOG_ENVIRONMENT_ID (or POSTHOG_PROJECT_ID), then rerun:",
        "npm run posthog:dashboard:setup",
        "",
        "Required personal API key scopes:",
        REQUIRED_SCOPES.map((scope) => `- ${scope}`).join("\n"),
        "",
        "Use -- --dry-run to preview the dashboard without touching PostHog.",
      ].join("\n"),
    );
    process.exit(1);
  }

  const dashboard = await ensureDashboard(config);
  const results = [];
  for (const insight of INSIGHTS) {
    const result = await ensureInsight(config, dashboard.id, insight);
    results.push({ id: result.id, name: result.name });
  }

  console.log(
    JSON.stringify(
      {
        status: "ok",
        dashboard: { id: dashboard.id, name: dashboard.name },
        insights: results,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
