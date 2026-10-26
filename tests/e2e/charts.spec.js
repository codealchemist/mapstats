import { test, expect, openReport } from './fixtures.js'

// Drags a finger vertically across `box` (a page scroll), with real touch events.
async function drag(page, box) {
  const cdp = await page.context().newCDPSession(page)
  const x = box.x + box.width / 2
  const point = (y) => [{ x, y }]
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: point(box.y + box.height - 10) })
  for (let i = 1; i <= 8; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: point(box.y + box.height - 10 - i * 15) })
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
}

test.describe('mobile charts', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch behaviour')

  test('dragging over a chart scrolls the page without picking a point; a tap shows values below it', async ({ page }) => {
    await page.goto('/')
    const report = await openReport(page, 'La Paz')
    const chart = report.locator('figure.chart-card', { hasText: 'Temperature by month' })
    await chart.scrollIntoViewIfNeeded()
    const readout = chart.locator('.chart-readout')
    await expect(readout).toHaveText('Tap the chart to read its values')

    const canvas = chart.locator('canvas')
    const scroller = report.locator('.report-scroll')
    const before = await scroller.evaluate((el) => el.scrollTop)
    await drag(page, await canvas.boundingBox())
    await expect.poll(() => scroller.evaluate((el) => el.scrollTop)).not.toBe(before)
    await expect(readout).toHaveText('Tap the chart to read its values')

    const box = await canvas.boundingBox()
    await page.touchscreen.tap(box.x + box.width * 0.2, box.y + box.height / 2)
    await expect(readout).toContainText('Avg. max °C')
    await expect(readout).toContainText('Record low °C')
    await expect(readout.locator('b')).toHaveText(/^[A-Z][a-z]{2}$/) // the month
  })
})

test('desktop charts keep their hover tooltip and show no readout', async ({ page, isMobile }) => {
  test.skip(isMobile, 'pointer behaviour')
  await page.goto('/')
  const report = await openReport(page, 'La Paz')
  const chart = report.locator('figure.chart-card', { hasText: 'Temperature by month' })
  await expect(chart.locator('canvas')).toBeVisible()
  await expect(chart.locator('.chart-readout')).toHaveCount(0)
})
