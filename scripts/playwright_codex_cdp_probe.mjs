#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";

function parseArgs(argv) {
  const args = {
    endpoint: "http://127.0.0.1:9222",
    url: "https://chatgpt.com/",
    outputDir: "automation/playwright-codex-security/cdp-probe",
    selectors: [],
    timeoutMs: 45_000,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--endpoint") args.endpoint = argv[++i];
    else if (arg === "--url") args.url = argv[++i];
    else if (arg === "--output-dir") args.outputDir = argv[++i];
    else if (arg === "--selector") args.selectors.push(argv[++i]);
    else if (arg === "--timeout-ms") args.timeoutMs = Number(argv[++i]);
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

async function main() {
  const args = parseArgs(process.argv);
  fs.mkdirSync(args.outputDir, { recursive: true });

  const browser = await chromium.connectOverCDP(args.endpoint);
  try {
    const context = browser.contexts()[0];
    if (!context) throw new Error("No browser context available via CDP");

    const page = context.pages()[0] ?? (await context.newPage());
    await page.goto(args.url, {
      waitUntil: "domcontentloaded",
      timeout: args.timeoutMs,
    });

    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {
      // Ignore long-lived connections.
    });

    const selectorStates = {};
    for (const selector of args.selectors) {
      const locator = page.locator(selector).first();
      selectorStates[selector] = await locator
        .isVisible({ timeout: 5_000 })
        .catch(() => false);
    }

    const screenshotPath = path.join(args.outputDir, "page.png");
    const htmlPath = path.join(args.outputDir, "page.html");

    await page.screenshot({ path: screenshotPath, fullPage: true });
    fs.writeFileSync(htmlPath, await page.content(), "utf8");

    console.log(
      JSON.stringify({
        currentUrl: page.url(),
        title: await page.title(),
        screenshotPath,
        htmlPath,
        selectorStates,
      }),
    );
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
