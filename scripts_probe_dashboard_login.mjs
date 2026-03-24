import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto('https://dashboard.api-football.com/login', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
await page.waitForTimeout(5000);
const info = await page.evaluate(() => ({
  url: location.href,
  title: document.title,
  hasEmail: !!document.querySelector('input[type="email"],input[name*="email" i],input[id*="email" i]'),
  hasPassword: !!document.querySelector('input[type="password"],input[name*="pass" i],input[id*="pass" i]'),
  text: (document.body?.innerText || '').slice(0, 500),
}));
console.log(JSON.stringify(info, null, 2));
await page.screenshot({ path: '/tmp/api-football-dashboard-login.png', fullPage: true }).catch(()=>{});
await browser.close();
