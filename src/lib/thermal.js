// Heat and cold stress from hourly temperature (°C), relative humidity (%) and 10 m wind (km/h), by the indices
// the standards in src/data/standards.js define. Pure functions: tested in src/lib/test/thermal.mjs.

const toF = (c) => (c * 9) / 5 + 32
const toC = (f) => ((f - 32) * 5) / 9

/** US NWS Heat Index (°C): Rothfusz regression with the NWS adjustments; the simple formula below ~27 °C. */
export function heatIndex(t, rh) {
  const T = toF(t)
  const simple = 0.5 * (T + 61 + (T - 68) * 1.2 + rh * 0.094)
  if ((simple + T) / 2 < 80) return toC(simple)
  let hi = -42.379 + 2.04901523 * T + 10.14333127 * rh - 0.22475541 * T * rh - 0.00683783 * T * T
    - 0.05481717 * rh * rh + 0.00122874 * T * T * rh + 0.00085282 * T * rh * rh - 0.00000199 * T * T * rh * rh
  if (rh < 13 && T >= 80 && T <= 112) hi -= ((13 - rh) / 4) * Math.sqrt((17 - Math.abs(T - 95)) / 17)
  else if (rh > 85 && T >= 80 && T <= 87) hi += ((rh - 85) / 10) * ((87 - T) / 5)
  return toC(hi)
}

/** Dew point (°C) from temperature and relative humidity (Magnus formula). */
export function dewPoint(t, rh) {
  const g = Math.log(Math.max(rh, 1) / 100) + (17.62 * t) / (243.12 + t)
  return (243.12 * g) / (17.62 - g)
}

/** Environment and Climate Change Canada humidex. */
export function humidex(t, rh) {
  const td = dewPoint(t, rh)
  return t + 0.5555 * (6.11 * Math.exp(5417.753 * (1 / 273.16 - 1 / (273.15 + td))) - 10)
}

/** 2001 North American wind chill index (NWS and Environment Canada); the air temperature outside its range. */
export function windChill(t, kmh) {
  if (t > 10 || kmh < 4.8) return t
  const v = kmh ** 0.16
  return 13.12 + 0.6215 * t - 11.37 * v + 0.3965 * t * v
}

export const HEAT_INDEX = { heatIndex, humidex }

// Plain loops: these run per day per place live, and per grid point per day in the UTCI prefill (millions of calls).

/** Score (100 → 0, equal steps) of a value against categories given by their lower bounds (heat). */
export const heatStep = (v, categories) => {
  let reached = 0
  for (const [from] of categories) if (v >= from) reached++
  return 100 - (reached * 100) / categories.length
}

/** Score of a wind chill against categories given by their upper bounds (cold: lower is worse). */
export const coldStep = (v, categories) => {
  let reached = 0
  for (const [to] of categories) if (v <= to) reached++
  return 100 - (reached * 100) / categories.length
}
