import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

const DEBUG_URL = process.env.CDP_DEBUG_URL || 'http://127.0.0.1:63766'
const OUT_DIR = path.resolve('test-results/dashboard-inspect')

function normalizeText(value) {
  return (value || '').replace(/\s+/g, ' ').trim()
}

async function summarizePage(page, name) {
  await page.bringToFront()
  await page.waitForLoadState('domcontentloaded', { timeout: 30000 }).catch(() => {})

  const screenshotPath = path.join(OUT_DIR, `${name}.png`)
  await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {})

  const summary = await page.evaluate(() => {
    const text = (value) => (value || '').replace(/\s+/g, ' ').trim()
    const headings = Array.from(document.querySelectorAll('h1, h2, h3'))
      .map((element) => text(element.textContent))
      .filter(Boolean)
      .slice(0, 20)

    const buttons = Array.from(document.querySelectorAll('button, [role="button"]'))
      .map((element) => text(element.textContent || element.getAttribute('aria-label')))
      .filter(Boolean)
      .slice(0, 30)

    const links = Array.from(document.querySelectorAll('a'))
      .map((element) => ({
        text: text(element.textContent || element.getAttribute('aria-label')),
        href: element.getAttribute('href') || '',
      }))
      .filter((item) => item.text || item.href)
      .slice(0, 40)

    const inputs = Array.from(document.querySelectorAll('input, textarea'))
      .map((element) => ({
        name: element.getAttribute('name') || '',
        id: element.getAttribute('id') || '',
        placeholder: element.getAttribute('placeholder') || '',
        value: element.getAttribute('value') || '',
        type: element.getAttribute('type') || '',
      }))
      .slice(0, 20)

    return {
      title: document.title,
      url: window.location.href,
      headings,
      buttons,
      links,
      inputs,
      bodyTextSample: text(document.body?.innerText).slice(0, 2000),
    }
  })

  return { screenshotPath, summary }
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true })
  const browser = await chromium.connectOverCDP(DEBUG_URL)
  const context = browser.contexts()[0]
  if (!context) {
    throw new Error('No browser context found in the connected CDP session.')
  }

  const pages = context.pages()
  const godaddy = pages.find((page) => page.url().includes('dashboard.godaddy.com'))
  const supabase = pages.find((page) => page.url().includes('supabase.com/dashboard/project/pvwynjnifdmaisswtwiz'))

  if (!godaddy || !supabase) {
    throw new Error(`Expected GoDaddy and Supabase pages. Found: ${pages.map((page) => page.url()).join(', ')}`)
  }

  const godaddyResult = await summarizePage(godaddy, 'godaddy')
  const supabaseResult = await summarizePage(supabase, 'supabase')

  const result = {
    debugUrl: DEBUG_URL,
    godaddy: godaddyResult.summary,
    supabase: supabaseResult.summary,
    screenshots: {
      godaddy: godaddyResult.screenshotPath,
      supabase: supabaseResult.screenshotPath,
    },
  }

  console.log(JSON.stringify(result, null, 2))
  await browser.close()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
