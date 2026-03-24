import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import {
  GENERATED_DIR,
  QUEUES_DIR,
  appendLog,
  ensureDirs,
  loadEnvLocal,
  loadJson,
  nowStamp,
  parseArgs,
  relToRoot,
  saveJson,
} from "./lib/common.mjs";

const QUEUE_PATH = path.join(QUEUES_DIR, "slides_queue.json");
const WIDTH = 1080;
const HEIGHT = 1920;

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function ensureQueueShape(queue) {
  if (!Array.isArray(queue)) {
    throw new Error("slides_queue.json must be an array");
  }
}

function makeCaption(item) {
  const hashtags = Array.isArray(item.hashtags) ? item.hashtags.join(" ") : "";
  const cta = item.linkInBioCta ?? "Link en bio para aplicar a PlayFunded.";
  return [item.caption, hashtags, cta].filter(Boolean).join("\n");
}

async function generateBackgroundWithOpenAI(prompt) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.SOCIAL_IMAGE_MODEL || "gpt-image-1",
      prompt,
      size: "1024x1024",
      response_format: "b64_json",
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI image generation failed: ${res.status} ${body}`);
  }

  const data = await res.json();
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) return null;
  return `data:image/png;base64,${b64}`;
}

function slideHtml({
  topic,
  slideText,
  index,
  total,
  backgroundDataUrl,
}) {
  const bgStyle = backgroundDataUrl
    ? `background-image: linear-gradient(180deg, rgba(6,10,18,.55), rgba(6,10,18,.82)), url('${backgroundDataUrl}');`
    : "background: radial-gradient(circle at 15% 20%, #1f3b66 0%, #0b1020 42%, #06080f 100%);";

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      width: ${WIDTH}px;
      height: ${HEIGHT}px;
      overflow: hidden;
      font-family: "Inter", "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: #f8fafc;
    }
    .slide {
      width: 100%;
      height: 100%;
      ${bgStyle}
      background-size: cover;
      background-position: center;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 92px 84px 88px;
      position: relative;
    }
    .top {
      font-size: 34px;
      font-weight: 700;
      letter-spacing: 0.01em;
      color: #93c5fd;
      opacity: 0.95;
      text-transform: uppercase;
    }
    .content {
      margin-top: 90px;
      font-size: 86px;
      line-height: 1.05;
      font-weight: 900;
      letter-spacing: -0.02em;
      text-wrap: balance;
      text-shadow: 0 18px 40px rgba(0,0,0,0.35);
    }
    .topic {
      margin-top: 36px;
      font-size: 34px;
      line-height: 1.3;
      color: #cbd5e1;
      font-weight: 500;
    }
    .footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 29px;
      color: #e2e8f0;
      opacity: 0.9;
      letter-spacing: 0.01em;
      font-weight: 700;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 10px 20px;
      border-radius: 999px;
      border: 1px solid rgba(148, 163, 184, 0.45);
      background: rgba(15, 23, 42, 0.55);
      backdrop-filter: blur(6px);
    }
  </style>
</head>
<body>
  <main class="slide">
    <section>
      <p class="top">PlayFunded Insights</p>
      <h1 class="content">${escapeHtml(slideText)}</h1>
      <p class="topic">${escapeHtml(topic)}</p>
    </section>
    <footer class="footer">
      <span class="badge">Slide ${index + 1}/${total}</span>
      <span>@playfunded</span>
    </footer>
  </main>
</body>
</html>`;
}

async function renderSlides({ page, item, outDir, useAiBackgrounds }) {
  const files = [];
  const total = item.slides.length;
  for (let i = 0; i < total; i += 1) {
    const slideText = String(item.slides[i] ?? "").trim();
    if (!slideText) continue;

    let backgroundDataUrl = null;
    if (useAiBackgrounds) {
      try {
        backgroundDataUrl = await generateBackgroundWithOpenAI(
          `Vertical social media background for sports betting education content. Cinematic, clean, premium, no text. Topic: ${item.topic}. Slide message: ${slideText}.`,
        );
      } catch (err) {
        console.warn(
          `[build_slides] OpenAI background failed for ${item.id} slide ${i + 1}:`,
          err instanceof Error ? err.message : String(err),
        );
      }
    }

    const html = slideHtml({
      topic: item.topic,
      slideText,
      index: i,
      total,
      backgroundDataUrl,
    });

    await page.setContent(html, { waitUntil: "load" });
    const filename = `${String(i + 1).padStart(2, "0")}.png`;
    const absPath = path.join(outDir, filename);
    await page.screenshot({ path: absPath, type: "png" });
    files.push(relToRoot(absPath));
  }
  return files;
}

function validateItem(item) {
  if (!item?.id || !Array.isArray(item?.slides) || item.slides.length === 0) {
    return false;
  }
  return true;
}

async function main() {
  await loadEnvLocal();
  await ensureDirs();

  const args = parseArgs(process.argv.slice(2));
  const limit = Number(args.limit ?? 5);
  const useAiBackgrounds = args["ai-backgrounds"] === "true";

  let queue;
  try {
    queue = await loadJson(QUEUE_PATH);
  } catch {
    throw new Error(
      `Queue file not found: ${relToRoot(QUEUE_PATH)}. Create it first.`,
    );
  }

  ensureQueueShape(queue);

  const candidates = queue.filter(
    (item) =>
      validateItem(item) &&
      (item.status === "ready" || item.status === "draft") &&
      item.account === "slides",
  );

  if (candidates.length === 0) {
    console.log("No slideshow queue items with status ready/draft.");
    return;
  }

  const toProcess = candidates.slice(0, Math.max(1, limit));
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: WIDTH, height: HEIGHT } });
  const page = await context.newPage();

  try {
    for (const item of toProcess) {
      const outDir = path.join(
        GENERATED_DIR,
        "slides",
        `${item.id}-${nowStamp()}`,
      );
      await fs.mkdir(outDir, { recursive: true });

      console.log(`[build_slides] Rendering ${item.id} (${item.slides.length} slides)`);
      const files = await renderSlides({
        page,
        item,
        outDir,
        useAiBackgrounds,
      });

      item.status = "rendered";
      item.renderedAt = new Date().toISOString();
      item.renderedDir = relToRoot(outDir);
      item.files = files;
      item.captionFinal = makeCaption(item);
      item.uploadStatus = "pending";
      await appendLog(`rendered ${item.id} -> ${item.renderedDir}`);
    }
  } finally {
    await context.close();
    await browser.close();
  }

  await saveJson(QUEUE_PATH, queue);
  console.log(
    `[build_slides] Done. Rendered ${toProcess.length} queue item(s). Queue updated: ${relToRoot(QUEUE_PATH)}`,
  );
}

main().catch((err) => {
  console.error("[build_slides] Fatal:", err);
  process.exitCode = 1;
});
