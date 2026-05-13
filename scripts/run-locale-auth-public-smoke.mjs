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

  try {
    await page.locator("h1").first().waitFor({
      state: "attached",
      timeout: 15_000,
    });
  } catch {
    const html = await page.content();
    assert.fail(
      `${path} rendered without an h1: ${body.slice(0, 500).replace(/\s+/g, " ")} | htmlHasH1=${html.includes("<h1")}`,
    );
  }

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

async function assertCallbackRedirect(page, urlPath, {
  mustInclude = [],
  pathnamePattern = /\/auth\/login$/,
}) {
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
  await page.waitForURL((current) => {
    const pathnameMatches = pathnamePattern.test(current.pathname);
    const includesExpected = mustInclude.every((fragment) =>
      `${current.pathname}${current.search}${current.hash}`.includes(fragment),
    );
    return pathnameMatches && includesExpected;
  }, { timeout: 15_000 });

  const currentUrl = page.url();
  const finalUrl = new URL(currentUrl);
  assert(pathnamePattern.test(finalUrl.pathname), `${urlPath} redirected to unexpected path: ${currentUrl}`);
  for (const fragment of mustInclude) {
    assert(
      `${finalUrl.pathname}${finalUrl.search}${finalUrl.hash}`.includes(fragment),
      `${urlPath} did not include ${fragment}; got ${currentUrl}`,
    );
  }

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
  const callbackContext = await browser.newContext();
  await callbackContext.addCookies([
    {
      name: "NEXT_LOCALE",
      value: "en",
      domain: new URL(baseUrl).hostname,
      path: "/",
    },
  ]);
  const callbackPage = await callbackContext.newPage();
  callbackChecks.push(
    await assertCallbackRedirect(callbackPage, "/auth/callback", {
      mustInclude: ["/auth/login", "redirectTo=%2Fen%2Fdashboard"],
    }),
  );
  callbackChecks.push(
    await assertCallbackRedirect(callbackPage, "/auth/callback?code=definitely-invalid", {
      mustInclude: ["/auth/login", "error=auth_failed"],
    }),
  );
  await callbackContext.close();

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
