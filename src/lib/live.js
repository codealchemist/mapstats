// Live data from CORS-enabled public APIs (no keys required).
//  - Open-Meteo: ERA5 historical weather, CAMS air quality, UV forecast, geocoding
//  - USGS: earthquake catalogue
// Responses are summarised and cached in localStorage to stay well inside free quotas.

const CACHE_PREFIX = 'mapstats:v1:'
const DAY = 86_400_000

function cacheGet(key, ttl) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key)
    if (!raw) return null
    const { t, data } = JSON.parse(raw)
    return Date.now() - t < ttl ? data : null
  } catch {
    return null
  }
}

function cacheSet(key, data) {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ t: Date.now(), data }))
  } catch {
    // Quota exceeded or storage unavailable: drop older MapStats entries and carry on uncached.
    try {
      Object.keys(localStorage).filter((k) => k.startsWith(CACHE_PREFIX)).forEach((k) => localStorage.removeItem(k))
    } catch { /* ignore */ }
  }
}

export async function cached(key, ttl, fn) {
  const hit = cacheGet(key, ttl)
  if (hit) return hit
  const data = await fn()
  cacheSet(key, data)
  return data
}

async function getJSON(url, timeout = 30000) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeout)
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
    return url.includes('format=csv') ? await res.text() : await res.json()
  } finally {
    clearTimeout(timer)
  }
}

const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n))
const coordParams = (pts) =>
  `latitude=${pts.map((p) => p.lat.toFixed(3)).join(',')}&longitude=${pts.map((p) => p.lon.toFixed(3)).join(',')}`
const asArray = (r) => (Array.isArray(r) ? r : [r])
const mean = (a) => {
  const v = a.filter((x) => x != null && !Number.isNaN(x))
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null
}

// ---------- Climate ----------

const DAILY_VARS = 'temperature_2m_max,temperature_2m_min,precipitation_sum,snowfall_sum,sunshine_duration,wind_speed_10m_max'

// Comfort score per month (0–100): ideal mean temperature 16–24 °C, penalised for heat,
// frost, heavy rain, snow and lack of sunshine. Annual comfort is the 12-month average.
export function monthComfort({ tmax, tmin, precip, snow, sunHours }) {
  const t = (tmax + tmin) / 2
  let s = 100
  if (t < 16) s -= 5 * (16 - t)
  if (t > 24) s -= 6 * (t - 24)
  if (tmax > 30) s -= 3 * (tmax - 30)
  if (tmin < 2) s -= 3 * (2 - tmin)
  if (precip > 100) s -= (precip - 100) / 8
  s -= (snow || 0) * 1.5
  if (sunHours != null && sunHours < 4) s -= (4 - sunHours) * 4
  return Math.max(0, Math.min(100, s))
}

// Collapse daily ERA5 series into monthly normals (averaged over all years in range).
export function summariseDaily(daily) {
  const months = Array.from({ length: 12 }, () => ({ tmax: [], tmin: [], wind: [], precip: {}, snow: {}, sun: {}, wet: {} }))
  const years = {}
  daily.time.forEach((d, i) => {
    const y = +d.slice(0, 4)
    const m = +d.slice(5, 7) - 1
    const M = months[m]
    const key = y
    M.tmax.push(daily.temperature_2m_max[i])
    M.tmin.push(daily.temperature_2m_min[i])
    M.wind.push(daily.wind_speed_10m_max?.[i])
    M.precip[key] = (M.precip[key] || 0) + (daily.precipitation_sum[i] || 0)
    M.snow[key] = (M.snow[key] || 0) + (daily.snowfall_sum[i] || 0)
    M.sun[key] = (M.sun[key] || 0) + (daily.sunshine_duration[i] || 0) / 3600
    M.wet[key] = (M.wet[key] || 0) + ((daily.precipitation_sum[i] || 0) >= 1 ? 1 : 0)
    const Y = (years[y] ||= { t: [], p: 0, hi: -Infinity, lo: Infinity })
    if (daily.temperature_2m_max[i] != null) Y.t.push((daily.temperature_2m_max[i] + daily.temperature_2m_min[i]) / 2)
    if (daily.temperature_2m_max[i] != null) Y.hi = Math.max(Y.hi, daily.temperature_2m_max[i])
    if (daily.temperature_2m_min[i] != null) Y.lo = Math.min(Y.lo, daily.temperature_2m_min[i])
    Y.p += daily.precipitation_sum[i] || 0
  })
  const daysIn = (m) => [31, 28.25, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m]
  const monthly = months.map((M, m) => {
    const r = (v) => (v == null ? null : Math.round(v * 10) / 10)
    const out = {
      tmax: r(mean(M.tmax)),
      tmin: r(mean(M.tmin)),
      windMax: r(mean(M.wind)),
      precip: r(mean(Object.values(M.precip))),
      snow: r(mean(Object.values(M.snow))),
      sunHours: r(mean(Object.values(M.sun)) / daysIn(m)),
      wetDays: r(mean(Object.values(M.wet))),
    }
    out.comfort = Math.round(monthComfort(out))
    return out
  })
  const sum = (k) => monthly.reduce((s, m) => s + (m[k] || 0), 0)
  // Hottest day / coldest night of each (near-)complete year, averaged over the years in range.
  const full = Object.values(years).filter((Y) => Y.t.length > 300)
  const r1 = (v) => (v == null ? null : Math.round(v * 10) / 10)
  return {
    monthly,
    tempMaxAnnual: r1(mean(full.map((Y) => Y.hi))),
    tempMinAnnual: r1(mean(full.map((Y) => Y.lo))),
    meanTemp: Math.round(mean(monthly.map((m) => (m.tmax + m.tmin) / 2)) * 10) / 10,
    annualPrecip: Math.round(sum('precip')),
    snowfall: Math.round(sum('snow')),
    sunshine: Math.round(monthly.reduce((s, m, i) => s + m.sunHours * daysIn(i), 0)),
    climateComfort: Math.round(mean(monthly.map((m) => m.comfort))),
    yearly: Object.entries(years)
      .filter(([, Y]) => Y.t.length > 300)
      .map(([y, Y]) => ({ year: +y, meanTemp: Math.round(mean(Y.t) * 100) / 100, precip: Math.round(Y.p) })),
  }
}

const lastFullYear = () => new Date().getFullYear() - 1

// One recent full year for many points at once (map layers). Returns { [id]: summary + elevation }.
export async function fetchClimateBatch(points) {
  const year = lastFullYear()
  const out = {}
  for (const group of chunk(points, 40)) {
    const key = `clim2:${year}:${group.map((p) => p.id).join('|')}`
    const data = await cached(key, 30 * DAY, async () => {
      const url = `https://archive-api.open-meteo.com/v1/archive?${coordParams(group)}&start_date=${year}-01-01&end_date=${year}-12-31&daily=${DAILY_VARS}&timezone=auto`
      const res = asArray(await getJSON(url, 60000))
      return res.map((r, i) => {
        const { monthly, yearly, ...rest } = summariseDaily(r.daily)
        return { id: group[i].id, elevation: r.elevation, ...rest }
      })
    })
    data.forEach((d) => (out[d.id] = d))
  }
  return out
}

// Ten-year normals for one location (city report).
export async function fetchClimateDetail(lat, lon) {
  const end = lastFullYear()
  const start = end - 9
  return cached(`climd2:${lat.toFixed(2)},${lon.toFixed(2)}:${end}`, 30 * DAY, async () => {
    const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${start}-01-01&end_date=${end}-12-31&daily=${DAILY_VARS}&timezone=auto`
    const r = await getJSON(url, 90000)
    return { elevation: r.elevation, period: `${start}–${end}`, ...summariseDaily(r.daily) }
  })
}

// ---------- UV climatology ----------

// ERA5 has no UV, so a full year of archived forecasts (Open-Meteo historical forecast API) is used.
export async function fetchUvBatch(points) {
  const year = lastFullYear()
  const out = {}
  for (const group of chunk(points, 40)) {
    const key = `uvy:${year}:${group.map((p) => p.id).join('|')}`
    const data = await cached(key, 30 * DAY, async () => {
      const url = `https://historical-forecast-api.open-meteo.com/v1/forecast?${coordParams(group)}&start_date=${year}-01-01&end_date=${year}-12-31&daily=uv_index_max&timezone=auto`
      const res = asArray(await getJSON(url, 60000))
      return res.map((r, i) => {
        const v = r.daily.uv_index_max.filter((x) => x != null)
        return { id: group[i].id, uvMean: v.length > 300 ? Math.round(mean(v) * 10) / 10 : null, uvMax: v.length > 300 ? Math.max(...v) : null }
      })
    })
    data.forEach((d) => (out[d.id] = d))
  }
  return out
}

// ---------- River floods (GloFAS) ----------

// Copernicus GloFAS river discharge at the nearest river cell (~5 km). The past year sets the
// river's usual high water (90th percentile of daily flow); floodWatch = 30-day forecast peak ÷
// usual high water, so > 1 means flow above what 9 days in 10 of the past year saw. This is a
// signal, not an official warning (GloFAS warnings use multi-decade return-period thresholds).
// Points whose cell carries < 1 m³/s median flow are treated as having no significant river.
export async function fetchFloodBatch(points) {
  const today = new Date()
  const iso = (d) => d.toISOString().slice(0, 10)
  const start = iso(new Date(today - 365 * DAY)), end = iso(new Date(+today + 30 * DAY)), now = iso(today)
  const out = {}
  for (const group of chunk(points, 40)) {
    const key = `flood:${now}:${group.map((p) => p.id).join('|')}`
    const data = await cached(key, DAY / 2, async () => {
      const url = `https://flood-api.open-meteo.com/v1/flood?${coordParams(group)}&daily=river_discharge&start_date=${start}&end_date=${end}`
      const res = asArray(await getJSON(url, 60000))
      return res.map((r, i) => summariseFlood(group[i].id, r.daily, now))
    })
    data.forEach((d) => (out[d.id] = d))
  }
  return out
}

export function summariseFlood(id, daily, today) {
  const past = [], future = []
  daily.time.forEach((t, i) => {
    const q = daily.river_discharge[i]
    if (q == null) return
    ;(t < today ? past : future).push({ t, q })
  })
  const sorted = past.map((x) => x.q).sort((a, b) => a - b)
  const normal = sorted.length ? sorted[sorted.length >> 1] : null
  if (normal == null || normal < 1) return { id, river: false }
  const highWater = sorted[Math.floor(sorted.length * 0.9)]
  const peakPast = sorted.at(-1)
  const peakFuture = future.reduce((m, x) => (!m || x.q > m.q ? x : m), null)
  const r2 = (v) => Math.round(v * 100) / 100
  return {
    id, river: true,
    normalFlow: Math.round(normal),
    highWater: Math.round(highWater),
    pastPeak: Math.round(peakPast),
    pastPeakRatio: r2(peakPast / highWater),
    forecastPeak: peakFuture ? Math.round(peakFuture.q) : null,
    forecastPeakDate: peakFuture?.t || null,
    floodWatch: peakFuture ? r2(peakFuture.q / highWater) : null,
  }
}

// ---------- Air quality ----------

export async function fetchAqiBatch(points) {
  const out = {}
  for (const group of chunk(points, 50)) {
    const key = `aqi:${new Date().toISOString().slice(0, 10)}:${group.map((p) => p.id).join('|')}`
    const data = await cached(key, DAY, async () => {
      const url = `https://air-quality-api.open-meteo.com/v1/air-quality?${coordParams(group)}&hourly=european_aqi&past_days=30&forecast_days=1`
      const res = asArray(await getJSON(url))
      return res.map((r, i) => ({ id: group[i].id, aqi: Math.round(mean(r.hourly.european_aqi)) }))
    })
    data.forEach((d) => (out[d.id] = d.aqi))
  }
  return out
}

const POLLUTANTS = ['pm2_5', 'pm10', 'nitrogen_dioxide', 'ozone', 'sulphur_dioxide']

export async function fetchAirDetail(lat, lon) {
  return cached(`aird:${lat.toFixed(2)},${lon.toFixed(2)}:${new Date().toISOString().slice(0, 13)}`, DAY / 4, async () => {
    const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&hourly=european_aqi,${POLLUTANTS.join(',')}&current=european_aqi,us_aqi,${POLLUTANTS.join(',')}&past_days=92&forecast_days=3&timezone=auto`
    const r = await getJSON(url)
    const byDay = {}
    r.hourly.time.forEach((t, i) => {
      const d = t.slice(0, 10)
      ;(byDay[d] ||= []).push(r.hourly.european_aqi[i])
    })
    return {
      current: r.current,
      daily: Object.entries(byDay).map(([date, v]) => ({ date, aqi: mean(v) == null ? null : Math.round(mean(v)) })),
      means: Object.fromEntries(POLLUTANTS.map((p) => [p, Math.round(mean(r.hourly[p]) * 10) / 10])),
    }
  })
}

// ---------- UV ----------

export async function fetchUv(lat, lon) {
  return cached(`uv:${lat.toFixed(2)},${lon.toFixed(2)}:${new Date().toISOString().slice(0, 10)}`, DAY / 2, async () => {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=uv_index_max&past_days=92&forecast_days=7&timezone=auto`
    const r = await getJSON(url)
    return r.daily.time.map((date, i) => ({ date, uv: r.daily.uv_index_max[i] }))
  })
}

// ---------- Earthquakes ----------

// USGS M5+ since 1980 inside a bbox, padded so subduction-zone events just offshore count.
export async function fetchQuakes([minX, minY, maxX, maxY], pad = 3) {
  const b = [minX - pad, Math.max(-90, minY - pad), maxX + pad, Math.min(90, maxY + pad)].map((v) => v.toFixed(1))
  return cached(`eq:${b.join(',')}`, 7 * DAY, async () => {
    const url = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=csv&starttime=1980-01-01&minmagnitude=5&minlongitude=${b[0]}&minlatitude=${b[1]}&maxlongitude=${b[2]}&maxlatitude=${b[3]}&orderby=time&limit=20000`
    const csv = await getJSON(url, 60000)
    const lines = csv.trim().split('\n')
    const head = lines.shift().split(',')
    const ix = (k) => head.indexOf(k)
    const [iT, iLa, iLo, iD, iM] = ['time', 'latitude', 'longitude', 'depth', 'mag'].map(ix)
    return lines.map((l) => {
      const c = l.split(',')
      return { time: c[iT].slice(0, 10), lat: +c[iLa], lon: +c[iLo], depth: +c[iD], mag: +c[iM] }
    })
  })
}

// ---------- Geocoding ----------

export async function geocode(query, language = 'es') {
  if (query.trim().length < 2) return []
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=8&language=${language}&format=json`
  const r = await getJSON(url, 10000)
  return (r.results || []).map((g) => ({
    id: `geo-${g.id}`,
    name: g.name,
    lat: g.latitude,
    lon: g.longitude,
    pop: g.population || null,
    admin1: g.admin1,
    countryCode: g.country_code,
    country: g.country,
  }))
}
