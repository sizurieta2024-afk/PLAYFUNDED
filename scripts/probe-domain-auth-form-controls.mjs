import { chromium } from 'playwright'

const DEBUG_URL = process.env.CDP_DEBUG_URL || 'http://127.0.0.1:63766'

async function probeSupabase(page) {
  await page.goto('https://supabase.com/dashboard/project/pvwynjnifdmaisswtwiz/auth/url-configuration', {
    waitUntil: 'networkidle',
  })
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.waitForTimeout(3000)

  const summary = await page.evaluate(() => {
    const text = (value) => (value || '').replace(/\s+/g, ' ').trim()
    return {
      title: document.title,
      url: window.location.href,
      body: text(document.body?.innerText).slice(0, 5000),
      inputs: Array.from(document.querySelectorAll('input, textarea'))
        .map((element) => ({
          tag: element.tagName,
          type: element.getAttribute('type') || '',
          name: element.getAttribute('name') || '',
          id: element.getAttribute('id') || '',
          placeholder: element.getAttribute('placeholder') || '',
          value: element.value || element.getAttribute('value') || '',
          ariaLabel: element.getAttribute('aria-label') || '',
        })),
      buttons: Array.from(document.querySelectorAll('button'))
        .map((element) => text(element.textContent || element.getAttribute('aria-label')))
        .filter(Boolean),
    }
  })
  console.log(`SUPABASE\n${JSON.stringify(summary, null, 2)}`)
}

async function probeGoDaddy(page) {
  await page.goto('https://dcc.godaddy.com/control/dnsmanagement?domainName=playfunded.lat', {
    waitUntil: 'networkidle',
  })
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.waitForTimeout(5000)

  const summary = await page.evaluate(() => {
    const text = (value) => (value || '').replace(/\s+/g, ' ').trim()
    return {
      title: document.title,
      url: window.location.href,
      body: text(document.body?.innerText).slice(0, 7000),
      inputs: Array.from(document.querySelectorAll('input, textarea, select'))
        .map((element) => ({
          tag: element.tagName,
          type: element.getAttribute('type') || '',
          name: element.getAttribute('name') || '',
          id: element.getAttribute('id') || '',
          placeholder: element.getAttribute('placeholder') || '',
          value: element.value || element.getAttribute('value') || '',
          ariaLabel: element.getAttribute('aria-label') || '',
        })),
      buttons: Array.from(document.querySelectorAll('button'))
        .map((element) => text(element.textContent || element.getAttribute('aria-label')))
        .filter(Boolean),
    }
  })
  console.log(`GODADDY\n${JSON.stringify(summary, null, 2)}`)
}

async function main() {
  const browser = await chromium.connectOverCDP(DEBUG_URL)
  const context = browser.contexts()[0]
  const pages = context.pages()
  const godaddy = pages.find((page) => page.url().includes('godaddy.com'))
  const supabase = pages.find((page) => page.url().includes('supabase.com/dashboard/project/pvwynjnifdmaisswtwiz'))
  if (!godaddy || !supabase) {
    throw new Error('Missing expected pages')
  }

  await probeSupabase(supabase)
  await probeGoDaddy(godaddy)
  await browser.close()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
