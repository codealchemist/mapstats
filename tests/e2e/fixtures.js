import { test as base, expect } from '@playwright/test'
import { mockServices } from './mocks.js'

// Bolivia: few enough places that every live layer fits in one minute of Open-Meteo's budget, so the request queue
// never has to wait in a test.
export const COUNTRY = 'BOL'

export const test = base.extend({
  // Every test runs offline, starting on COUNTRY with an empty cache. `calls`: the external requests made.
  calls: [async ({ page }, use) => {
    await page.addInitScript((iso3) => {
      if (sessionStorage.getItem('e2e-init')) return // keep state across reloads within a test
      localStorage.clear()
      localStorage.setItem('mapstats:country', JSON.stringify(iso3))
      sessionStorage.setItem('e2e-init', '1')
    }, COUNTRY)
    await use(await mockServices(page))
  }, { auto: true }],
})
export { expect }

/** Opens a place's report through the search box. */
export async function openReport(page, name) {
  const search = page.getByRole('combobox', { name: 'Search cities' })
  await search.fill(name)
  await page.getByRole('option', { name: new RegExp(`^${name}`) }).first().click()
  const report = page.getByRole('complementary', { name: `${name} report` })
  await expect(report).toBeVisible()
  return report
}
