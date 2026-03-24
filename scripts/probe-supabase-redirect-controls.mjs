import { chromium } from 'playwright'

const DEBUG_URL = process.env.CDP_DEBUG_URL || 'http://127.0.0.1:63766'

async function main() {
  const browser = await chromium.connectOverCDP(DEBUG_URL)
  const context = browser.contexts()[0]
  const page = context.pages().find((current) => current.url().includes('supabase.com/dashboard/project/pvwynjnifdmaisswtwiz'))
  if (!page) {
    throw new Error('Supabase page not found')
  }

  await page.goto('https://supabase.com/dashboard/project/pvwynjnifdmaisswtwiz/auth/url-configuration', {
    waitUntil: 'networkidle',
  })
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.waitForTimeout(2000)

  await page.getByRole('button', { name: 'Add URL' }).click()
  await page.waitForTimeout(1500)

  const summary = await page.evaluate(() => {
    const text = (value) => (value || '').replace(/\s+/g, ' ').trim()
    return {
      body: text(document.body?.innerText).slice(0, 5000),
      inputs: Array.from(document.querySelectorAll('input, textarea'))
        .map((element) => ({
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

  console.log(JSON.stringify(summary, null, 2))
  await browser.close()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
