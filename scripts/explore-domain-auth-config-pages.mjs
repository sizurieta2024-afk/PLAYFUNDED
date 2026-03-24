import { chromium } from 'playwright'

const DEBUG_URL = process.env.CDP_DEBUG_URL || 'http://127.0.0.1:63766'

async function summarize(page, label) {
  await page.waitForLoadState('domcontentloaded', { timeout: 30000 }).catch(() => {})
  const data = await page.evaluate(() => {
    const text = (value) => (value || '').replace(/\s+/g, ' ').trim()
    return {
      title: document.title,
      url: window.location.href,
      headings: Array.from(document.querySelectorAll('h1, h2, h3'))
        .map((element) => text(element.textContent))
        .filter(Boolean)
        .slice(0, 20),
      buttons: Array.from(document.querySelectorAll('button, [role="button"]'))
        .map((element) => text(element.textContent || element.getAttribute('aria-label')))
        .filter(Boolean)
        .slice(0, 30),
      labels: Array.from(document.querySelectorAll('label'))
        .map((element) => text(element.textContent))
        .filter(Boolean)
        .slice(0, 30),
      inputs: Array.from(document.querySelectorAll('input, textarea'))
        .map((element) => ({
          name: element.getAttribute('name') || '',
          id: element.getAttribute('id') || '',
          placeholder: element.getAttribute('placeholder') || '',
          value: element.getAttribute('value') || '',
          type: element.getAttribute('type') || '',
        }))
        .slice(0, 30),
      bodyTextSample: text(document.body?.innerText).slice(0, 2500),
    }
  })
  console.log(`\n=== ${label} ===\n${JSON.stringify(data, null, 2)}`)
}

async function main() {
  const browser = await chromium.connectOverCDP(DEBUG_URL)
  const context = browser.contexts()[0]
  const pages = context.pages()

  const godaddy = pages.find((page) => page.url().includes('dashboard.godaddy.com'))
  const supabase = pages.find((page) => page.url().includes('supabase.com/dashboard/project/pvwynjnifdmaisswtwiz'))

  if (!godaddy || !supabase) {
    throw new Error('Could not find the expected authenticated GoDaddy and Supabase pages.')
  }

  await godaddy.goto('https://dcc.godaddy.com/control/portfolio/playfunded.lat/settings/dns', { waitUntil: 'domcontentloaded' })
  await summarize(godaddy, 'GoDaddy DNS')

  await supabase.goto('https://supabase.com/dashboard/project/pvwynjnifdmaisswtwiz/auth/url-configuration', { waitUntil: 'domcontentloaded' })
  await summarize(supabase, 'Supabase Auth URL Configuration')

  await browser.close()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
