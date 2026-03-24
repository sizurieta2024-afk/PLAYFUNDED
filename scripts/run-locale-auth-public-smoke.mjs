import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseUrl = process.env.BASE_URL ?? "http://localhost:3004";

const publicRoutes = [
  "/",
  "/challenges",
  "/legal",
  "/contact",
  "/auth/login",
  "/auth/signup",
  "/en",
  "/en/challenges",
  "/en/legal",
  "/en/contact",
  "/en/auth/login",
  "/en/auth/signup",
  "/pt-BR",
  "/pt-BR/challenges",
  "/pt-BR/legal",
  "/pt-BR/contact",
  "/pt-BR/auth/login",
  "/pt-BR/auth/signup",
];

const authPages = [
  "/auth/login",
  "/auth/signup",
  "/en/auth/login",
  "/en/auth/signup",
  "/pt-BR/auth/login",
  "/pt-BR/auth/signup",
];

function hasFatalText(text) {
  return /application error|internal server error|unhandled runtime error|page not found/i.test(
    text,
  );
}

async function assertHealthyPage(page, path) {
  const consoleErrors = [];
  const pageErrors = [];
  const onConsole = (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
    }
  };
  const onPageError = (error) => {
    pageErrors.push(error.stack || error.message);
  };

  page.on("console", onConsole);
  page.on("pageerror", onPageError);

  const response = await page.goto(`${baseUrl}${path}`, {
    waitUntil: "domcontentloaded",
  });
  assert(response, `No response for ${path}`);
  assert.equal(response.status(), 200, `${path} returned ${response.status()}`);

  const body = await page.locator("body").innerText();
  assert(
    !hasFatalText(body),
    `${path} rendered fatal text: ${body.slice(0, 500).replace(/\s+/g, " ")} | consoleErrors=${consoleErrors.join(" || ")} | pageErrors=${pageErrors.join(" || ")}`,
  );

  page.off("console", onConsole);
  page.off("pageerror", onPageError);

  const h1Count = await page.locator("h1").count();
  assert(h1Count > 0, `${path} rendered without an h1`);

  return {
    path,
    status: response.status(),
    finalUrl: page.url(),
  };
}

async function assertGoogleLink(page, path) {
  const consoleErrors = [];
  const pageErrors = [];
  const onConsole = (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
    }
  };
  const onPageError = (error) => {
    pageErrors.push(error.stack || error.message);
  };

  page.on("console", onConsole);
  page.on("pageerror", onPageError);

  await page.goto(`${baseUrl}${path}`, {
    waitUntil: "domcontentloaded",
  });

  const googleLink = page.locator('a[href="/api/auth/google"]').first();
  await googleLink.waitFor({ state: "visible", timeout: 15_000 });
  const href = await googleLink.getAttribute("href");
  assert.equal(href, "/api/auth/google", `${path} Google link was ${href}`);

  const body = await page.locator("body").innerText();
  assert(
    !hasFatalText(body),
    `${path} auth page rendered fatal text: ${body.slice(0, 500).replace(/\s+/g, " ")} | consoleErrors=${consoleErrors.join(" || ")} | pageErrors=${pageErrors.join(" || ")}`,
  );

  page.off("console", onConsole);
  page.off("pageerror", onPageError);

  return {
    path,
    href,
  };
}

async function assertCallbackError(page, urlPath, expectedQuery) {
  const consoleErrors = [];
  const pageErrors = [];
  const onConsole = (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
    }
  };
  const onPageError = (error) => {
    pageErrors.push(error.stack || error.message);
  };

  page.on("console", onConsole);
  page.on("pageerror", onPageError);

  await page.goto(`${baseUrl}${urlPath}`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForURL(new RegExp(expectedQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), {
    timeout: 15_000,
  });

  const currentUrl = page.url();
  assert(
    currentUrl.includes(expectedQuery),
    `${urlPath} did not redirect to ${expectedQuery}; got ${currentUrl}`,
  );

  const body = await page.locator("body").innerText();
  assert(
    !hasFatalText(body),
    `${urlPath} rendered fatal text after redirect: ${body.slice(0, 500).replace(/\s+/g, " ")} | consoleErrors=${consoleErrors.join(" || ")} | pageErrors=${pageErrors.join(" || ")}`,
  );

  page.off("console", onConsole);
  page.off("pageerror", onPageError);

  return {
    path: urlPath,
    finalUrl: currentUrl,
  };
}

const browser = await chromium.launch({ headless: true });

try {
  const context = await browser.newContext();
  const page = await context.newPage();

  const publicChecks = [];
  for (const path of publicRoutes) {
    publicChecks.push(await assertHealthyPage(page, path));
  }

  const googleChecks = [];
  for (const path of authPages) {
    googleChecks.push(await assertGoogleLink(page, path));
  }

  const callbackChecks = [];
  callbackChecks.push(
    await assertCallbackError(page, "/auth/callback", "/auth/login?error=missing_code"),
  );
  callbackChecks.push(
    await assertCallbackError(
      page,
      "/auth/callback?code=definitely-invalid",
      "/auth/login?error=auth_failed",
    ),
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        baseUrl,
        publicChecks,
        googleChecks,
        callbackChecks,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
