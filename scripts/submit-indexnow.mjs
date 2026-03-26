#!/usr/bin/env node

const key = process.env.INDEXNOW_KEY?.trim();
const appUrl =
  process.env.APP_CANONICAL_URL ??
  process.env.NEXT_PUBLIC_APP_URL ??
  "https://playfunded.lat";

if (!key) {
  console.error("INDEXNOW_KEY is required.");
  process.exit(1);
}

const urls = process.argv.slice(2).filter(Boolean);

if (urls.length === 0) {
  console.error("Usage: node --env-file=.env.local scripts/submit-indexnow.mjs <url> [more-urls]");
  process.exit(1);
}

const origin = new URL(appUrl).origin;
const host = new URL(appUrl).host;
const keyLocation = `${origin}/indexnow.txt`;

for (const value of urls) {
  const parsed = new URL(value);
  if (parsed.origin !== origin) {
    console.error(`URL must match ${origin}: ${value}`);
    process.exit(1);
  }
}

const response = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: {
    "content-type": "application/json; charset=utf-8",
  },
  body: JSON.stringify({
    host,
    key,
    keyLocation,
    urlList: urls,
  }),
});

if (!response.ok) {
  const body = await response.text();
  console.error(`IndexNow submission failed (${response.status}): ${body}`);
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      host,
      submitted: urls.length,
      keyLocation,
    },
    null,
    2,
  ),
);
