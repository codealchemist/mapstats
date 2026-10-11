// npm test — heat and cold indices against the published NWS and Environment Canada tables.
import { check, done } from '../../../tools/sdk/test.mjs'
import { heatIndex, humidex, windChill, heatStep, coldStep } from '../thermal.js'

const fromF = (f) => ((f - 32) * 5) / 9, toF = (c) => (c * 9) / 5 + 32
const rhFromDew = (t, td) => 100 * Math.exp((17.62 * td) / (243.12 + td) - (17.62 * t) / (243.12 + t))

for (const [tF, rh, want] of [[90, 50, 95], [100, 40, 109], [96, 65, 121], [80, 40, 80]]) {
  check(`heat index ${tF} °F at ${rh} % ≈ ${want} °F (NWS chart)`, Math.round(toF(heatIndex(fromF(tF), rh))) === want)
}
// The published table rounds inconsistently (33.97 → 34, 42.6 → 42): within 1.
for (const [t, td, want] of [[30, 15, 34], [30, 25, 42], [35, 20, 42]]) {
  const h = humidex(t, rhFromDew(t, td))
  check(`humidex ${t} °C, dew point ${td} °C ≈ ${want} (ECCC table)`, Math.abs(h - want) < 1, h.toFixed(2))
}
for (const [t, v, want] of [[-20, 20, -30], [-10, 30, -20], [0, 10, -3]]) {
  check(`wind chill ${t} °C at ${v} km/h ≈ ${want} (wind chill table)`, Math.round(windChill(t, v)) === want)
}
check('wind chill is the air temperature above 10 °C or in calm air', windChill(15, 30) === 15 && windChill(-5, 2) === -5)
check('heat steps: equal steps per category', heatStep(25, [[30], [40], [46]]) === 100 && Math.round(heatStep(41, [[30], [40], [46]])) === 33 && heatStep(50, [[30], [40], [46]]) === 0)
check('cold steps: lower is worse', coldStep(-5, [[-10], [-28], [-40], [-48]]) === 100 && coldStep(-30, [[-10], [-28], [-40], [-48]]) === 50)
done()
