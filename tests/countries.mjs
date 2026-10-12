// npm test — every registered country's places, as the app loads them: unique ids in a region of the country.
import { check, done } from '../tools/sdk/test.mjs'
import { COUNTRIES } from '../src/core/countries.js'
import { loadCountry } from '../tools/cli/context.mjs'
import { INDICATORS, MAP_METRICS } from '../src/data/metrics.js'

for (const country of COUNTRIES) {
  const { regionIds, places } = await loadCountry(country)
  const shown = places.filter((p) => p.region)
  const ids = shown.map((p) => p.id)
  const dup = ids.filter((id, i) => ids.indexOf(id) !== i)
  const regions = new Set(regionIds)
  const lost = shown.filter((p) => !regions.has(p.region)).map((p) => p.id)
  check(`${country.iso3}: ${shown.length} places, unique ids in known regions`, !dup.length && !lost.length, [...dup, ...lost].join(', '))
}
// The catalogue: one definition per indicator, and map layers that are layers (group, icon), each once.
const dup = (ids) => ids.filter((id, i) => ids.indexOf(id) !== i)
check('indicators are defined once', !dup(INDICATORS.map((i) => i.id)).length, dup(INDICATORS.map((i) => i.id)).join(', '))
check('map layers have a group and an icon, each once', MAP_METRICS.every((m) => m.group && m.icon) && !dup(MAP_METRICS.map((m) => m.id)).length,
  [...MAP_METRICS.filter((m) => !m.group || !m.icon).map((m) => m.id), ...dup(MAP_METRICS.map((m) => m.id))].join(', '))
done()
