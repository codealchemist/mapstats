import { test, expect, openReport } from './fixtures.js'

test('loads the map and the selected country', async ({ page, calls }) => {
  await page.goto('/')
  await expect(page.getByRole('combobox', { name: 'Country' })).toHaveValue('BOL')
  await expect(page.locator('.maplibregl-canvas')).toBeVisible()
  await expect.poll(() => calls.length).toBeGreaterThan(0)
})

test('a report shows the monthly temperature chart with record highs and lows', async ({ page, calls }) => {
  await page.goto('/')
  const report = await openReport(page, 'La Paz')
  const chart = report.locator('figure.chart-card', { hasText: 'Temperature by month' })
  await expect(chart).toBeVisible()
  await expect(chart.locator('.chart-sub')).toContainText('Record high and low')
  await chart.getByTitle('Show data table').click()
  const head = chart.locator('thead th')
  await expect(head).toHaveText(['Month', 'Record high °C', 'Avg. max °C', 'Avg. min °C', 'Record low °C'])
  await expect(chart.locator('tbody tr')).toHaveCount(12)
  // Every month has a record high above its average max, and a record low below its average min.
  const rows = await chart.locator('tbody tr').evaluateAll((trs) => trs.map((tr) => [...tr.cells].slice(1).map((td) => +td.textContent)))
  for (const [hi, max, min, lo] of rows) {
    expect(hi).toBeGreaterThanOrEqual(max)
    expect(lo).toBeLessThanOrEqual(min)
  }
  expect(calls.some((u) => u.hostname === 'archive-api.open-meteo.com' && u.searchParams.get('latitude')?.split(',').length === 1)).toBe(true)
})
