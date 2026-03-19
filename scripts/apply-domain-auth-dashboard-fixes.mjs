import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

const DEBUG_URL = process.env.CDP_DEBUG_URL || 'http://127.0.0.1:63766'
const OUT_DIR = path.resolve('test-results/domain-auth-fix')
const GODADDY_APEX_IP = '76.76.21.21'
const SITE_URL = 'https://playfunded.lat'
const REDIRECT_URLS = [
  'https://playfunded.lat/auth/callback',
  'https://playfunded-gamma.vercel.app/auth/callback',
  'http://localhost:3004/auth/callback',
  'http://localhost:3001/auth/callback',
]

async function ensureDir() {
  await fs.mkdir(OUT_DIR, { recursive: true })
}

async function acceptCookieBannerIfPresent(page) {
  const acceptButton = page.getByRole('button', { name: /accept/i })
  if (await acceptButton.count()) {
    await acceptButton.first().click().catch(() => {})
  }
}

async function updateGoDaddyDns(page) {
  await page.goto('https://dcc.godaddy.com/control/dnsmanagement?domainName=playfunded.lat', {
    waitUntil: 'domcontentloaded',
  })
  await page.waitForLoadState('domcontentloaded').catch(() => {})
  await page.getByRole('heading', { name: 'Administración de DNS' }).waitFor({ state: 'visible', timeout: 20000 })
  await page.waitForTimeout(4000)

  const rows = page.locator('tr')
  const rowCount = await rows.count()
  let targetRow = null

  for (let index = 0; index < rowCount; index += 1) {
    const row = rows.nth(index)
    const text = await row.innerText().catch(() => '')
    if (/websitebuilder site/i.test(text) && /\bA\b/.test(text) && /@/.test(text)) {
      targetRow = row
      break
    }
  }

  if (!targetRow) {
    const existingBody = await page.locator('body').innerText()
    if (existingBody.includes(GODADDY_APEX_IP)) {
      return { changed: false, apexValue: GODADDY_APEX_IP }
    }
    throw new Error('Could not find the apex WebsiteBuilder DNS row to update.')
  }

  await targetRow.getByRole('button', { name: /^Editar$/ }).click()
  const valueInput = page.getByLabel('Valor')
  await valueInput.waitFor({ state: 'visible', timeout: 15000 })
  await valueInput.fill(GODADDY_APEX_IP)
  await page.getByRole('button', { name: /^Guardar$/ }).click()
  await page.waitForTimeout(4000)

  const bodyText = await page.locator('body').innerText()
  if (!bodyText.includes(GODADDY_APEX_IP)) {
    throw new Error('GoDaddy DNS save did not appear to update the apex record value.')
  }

  await page.screenshot({ path: path.join(OUT_DIR, 'godaddy-dns-updated.png'), fullPage: true }).catch(() => {})
  return { changed: true, apexValue: GODADDY_APEX_IP }
}

async function ensureRedirectUrl(page, url) {
  const bodyText = await page.locator('body').innerText()
  if (bodyText.includes(url)) {
    return false
  }

  await page.getByRole('button', { name: 'Add URL' }).click()
  const input = page.locator('input[name="urls.0.value"]')
  await input.waitFor({ state: 'visible', timeout: 10000 })
  await input.fill(url)
  await page.getByRole('button', { name: 'Save URLs' }).click()
  for (let attempt = 0; attempt < 8; attempt += 1) {
    await page.waitForTimeout(1000)
    const updatedText = await page.locator('body').innerText()
    if (updatedText.includes(url)) {
      return true
    }
  }
  const postSaveText = await page.locator('body').innerText()
  throw new Error(`Supabase redirect URL ${url} was not visible after save. Current page text: ${postSaveText.slice(0, 2000)}`)
}

async function updateSupabaseAuth(page) {
  await page.goto('https://supabase.com/dashboard/project/pvwynjnifdmaisswtwiz/auth/url-configuration', {
    waitUntil: 'domcontentloaded',
  })
  await page.waitForLoadState('domcontentloaded').catch(() => {})
  await page.waitForTimeout(2000)
  await acceptCookieBannerIfPresent(page)

  const siteUrlInput = page.locator('input[name="SITE_URL"]')
  await siteUrlInput.waitFor({ state: 'visible', timeout: 15000 })
  const currentSiteUrl = await siteUrlInput.inputValue()
  let siteUrlChanged = false
  if (currentSiteUrl !== SITE_URL) {
    await siteUrlInput.fill(SITE_URL)
    await page.getByRole('button', { name: 'Save changes' }).click()
    await page.waitForTimeout(2000)
    const updatedSiteUrl = await siteUrlInput.inputValue()
    if (updatedSiteUrl !== SITE_URL) {
      throw new Error(`Supabase Site URL did not update. Current value: ${updatedSiteUrl}`)
    }
    siteUrlChanged = true
  }

  const addedRedirects = []
  for (const url of REDIRECT_URLS) {
    const added = await ensureRedirectUrl(page, url)
    if (added) {
      addedRedirects.push(url)
    }
  }

  await page.screenshot({ path: path.join(OUT_DIR, 'supabase-auth-updated.png'), fullPage: true }).catch(() => {})
  return {
    siteUrl: SITE_URL,
    siteUrlChanged,
    addedRedirects,
  }
}

async function main() {
  await ensureDir()
  const browser = await chromium.connectOverCDP(DEBUG_URL)
  const context = browser.contexts()[0]
  const pages = context.pages()
  const godaddy = pages.find((page) => page.url().includes('godaddy.com'))
  const supabase = pages.find((page) => page.url().includes('supabase.com/dashboard/project/pvwynjnifdmaisswtwiz'))

  if (!godaddy || !supabase) {
    throw new Error('Could not find the authenticated GoDaddy and Supabase tabs in the open browser.')
  }

  const godaddyResult = await updateGoDaddyDns(godaddy)
  const supabaseResult = await updateSupabaseAuth(supabase)

  console.log(JSON.stringify({ godaddy: godaddyResult, supabase: supabaseResult }, null, 2))
  await browser.close()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
