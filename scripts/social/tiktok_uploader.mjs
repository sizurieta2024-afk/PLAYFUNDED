import path from "node:path";
import { chromium } from "playwright";
import {
  QUEUES_DIR,
  STATE_DIR,
  appendLog,
  ensureDirs,
  loadEnvLocal,
  loadJson,
  parseArgs,
  prompt,
  relToRoot,
  resolveFromRoot,
  saveJson,
} from "./lib/common.mjs";

const QUEUE_PATH = path.join(QUEUES_DIR, "slides_queue.json");

function usage() {
  console.log(`Usage:
  npm run social:tiktok:auth -- --account slides
  npm run social:tiktok:upload -- --account slides [--id slides-20260306-001] [--auto-post true] [--headless false]
`);
}

function pickQueueItem(queue, account, id) {
  if (id) {
    return queue.find((item) => item.id === id && item.account === account);
  }
  return queue.find(
    (item) =>
      item.account === account &&
      item.status === "rendered" &&
      item.uploadStatus !== "posted" &&
      Array.isArray(item.files) &&
      item.files.length > 0,
  );
}

async function setCaption(page, captionText) {
  const selectors = [
    'div[contenteditable="true"]',
    '[data-e2e="caption-editor"] div[contenteditable="true"]',
    '[data-e2e="caption-container"] div[contenteditable="true"]',
  ];

  for (const selector of selectors) {
    const node = page.locator(selector).first();
    if ((await node.count()) === 0) continue;
    try {
      await node.click({ timeout: 1_500 });
      await page.keyboard.press("MetaOrControl+A");
      await page.keyboard.type(captionText, { delay: 15 });
      return true;
    } catch {
      // try next selector
    }
  }
  return false;
}

async function clickPost(page) {
  const candidates = [
    page.getByRole("button", { name: /post|publicar|publish|poste/i }).first(),
    page.locator("button:has-text('Post')").first(),
    page.locator("button:has-text('Publicar')").first(),
  ];

  for (const target of candidates) {
    if ((await target.count()) === 0) continue;
    try {
      await target.click({ timeout: 2_000 });
      return true;
    } catch {
      // try next candidate
    }
  }
  return false;
}

async function waitForUploadInput(page) {
  const input = page.locator('input[type="file"]').first();
  await input.waitFor({ timeout: 120_000 });
  return input;
}

async function runAuth({ account, headless }) {
  const userDataDir = path.join(STATE_DIR, `tiktok-${account}`);
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless,
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  await page.goto("https://www.tiktok.com/upload?lang=es", {
    waitUntil: "domcontentloaded",
  });

  console.log(
    `Complete TikTok login for account "${account}" in the opened browser.`,
  );
  await prompt("When login is complete and upload page is visible, press ENTER: ");
  await appendLog(`auth session refreshed for ${account}`);
  await context.close();
}

async function runUpload({ account, id, autoPost, headless }) {
  const queue = await loadJson(QUEUE_PATH);
  const item = pickQueueItem(queue, account, id);

  if (!item) {
    console.log("No rendered queue item found for upload.");
    return;
  }

  const files = item.files.map((file) => resolveFromRoot(file));
  const userDataDir = path.join(STATE_DIR, `tiktok-${account}`);

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless,
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  try {
    await page.goto("https://www.tiktok.com/upload?lang=es", {
      waitUntil: "domcontentloaded",
    });
    console.log(
      "If TikTok asks for login/verification, complete it in browser, then return here.",
    );
    await prompt("Press ENTER to continue to file upload: ");

    const uploadInput = await waitForUploadInput(page);
    await uploadInput.setInputFiles(files);
    console.log(`[tiktok_uploader] Uploaded ${files.length} media files for ${item.id}`);

    const caption = item.captionFinal || item.caption || "";
    const captionOk = await setCaption(page, caption);
    if (!captionOk) {
      console.warn(
        "[tiktok_uploader] Could not auto-fill caption. Please paste caption manually before posting.",
      );
    }

    if (autoPost) {
      const posted = await clickPost(page);
      if (!posted) {
        console.warn(
          "[tiktok_uploader] Auto-post click failed. Please click Post manually.",
        );
      }
      await prompt("After post is submitted, press ENTER to confirm: ");
      item.uploadStatus = "posted";
      item.postedAt = new Date().toISOString();
    } else {
      const answer = await prompt(
        "Review/upload in browser. Type 'posted' after you manually click Post and it succeeds: ",
      );
      if (answer.toLowerCase() === "posted") {
        item.uploadStatus = "posted";
        item.postedAt = new Date().toISOString();
      } else {
        item.uploadStatus = "pending_manual";
      }
    }

    await saveJson(QUEUE_PATH, queue);
    await appendLog(
      `upload ${item.id} account=${account} status=${item.uploadStatus}`,
    );
    console.log(
      `[tiktok_uploader] Queue updated (${item.id} -> ${item.uploadStatus}) at ${relToRoot(QUEUE_PATH)}`,
    );
  } finally {
    await context.close();
  }
}

async function main() {
  await loadEnvLocal();
  await ensureDirs();

  const args = parseArgs(process.argv.slice(2));
  const command = args._[0];
  const account = String(args.account ?? "slides");
  const id = args.id ? String(args.id) : null;
  const autoPost = String(args["auto-post"] ?? "false") === "true";
  const headless = String(args.headless ?? "false") === "true";

  if (!command || (command !== "auth" && command !== "upload")) {
    usage();
    process.exitCode = 1;
    return;
  }

  if (command === "auth") {
    await runAuth({ account, headless });
    return;
  }

  await runUpload({ account, id, autoPost, headless });
}

main().catch((err) => {
  console.error("[tiktok_uploader] Fatal:", err);
  process.exitCode = 1;
});
