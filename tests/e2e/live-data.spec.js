import { test, expect, openReport } from './fixtures.js'
import { hits } from './mocks.js'

// Live layers that feed scores (and climate) load with the country; river flow and the climate surfaces' gap-filling
// grid wait until something asks for them.
// Gap-filling grid points sit on even whole degrees (lib/geo.js gapGrid).
const isGrid = (u) => u.searchParams.get('latitude').split(',').some((v) => +v % 2 === 0)

// Waits for the default layers: requests sent, then the status pill gone (it hides once every started layer loaded).
async function settled(page, calls) {
  await expect.poll(() => ['air-quality-api', 'historical-forecast-api', 'archive-api'].every((api) => hits(calls, api).length)).toBe(true)
  await expect(page.locator('.live-pill')).toHaveCount(0, { timeout: 30_000 })
}

test('only the scored layers, climate and earthquakes load by default', async ({ page, calls }) => {
  await page.goto('/')
  await settled(page, calls)
  for (const api of ['air-quality-api', 'historical-forecast-api', 'archive-api']) expect(hits(calls, api).length, api).toBeGreaterThan(0)
  expect(hits(calls, 'earthquake').length).toBeGreaterThan(0)
  expect(hits(calls, 'flood-api')).toHaveLength(0)
  // No gap-filling grid points (whole-degree coordinates) on the climate or UV layers.
  expect([...hits(calls, 'archive-api'), ...hits(calls, 'historical-forecast-api')].filter(isGrid)).toHaveLength(0)
})

test('river data loads when the flood overlay is turned on', async ({ page, calls }, info) => {
  await page.goto('/')
  await settled(page, calls)
  expect(hits(calls, 'flood-api')).toHaveLength(0)
  if (info.project.name === 'mobile') await page.getByTitle('Toggle side panel').click()
  await page.locator('label.toggle-row', { hasText: 'River flood watch' }).locator('input').check({ force: true })
  await expect.poll(() => hits(calls, 'flood-api').length).toBeGreaterThan(0)
})

test('the climate surface loads its grid points on demand', async ({ page, calls }, info) => {
  await page.goto('/')
  await settled(page, calls)
  if (info.project.name === 'mobile') await page.getByTitle('Toggle side panel').click()
  await page.locator('label.toggle-row', { hasText: 'Climate surface' }).locator('input').check({ force: true })
  await expect.poll(() => hits(calls, 'archive-api').filter(isGrid).length).toBeGreaterThan(0)
  // UV grid points wait for the UV surface.
  expect(hits(calls, 'historical-forecast-api').filter(isGrid)).toHaveLength(0)
})

test('a city report offers to load the river flood watch', async ({ page, calls }) => {
  await page.goto('/')
  await settled(page, calls)
  const report = await openReport(page, 'Santa Cruz')
  await report.getByRole('button', { name: 'Load river data' }).click()
  await expect.poll(() => hits(calls, 'flood-api').length).toBeGreaterThan(0)
  await expect(report.getByText('River flood watch', { exact: false }).first()).toBeVisible()
})
