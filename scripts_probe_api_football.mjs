import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto('https://www.api-football.com', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(2500);
const links = await page.evaluate(() =>
  Array.from(document.querySelectorAll('a'))
    .map((a) => ({ text: (a.textContent || '').trim(), href: a.href }))
    .filter((x) => /(sign|login|dashboard)/i.test(`${x.text} ${x.href}`))
);
console.log(JSON.stringify({ url: page.url(), links }, null, 2));
await page.screenshot({ path: '/tmp/api-football-home.png', fullPage: true });
await browser.close();
