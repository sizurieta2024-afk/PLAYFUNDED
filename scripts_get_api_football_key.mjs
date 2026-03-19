import { chromium } from 'playwright';

const email = process.env.APIF_EMAIL;
const password = process.env.APIF_PASSWORD;
if (!email || !password) {
  console.error('Missing APIF_EMAIL/APIF_PASSWORD');
  process.exit(1);
}

const loginUrls = [
  'https://www.api-football.com/login',
  'https://dashboard.api-football.com',
  'https://dashboard.api-football.com/login/expirate',
];

const candidatePages = [
  'https://dashboard.api-football.com',
  'https://dashboard.api-football.com/account',
  'https://dashboard.api-football.com/subscription',
  'https://dashboard.api-football.com/profile',
  'https://dashboard.api-football.com/api',
  'https://www.api-football.com/account',
  'https://www.api-football.com/profile',
  'https://www.api-football.com/dashboard',
];

function findCandidates(text) {
  const raw = text.match(/[A-Za-z0-9_\-]{24,80}/g) || [];
  const filtered = raw.filter((s) => {
    if (s.length < 24) return false;
    if (/^(https?|dashboard|api|football|login|logout|subscription|account)$/i.test(s)) return false;
    const hasLetter = /[A-Za-z]/.test(s);
    const hasDigit = /\d/.test(s);
    return hasLetter && hasDigit;
  });
  return [...new Set(filtered)];
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

let loggedIn = false;
for (const url of loginUrls) {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2500);

    const emailInput = page.locator('input[type="email"], input[name*="email" i], input[id*="email" i]').first();
    const pwdInput = page.locator('input[type="password"], input[name*="pass" i], input[id*="pass" i]').first();

    if (await emailInput.count() && await pwdInput.count()) {
      await emailInput.fill(email);
      await pwdInput.fill(password);

      const submit = page
        .locator('button:has-text("Login"), button:has-text("Sign in"), button:has-text("Connexion"), button[type="submit"], input[type="submit"]')
        .first();

      if (await submit.count()) {
        await Promise.allSettled([
          page.waitForLoadState('networkidle', { timeout: 30000 }),
          submit.click({ timeout: 10000 }),
        ]);
      } else {
        await page.keyboard.press('Enter');
        await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
      }

      await page.waitForTimeout(3000);
      const body = await page.content();
      if (!/login|sign in|connexion/i.test(body)) {
        loggedIn = true;
        break;
      }
    }
  } catch {
    // continue
  }
}

const allCandidates = new Set();
for (const url of candidatePages) {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(1500);

    const bodyText = await page.evaluate(() => document.body?.innerText || '');
    findCandidates(bodyText).forEach((c) => allCandidates.add(c));

    const inputVals = await page.evaluate(() =>
      Array.from(document.querySelectorAll('input, textarea'))
        .map((el) => el.value || el.getAttribute('value') || '')
        .filter(Boolean)
    );
    inputVals.forEach((v) => findCandidates(v).forEach((c) => allCandidates.add(c)));
  } catch {}
}

await page.screenshot({ path: '/tmp/api-football-last.png', fullPage: true }).catch(() => {});

console.log(JSON.stringify({
  loggedIn,
  currentUrl: page.url(),
  candidates: [...allCandidates],
}, null, 2));

await browser.close();
