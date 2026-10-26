#!/usr/bin/env node
// Screenshots of the running app at desktop and phone size, to document a PR or a review.
//
//   npm run screenshots -- [options]       (or node scripts/screenshots.mjs [options])
//     --url <url>          the running app (default http://localhost:5173, npm run dev's; npm run preview uses 4173)
//     --country <ISO3>     country to open (default FRA)
//     --places <a,b,c>     places for reports and the comparison (default Paris,Lyon,Nice)
//     --layers <a|b|…>     map layers to show, by their label in the side panel (default: France's new layers)
//     --only <device>      desktop or mobile (default both)
//     --theme <theme>      dark or light (default dark)
//     --wait-live <s>      seconds to wait for live data to finish before the first shot (default 600; 0: don't wait)
//     --mock               offline stand-ins for every service (tests/e2e/mocks.js, where it exists): fast,
//                          synthetic values
//     --out <dir>          where to write (default screenshots/<branch>-<date>-<theme>)
//
// Writes NN-device-view.png per shot and index.md listing them with captions, ready to paste into a PR. A step
// that fails is logged and skipped. Needs Playwright's Chromium: npx playwright install chromium (the dev container
// image has it). The output (screenshots/) is gitignored.
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { chromium, devices } from 'playwright'

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => {
  if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true])
  return acc
}, []))
const URL_ = args.url || 'http://localhost:5173'
const COUNTRY = args.country || 'FRA'
const PLACES = (args.places || 'Paris,Lyon,Nice').split(',').map((s) => s.trim()).filter(Boolean)
const LAYERS = (args.layers || 'Flood exposure (disaster records)|Forest-fire exposure (risk records)|Premises eligible to fibre (FttH)|Relative poverty (60 % of median income)').split('|')
const WAIT_LIVE = args['wait-live'] === undefined ? 600 : +args['wait-live']
const THEME = args.theme || 'dark'
if (!['dark', 'light'].includes(THEME)) throw new Error(`--theme must be dark or light, not ${THEME}`)
const branch = (() => { try { return execSync('git branch --show-current').toString().trim().replace(/[^\w.-]+/g, '-') } catch { return 'app' } })()
const OUT = path.resolve(args.out || `screenshots/${branch}-${new Date().toISOString().slice(0, 10)}-${THEME}`)
const DEVICES = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  mobile: devices['Pixel 7'],
}

const shots = []
let n = 0

async function shoot(page, device, name, caption) {
  const file = `${String(++n).padStart(2, '0')}-${device}-${name}.png`
  await page.waitForTimeout(800) // let transitions and map tiles settle
  await page.screenshot({ path: path.join(OUT, file) })
  shots.push({ file, device, caption })
  console.log(`  ✓ ${file}`)
}

async function step(label, fn) {
  try { await fn() } catch (e) { console.log(`  ✗ ${label}: ${e.message.split('\n')[0]}`) }
}

// The side panel is a drawer on phones: open it for a step, close it to show the map.
async function panel(page, mobile, open) {
  if (!mobile) return
  const toggle = page.getByTitle('Toggle side panel')
  const isOpen = await page.getByTitle('Close panel').isVisible().catch(() => false)
  if (open !== isOpen) await toggle.click()
}

async function openReport(page, name) {
  const search = page.getByRole('combobox', { name: 'Search cities' })
  await search.fill(name)
  await page.getByRole('option', { name: new RegExp(`^${name}`) }).first().click()
  const report = page.getByRole('complementary', { name: `${name} report` })
  await report.waitFor({ timeout: 20_000 })
  return report
}

async function waitLive(page) {
  if (!WAIT_LIVE) return
  // The status pill shows only once loading starts (after the country's boundaries load): wait for it to appear, then
  // to go away. It never appears when everything comes from the cache.
  const appeared = await page.locator('.live-pill').first().waitFor({ timeout: 20_000 }).then(() => true, () => false)
  if (!appeared) return console.log('  … live data: nothing to load (cached)')
  const t = Date.now()
  process.stdout.write(`  … waiting for live data (up to ${WAIT_LIVE} s)`)
  while (Date.now() - t < WAIT_LIVE * 1000) {
    if (!(await page.locator('.live-pill').count())) return console.log(` done in ${Math.round((Date.now() - t) / 1000)} s`)
    await page.waitForTimeout(5000)
    process.stdout.write('.')
  }
  console.log(' still loading: shooting anyway')
}

async function run(browser, device, storageState) {
  console.log(`\n${device}`)
  const mobile = device === 'mobile'
  // The app uses the stored theme first, then the system's: set both, so a stored choice can't override --theme.
  const context = await browser.newContext({ ...DEVICES[device], colorScheme: THEME, ...(storageState && { storageState }) })
  await context.addInitScript(([iso3, theme]) => {
    localStorage.setItem('mapstats:country', JSON.stringify(iso3))
    localStorage.setItem('mapstats:theme', JSON.stringify(theme))
  }, [COUNTRY, THEME])
  const page = await context.newPage()
  if (args.mock) {
    const mocks = path.resolve('tests/e2e/mocks.js')
    if (!fs.existsSync(mocks)) throw new Error('--mock needs tests/e2e/mocks.js (not on this branch)')
    await (await import(mocks)).mockServices(page)
  }
  await page.goto(URL_)
  await page.getByRole('region', { name: 'Map' }).or(page.locator('canvas')).first().waitFor({ timeout: 30_000 })
  if (!storageState) await waitLive(page)

  await step('map', () => shoot(page, device, 'map', 'The country map, MapStats score'))
  await step('ranking', async () => {
    await panel(page, mobile, true)
    await page.getByRole('tab', { name: 'Ranking' }).click()
    await shoot(page, device, 'ranking', 'Ranking')
    await page.getByRole('tab', { name: 'Layers' }).click()
  })
  for (const label of LAYERS) {
    await step(`layer ${label}`, async () => {
      await panel(page, mobile, true)
      await page.getByRole('button', { name: label, exact: false }).first().click()
      await panel(page, mobile, false)
      await shoot(page, device, `layer-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`, `Map layer: ${label}`)
    })
  }
  await panel(page, mobile, false)

  for (const [i, place] of PLACES.entries()) {
    await step(`report ${place}`, async () => {
      const report = await openReport(page, place)
      const slug = place.toLowerCase().replace(/[^a-z0-9]+/g, '-')
      await shoot(page, device, `report-${slug}`, `Report: ${place}`)
      if (i === 0) {
        await report.locator('#sec-sources').scrollIntoViewIfNeeded()
        await shoot(page, device, `report-${slug}-sources`, `Report: ${place}, values by source`)
      }
      // Adding a place opens the comparison over everything: close it again before the next step.
      await report.getByTitle('Add to comparison').click({ timeout: 5000 }).catch(() => {})
      const compare = page.getByRole('dialog', { name: 'Compare places' })
      if (await compare.waitFor({ timeout: 3000 }).then(() => true, () => false)) {
        await page.keyboard.press('Escape')
        await compare.waitFor({ state: 'hidden', timeout: 5000 })
      }
      if (await report.isVisible()) await report.getByTitle('Close').click()
    })
  }
  await step('compare', async () => {
    await page.getByTitle('Compare places (up to 3)').click()
    await page.getByRole('dialog', { name: 'Compare places' }).waitFor({ timeout: 10_000 })
    await shoot(page, device, 'compare', `Comparison: ${PLACES.join(', ')}`)
    await page.keyboard.press('Escape')
  })
  for (const [title, name, caption] of [['Methodology & sources', 'methodology', 'Methodology'], ['Data sources', 'sources', 'Data sources']]) {
    await step(name, async () => {
      // On phones these sit in the "More" menu.
      const direct = page.getByTitle(title)
      if (!(await direct.isVisible().catch(() => false))) await page.getByTitle('More').click()
      await page.getByTitle(title).or(page.getByRole('menuitem', { name: new RegExp(caption, 'i') })).first().click()
      await shoot(page, device, name, caption)
      await page.keyboard.press('Escape')
    })
  }
  const state = await context.storageState()
  await context.close()
  return state
}

const browser = await chromium.launch().catch((e) => {
  // The dev container sets DEVCONTAINER=true (.devcontainer/Dockerfile).
  const fix = process.env.DEVCONTAINER === 'true'
    ? 'In the dev container: rebuild it from a branch with the Playwright install (chore/devcontainer-browser).'
    : 'Install Playwright\'s browser once: npx playwright install chromium'
  console.error(`Chromium won't start: ${e.message.split('\n')[0]}\n${fix}`)
  process.exit(1)
})
fs.mkdirSync(OUT, { recursive: true })
try {
  console.log(`${URL_} · ${COUNTRY} · ${THEME} theme · ${args.mock ? 'mocked data' : 'live data'} → ${path.relative(process.cwd(), OUT)}`)
  const which = args.only ? [args.only] : ['desktop', 'mobile']
  let state = null
  for (const device of which) state = await run(browser, device, state) // the phone pass reuses the cached live data
} finally {
  await browser.close()
}

const lines = [`# Screenshots · ${branch}`, '', `${URL_} · ${COUNTRY} · ${THEME} theme · ${args.mock ? 'mocked data (synthetic values)' : 'live data'} · ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`, '']
for (const device of ['desktop', 'mobile']) {
  const list = shots.filter((s) => s.device === device)
  if (!list.length) continue
  lines.push(`## ${device === 'desktop' ? 'Desktop (1440 × 900)' : 'Phone (Pixel 7)'}`, '')
  for (const s of list) lines.push(`**${s.caption}**`, '', `![${s.caption}](${s.file})`, '')
}
fs.writeFileSync(path.join(OUT, 'index.md'), lines.join('\n'))
console.log(`\n${shots.length} screenshots · ${path.relative(process.cwd(), path.join(OUT, 'index.md'))}`)
