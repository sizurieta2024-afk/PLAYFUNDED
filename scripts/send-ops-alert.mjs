const webhookUrl = process.env.PF_ALERT_WEBHOOK_URL;
if (!webhookUrl) {
  console.error("PF_ALERT_WEBHOOK_URL is required");
  process.exit(1);
}

const kind = process.env.PF_ALERT_WEBHOOK_KIND === "discord" ? "discord" : "slack";
const baseUrl = process.env.PF_BASE_URL ?? "unknown";
const runUrl =
  process.env.GITHUB_SERVER_URL &&
  process.env.GITHUB_REPOSITORY &&
  process.env.GITHUB_RUN_ID
    ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
    : null;

const summary = process.env.OPS_HEALTH_BODY ?? "no response body captured";
const text = [
  "PlayFunded ops health check failed.",
  `Base URL: ${baseUrl}`,
  runUrl ? `Workflow run: ${runUrl}` : null,
  `Summary: ${summary}`,
]
  .filter(Boolean)
  .join("\n");

const payload = kind === "discord" ? { content: text } : { text };

const response = await fetch(webhookUrl, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload),
});

if (!response.ok) {
  console.error(`Alert webhook failed with HTTP ${response.status}`);
  console.error(await response.text());
  process.exit(1);
}
