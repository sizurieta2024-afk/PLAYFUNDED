const baseUrl = process.env.PF_BASE_URL;
const cronSecret = process.env.PF_CRON_SECRET;

if (!baseUrl || !cronSecret) {
  console.error("PF_BASE_URL and PF_CRON_SECRET are required");
  process.exit(1);
}

const url = `${baseUrl.replace(/\/$/, "")}/api/ops/health`;
const response = await fetch(url, {
  headers: {
    Authorization: `Bearer ${cronSecret}`,
    "Content-Type": "application/json",
  },
});

const body = await response.text();
console.log(`HTTP ${response.status}`);
console.log(body);

if (!response.ok) {
  process.exit(1);
}

try {
  const parsed = JSON.parse(body);
  if (!parsed.ok) {
    process.exit(1);
  }
} catch {
  process.exit(1);
}
