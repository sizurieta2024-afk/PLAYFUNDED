#!/usr/bin/env node

const files = process.argv.slice(2).filter(Boolean);

const LOW_RISK_PATTERNS = [
  /^messages\//,
  /^public\//,
  /^docs\//,
  /^scripts\/.*\.(mjs|js|ts)$/,
  /^tests?\//,
  /^src\/components\/ui\//,
  /^src\/components\/landing\//,
  /^src\/components\/layout\//,
  /^src\/app\/\[locale]\/\(main\)\/(page|faq\/page|contact\/page|how-it-works\/page|legal\/page|leaderboard\/page)\.tsx$/,
];

const SENSITIVE_PATTERNS = [
  /^\.github\//,
  /^prisma\//,
  /^package(-lock)?\.json$/,
  /^next\.config\./,
  /^middleware\./,
  /^sentry(\.|-)/,
  /^src\/instrumentation/,
  /^src\/app\/actions\//,
  /^src\/app\/api\//,
  /^src\/app\/auth\//,
  /^src\/lib\//,
  /^src\/app\/\[locale]\/\(main\)\/dashboard\//,
];

function classifyPath(file) {
  if (SENSITIVE_PATTERNS.some((pattern) => pattern.test(file))) {
    return "sensitive";
  }
  if (LOW_RISK_PATTERNS.some((pattern) => pattern.test(file))) {
    return "low_risk";
  }
  return "review";
}

const classifications = files.map((file) => ({
  file,
  risk: classifyPath(file),
}));

const sensitive = classifications.filter((item) => item.risk === "sensitive");
const review = classifications.filter((item) => item.risk === "review");
const lowRisk = sensitive.length === 0 && review.length === 0 && files.length > 0;

const result = {
  lowRisk,
  riskLevel: lowRisk ? "low_risk" : sensitive.length > 0 ? "sensitive" : "review",
  files,
  sensitiveFiles: sensitive.map((item) => item.file),
  reviewFiles: review.map((item) => item.file),
  reason: lowRisk
    ? "Only low-risk UI/copy/test/docs files changed."
    : sensitive.length > 0
      ? `Sensitive files changed: ${sensitive.map((item) => item.file).join(", ")}`
      : `Files outside the low-risk allowlist changed: ${review
          .map((item) => item.file)
          .join(", ")}`,
};

process.stdout.write(`${JSON.stringify(result)}\n`);
