import { test, expect } from './fixtures.js'

// A layer that fails shows its error in the status pill and panel, and loads again with Retry.

const pill = (page) => page.locator('.live-pill').filter({ hasText: 'Live data' })

test('a failed layer shows its error and loads again with Retry', async ({ page, calls }) => {
  calls.faults.set('air-quality-api', { status: 400, reason: 'Cannot read the request (test)' })
  await page.goto('/')
  // The failure shows while the other layers load, then the pill offers to retry.
  await expect(pill(page).locator('.live-fail')).toBeVisible()
  const retry = pill(page).getByRole('button', { name: 'Retry' })
  await expect(retry).toBeEnabled({ timeout: 30_000 })
  await pill(page).locator('.live-toggle').click()
  const panel = page.locator('#live-panel')
  await expect(panel.getByText('The service answered 400: Cannot read the request (test)')).toBeVisible()
  await expect(panel.getByText('Scores leave this layer out.')).toBeVisible()

  calls.faults.delete('air-quality-api')
  await panel.getByRole('button', { name: 'Retry Air quality' }).click()
  // Everything loaded: the pill hides.
  await expect(page.locator('.live-pill')).toHaveCount(0, { timeout: 30_000 })
})

test('an hourly limit says when it lifts, and Retry waits for it', async ({ page, calls }) => {
  calls.faults.set('air-quality-api', { status: 429, reason: 'Hourly API request limit exceeded. Please try again in the next hour.' })
  await page.goto('/')
  await expect(pill(page).locator('.live-wait')).toContainText('Open-Meteo limit until')
  await expect(pill(page).getByRole('button', { name: 'Retry' })).toBeDisabled({ timeout: 30_000 })
  await pill(page).locator('.live-toggle').click()
  await expect(page.locator('#live-panel .live-notice.blocked')).toContainText('hourly limit for this connection was reached (Air quality)')
})
