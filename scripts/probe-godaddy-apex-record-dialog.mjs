import { chromium } from 'playwright'

const DEBUG_URL = process.env.CDP_DEBUG_URL || 'http://127.0.0.1:63766'

async function main() {
  const browser = await chromium.connectOverCDP(DEBUG_URL)
  const context = browser.contexts()[0]
  const page = context.pages().find((current) => current.url().includes('godaddy.com'))
  if (!page) {
    throw new Error('GoDaddy page not found')
  }

  await page.goto('https://dcc.godaddy.com/control/dnsmanagement?domainName=playfunded.lat', {
    waitUntil: 'networkidle',
  })
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.waitForTimeout(3000)

  const tableRows = page.locator('tr')
  const rowCount = await tableRows.count()
  let targetRowIndex = -1
  for (let index = 0; index < rowCount; index += 1) {
    const text = await tableRows.nth(index).innerText().catch(() => '')
    if (/websitebuilder site/i.test(text) && /@\s/i.test(text)) {
      targetRowIndex = index
      console.log(`TARGET_ROW ${index}: ${text.replace(/\s+/g, ' ').trim()}`)
      break
    }
  }

  if (targetRowIndex < 0) {
    throw new Error('Could not find apex WebsiteBuilder row')
  }

  const row = tableRows.nth(targetRowIndex)
  const editButton = row.getByRole('button', { name: /^Editar$/ })
  await editButton.click()
  await page.waitForTimeout(1500)

  const dialogSummary = await page.evaluate(() => {
    const text = (value) => (value || '').replace(/\s+/g, ' ').trim()
    const dialog = document.querySelector('[role="dialog"], [data-cy*="dialog"], [data-testid*="dialog"]') || document.body
    return {
      body: text(dialog.textContent).slice(0, 4000),
      inputs: Array.from(dialog.querySelectorAll('input, textarea, select'))
        .map((element) => ({
          tag: element.tagName,
          type: element.getAttribute('type') || '',
          name: element.getAttribute('name') || '',
          id: element.getAttribute('id') || '',
          placeholder: element.getAttribute('placeholder') || '',
          value: element.value || element.getAttribute('value') || '',
          ariaLabel: element.getAttribute('aria-label') || '',
        })),
      buttons: Array.from(dialog.querySelectorAll('button'))
        .map((element) => text(element.textContent || element.getAttribute('aria-label')))
        .filter(Boolean),
    }
  })

  console.log(JSON.stringify(dialogSummary, null, 2))
  await browser.close()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
