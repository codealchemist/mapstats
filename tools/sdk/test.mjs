// Offline test helpers, in the style of the news and live tests: print ✓/✗ per check, fail the process at the end.
import fs from 'node:fs'

let failures = 0

export function check(label, ok, extra = '') {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? ` — ${extra}` : ''}`)
  if (!ok) failures++
}

export const section = (title) => console.log(`\n${title}`)

/** Reads a fixture next to the test: fixture(new URL('./fixtures/x.csv', import.meta.url)). */
export const fixture = (url) => fs.readFileSync(url, 'utf8')

export function done() {
  if (failures) {
    console.log(`\n${failures} check(s) failed`)
    process.exitCode = 1
  } else console.log('\nAll checks passed')
}
