import { firefox } from 'playwright';

const email = process.env.APIF_EMAIL;
const password = process.env.APIF_PASSWORD;
if (!email || !password) {
  console.error('Missing APIF_EMAIL/APIF_PASSWORD');
  process.exit(1);
}

function findCandidates(text) {
  const raw = text.match(/[A-Za-z0-9_\-]{24,80}/g) || [];
  return [...new Set(raw.filter((s) => /[A-Za-z]/.test(s) && /\d/.test(s)))];
}

const browser = await firefox.launch({ headless: true });
const context = await browser.newContext({
  userAgent:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:126.0) Gecko/20100101 Firefox/126.0',
  locale: 'en-US',
});
const page = await context.newPage();

await page.goto('https://www.api-football.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(2000);

const signIn = page.locator('a:has-text("Sign in"), a:has-text("SIGN IN")').first();
if (await signIn.count()) {
  await Promise.allSettled([
    page.waitForLoadState('domcontentloaded', { timeout: 30000 }),
    signIn.click(),
  ]);
}

await page.waitForTimeout(5000);

// Try direct login route too
if (!page.url().includes('dashboard.api-football.com')) {
  await page.goto('https://dashboard.api-football.com/login', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(5000);
}

const hasEmail = await page.locator('input[type="email"],input[name*="email" i],input[id*="email" i]').count();
const hasPass = await page.locator('input[type="password"],input[name*="pass" i],input[id*="pass" i]').count();

let loggedIn = false;
if (hasEmail && hasPass) {
  await page.locator('input[type="email"],input[name*="email" i],input[id*="email" i]').first().fill(email);
  await page.locator('input[type="password"],input[name*="pass" i],input[id*="pass" i]').first().fill(password);

  const submit = page.locator('button:has-text("Login"), button:has-text("Sign in"), button[type="submit"], input[type="submit"]').first();
  if (await submit.count()) {
    await Promise.allSettled([
      page.waitForLoadState('networkidle', { timeout: 30000 }),
      submit.click({ timeout: 10000 }),
    ]);
  } else {
    await page.keyboard.press('Enter');
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  }
  await page.waitForTimeout(4000);
  loggedIn = !/Performing security verification|sign in|login/i.test(await page.content());
}

const pages = [
  'https://dashboard.api-football.com/',
  'https://dashboard.api-football.com/profile?access',
  'https://dashboard.api-football.com/profile',
  'https://dashboard.api-football.com/account',
  'https://dashboard.api-football.com/subscription',
];

const candidates = new Set();
for (const url of pages) {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2000);
    const text = await page.evaluate(() => document.body?.innerText || '');
    findCandidates(text).forEach((c) => candidates.add(c));
    const vals = await page.evaluate(() =>
      Array.from(document.querySelectorAll('input,textarea'))
        .map((e) => e.value || e.getAttribute('value') || '')
        .filter(Boolean)
    );
    vals.forEach((v) => findCandidates(v).forEach((c) => candidates.add(c)));
  } catch {}
}

await page.screenshot({ path: '/tmp/api-football-firefox-last.png', fullPage: true }).catch(() => {});

console.log(JSON.stringify({
  url: page.url(),
  loggedIn,
  hasEmail: !!hasEmail,
  hasPass: !!hasPass,
  candidates: [...candidates],
}, null, 2));

await browser.close();
