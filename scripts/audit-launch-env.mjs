import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();

function parseEnvFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  return new Set(
    content
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => line.split("=")[0].trim()),
  );
}

function parseWorkflowSecrets(dirPath) {
  const secretNames = new Set();
  for (const name of fs.readdirSync(dirPath)) {
    if (!name.endsWith(".yml")) continue;
    const content = fs.readFileSync(path.join(dirPath, name), "utf8");
    const matches = content.matchAll(/secrets\.([A-Z0-9_]+)/g);
    for (const match of matches) {
      secretNames.add(match[1]);
    }
  }
  return secretNames;
}

function runText(command, args) {
  return execFileSync(command, args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function runTextReport(command, args) {
  try {
    return { ok: true, output: runText(command, args) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const stderr =
      error && typeof error === "object" && "stderr" in error
        ? String(error.stderr)
        : "";
    return {
      ok: false,
      output: "",
      error: stderr.trim() || message,
    };
  }
}

function parseGithubSecrets(raw) {
  return new Set(
    raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => line.split(/\s+/)[0]),
  );
}

function parseVercelEnv(raw) {
  return new Set(
    raw
      .split("\n")
      .map((line) => line.trim())
      .filter(
        (line) =>
          line &&
          !line.startsWith("Retrieving project") &&
          !line.startsWith(">") &&
          !line.startsWith("name ") &&
          !line.startsWith("Common next commands") &&
          !line.startsWith("- `") &&
          /^[A-Z0-9_]+\s+Encrypted/.test(line),
      )
      .map((line) => line.split(/\s+/)[0]),
  );
}

function diff(required, actual) {
  return [...required].filter((key) => !actual.has(key)).sort();
}

const localEnv = parseEnvFile(path.join(root, ".env.local"));
const exampleEnv = parseEnvFile(path.join(root, ".env.example"));
const pulledVercelEnvPath = path.join(root, ".vercel", ".env.production.local");
const pulledVercelEnv = fs.existsSync(pulledVercelEnvPath)
  ? parseEnvFile(pulledVercelEnvPath)
  : new Set();
const workflowSecrets = parseWorkflowSecrets(path.join(root, ".github", "workflows"));
const githubSecretResult = runTextReport("gh", ["secret", "list"]);
const vercelEnvResult = runTextReport("npx", ["vercel", "env", "ls"]);
const githubSecrets = githubSecretResult.ok
  ? parseGithubSecrets(githubSecretResult.output)
  : new Set();
const vercelEnv = vercelEnvResult.ok
  ? parseVercelEnv(vercelEnvResult.output)
  : pulledVercelEnv;
const vercelEnvSource = vercelEnvResult.ok
  ? "vercel-cli"
  : pulledVercelEnv.size > 0
    ? ".vercel/.env.production.local"
    : "unavailable";

const runtimeRequired = [
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
  "SMTP_USER",
  "SMTP_APP_PASSWORD",
  "SMTP_FROM",
  "NEXT_PUBLIC_APP_URL",
  "SUPPORT_EMAIL",
];

workflowSecrets.delete("GITHUB_TOKEN");
for (const key of ["PF_ALERT_WEBHOOK_URL", "PF_ALERT_WEBHOOK_KIND"]) {
  workflowSecrets.delete(key);
}

const workflowRequired = [...workflowSecrets].sort();
const recommendedRuntime = [
  "NEXT_PUBLIC_POSTHOG_TOKEN",
  "NEXT_PUBLIC_POSTHOG_HOST",
  "KYC_SCAN_MODE",
  "CLAMAV_HOST",
  "CLAMAV_PORT",
  "CLAMAV_TIMEOUT_MS",
  "KYC_QUARANTINE_BUCKET",
];
const recommendedGithub = ["PF_ALERT_WEBHOOK_URL", "PF_ALERT_WEBHOOK_KIND"];

const report = {
  generatedAt: new Date().toISOString(),
  workflowSecrets: workflowRequired,
  runtimeRequired,
  recommendedRuntime,
  recommendedGithub,
  connectorErrors: {
    github: githubSecretResult.ok ? null : githubSecretResult.error,
    vercel: vercelEnvResult.ok ? null : vercelEnvResult.error,
  },
  sources: {
    github: githubSecretResult.ok ? "gh-secret-list" : "unavailable",
    vercel: vercelEnvSource,
  },
  local: {
    missingFromExample: diff(localEnv, exampleEnv),
    missingRequired: diff(new Set(runtimeRequired), localEnv),
    missingRecommended: diff(new Set(recommendedRuntime), localEnv),
  },
  github: {
    missingRequired: githubSecretResult.ok
      ? diff(new Set(workflowRequired), githubSecrets)
      : null,
    missingRecommended: githubSecretResult.ok
      ? diff(new Set(recommendedGithub), githubSecrets)
      : null,
  },
  vercel: {
    missingRequired: vercelEnvSource !== "unavailable"
      ? diff(new Set(runtimeRequired), vercelEnv)
      : null,
    missingRecommended: vercelEnvSource !== "unavailable"
      ? diff(new Set(recommendedRuntime), vercelEnv)
      : null,
  },
};

console.log(JSON.stringify(report, null, 2));
