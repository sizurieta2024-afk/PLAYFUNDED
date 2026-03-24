import { chromium } from 'playwright'

const DEBUG_URL = process.env.CDP_DEBUG_URL || 'http://127.0.0.1:63766'
const TARGET_URL = process.env.TARGET_REDIRECT_URL || 'http://localhost:3004/auth/callback'

async function main() {
  const browser = await chromium.connectOverCDP(DEBUG_URL)
  const context = browser.contexts()[0]
  const page = context.pages().find((current) => current.url().includes('supabase.com/dashboard/project/pvwynjnifdmaisswtwiz'))
  if (!page) {
    throw new Error('Supabase page not found')
  }

  await page.goto('https://supabase.com/dashboard/project/pvwynjnifdmaisswtwiz/auth/url-configuration', {
    waitUntil: 'domcontentloaded',
  })
  await page.waitForTimeout(2000)

  const bodyText = await page.locator('body').innerText()
  if (bodyText.includes(TARGET_URL)) {
    console.log(JSON.stringify({ added: false, url: TARGET_URL, reason: 'already_present' }, null, 2))
    await browser.close()
    return
  }

  await page.getByRole('button', { name: 'Add URL' }).click()
  const input = page.locator('input[name="urls.0.value"]').last()
  await input.waitFor({ state: 'visible', timeout: 15000 })
  await input.click()
  await input.fill(TARGET_URL)

  const saveButton = page.getByRole('button', { name: 'Save URLs' }).last()
  await saveButton.waitFor({ state: 'visible', timeout: 10000 })
  await saveButton.click()

  for (let attempt = 0; attempt < 10; attempt += 1) {
    await page.waitForTimeout(1000)
    const updatedBodyText = await page.locator('body').innerText()
    if (updatedBodyText.includes(TARGET_URL)) {
      console.log(JSON.stringify({ added: true, url: TARGET_URL }, null, 2))
      await browser.close()
      return
    }
  }

  throw new Error(`Redirect URL did not appear after save: ${TARGET_URL}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
