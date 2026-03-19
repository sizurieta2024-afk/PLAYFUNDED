import { chromium } from "playwright";

const baseUrl = process.env.BASE_URL ?? "https://playfunded.lat";
const emails = [
  `live.signup.smoke.${Date.now()}@example.com`,
  `live-signup-smoke+${Date.now()}@example.com`,
];

const browser = await chromium.launch({ headless: true, channel: "chrome" });

try {
  const results = [];
  for (const email of emails) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`${baseUrl}/en/auth/signup`, { waitUntil: "domcontentloaded" });
    await page.locator('input[name="name"]').fill("Signup Probe");
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill("PlayfundedSignup!123");
    await page.locator('form button[type="submit"]').click();
    await page.waitForTimeout(3000);
    results.push({
      email,
      finalUrl: page.url(),
      body: (await page.locator("body").innerText()).replace(/\s+/g, " ").trim().slice(0, 1200),
    });
    await context.close();
  }

  console.log(JSON.stringify({ ok: true, baseUrl, results }, null, 2));
} finally {
  await browser.close();
}
