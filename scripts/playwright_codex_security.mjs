#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";

function parseArgs(argv) {
  const args = {
    url: "https://chatgpt.com/",
    outputDir: "automation/playwright-codex-security",
    profileRoot:
      process.env.CHROME_USER_DATA_DIR ??
      path.join(
        process.env.HOME,
        "Library/Application Support/Google/Chrome",
      ),
    profileDirectory: process.env.CHROME_PROFILE_DIRECTORY ?? "Default",
    headless: process.env.PLAYWRIGHT_HEADLESS === "1",
    timeoutMs: 45_000,
    selectors: [],
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--url") args.url = argv[++i];
    else if (arg === "--output-dir") args.outputDir = argv[++i];
    else if (arg === "--profile-root") args.profileRoot = argv[++i];
    else if (arg === "--profile-directory") args.profileDirectory = argv[++i];
    else if (arg === "--headless") args.headless = true;
    else if (arg === "--timeout-ms") args.timeoutMs = Number(argv[++i]);
    else if (arg === "--selector") args.selectors.push(argv[++i]);
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return args;
}

async function main() {
  const args = parseArgs(process.argv);
  fs.mkdirSync(args.outputDir, { recursive: true });

  const profilePath = args.profileRoot;
  const context = await chromium.launchPersistentContext(profilePath, {
    channel: "chrome",
    headless: args.headless,
    args: [`--profile-directory=${args.profileDirectory}`],
    viewport: { width: 1440, height: 960 },
  });

  try {
    const page = context.pages()[0] ?? (await context.newPage());
    await page.goto(args.url, {
      waitUntil: "domcontentloaded",
      timeout: args.timeoutMs,
    });

    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {
      // Some pages keep long-lived connections open; the screenshot is still useful.
    });

    const title = await page.title();
    const currentUrl = page.url();
    const screenshotPath = path.join(args.outputDir, "page.png");
    const htmlPath = path.join(args.outputDir, "page.html");
    const selectorStates = {};

    for (const selector of args.selectors) {
      const locator = page.locator(selector).first();
      selectorStates[selector] = await locator
        .isVisible({ timeout: 5_000 })
        .catch(() => false);
    }

    await page.screenshot({ path: screenshotPath, fullPage: true });
    fs.writeFileSync(htmlPath, await page.content(), "utf8");

    console.log(
      JSON.stringify({
        currentUrl,
        title,
        screenshotPath,
        htmlPath,
        selectorStates,
      }),
    );
  } finally {
    await context.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
