// Offline stand-ins for every external service the app calls, so the e2e tests are fast and deterministic: Open-Meteo
// (archive, historical forecast, forecast, air quality, flood, geocoding), USGS, the CARTO basemap style and tiles, and
// /api/news. Values are synthetic but shaped like the real responses: a seasonal temperature curve per latitude, a
// year of hourly air quality, and so on.

const DAY = 86_400_000
const iso = (t) => new Date(t).toISOString().slice(0, 10)
const days = (start, end) => {
  const out = []
  for (let t = Date.parse(start); t <= Date.parse(end); t += DAY) out.push(iso(t))
  return out
}
const hours = (dates) => dates.flatMap((d) => Array.from({ length: 24 }, (_, h) => `${d}T${String(h).padStart(2, '0')}:00`))

// Warmest in January south of the equator, in July north of it.
const season = (date, lat) => Math.cos(((+date.slice(5, 7) - (lat < 0 ? 1 : 7)) / 12) * 2 * Math.PI)
const tmax = (date, lat) => 22 + 8 * season(date, lat) - Math.abs(lat) / 6 + ((+date.slice(8, 10) * 7) % 5) - 2
const tmin = (date, lat) => tmax(date, lat) - 10

function coords(url) {
  const lats = url.searchParams.get('latitude').split(',').map(Number)
  const lons = url.searchParams.get('longitude').split(',').map(Number)
  return lats.map((lat, i) => ({ lat, lon: lons[i] }))
}
const many = (pts, row) => (pts.length === 1 ? row(pts[0]) : pts.map(row))

function range(url) {
  const start = url.searchParams.get('start_date'), end = url.searchParams.get('end_date')
  if (start && end) return days(start, end)
  const past = +(url.searchParams.get('past_days') || 0), ahead = +(url.searchParams.get('forecast_days') || 7)
  return days(iso(Date.now() - past * DAY), iso(Date.now() + (ahead - 1) * DAY))
}

function archive(url) {
  const dates = range(url)
  return many(coords(url), ({ lat }) => {
    if (url.searchParams.get('hourly')) {
      const time = hours(dates)
      return {
        elevation: 100, hourly: {
          time,
          temperature_2m: time.map((t) => tmin(t, lat) + 10 * Math.sin((+t.slice(11, 13) / 24) * Math.PI)),
          relative_humidity_2m: time.map(() => 60),
          wind_speed_10m: time.map(() => 12),
        },
      }
    }
    return {
      elevation: 100, daily: {
        time: dates,
        temperature_2m_max: dates.map((d) => tmax(d, lat)),
        temperature_2m_min: dates.map((d) => tmin(d, lat)),
        precipitation_sum: dates.map((d) => (+d.slice(8, 10) % 4 === 0 ? 12 : 0)),
        snowfall_sum: dates.map(() => 0),
        sunshine_duration: dates.map(() => 8 * 3600),
      },
    }
  })
}

const uvDaily = (url) => {
  const dates = range(url)
  return many(coords(url), ({ lat }) => ({ daily: { time: dates, uv_index_max: dates.map((d) => Math.max(1, 7 + 4 * season(d, lat))) } }))
}

function air(url) {
  const time = hours(range(url))
  const vars = (url.searchParams.get('hourly') || '').split(',')
  const value = (v) => ({ european_aqi: 30, us_aqi: 45, pm2_5: 9, pm10: 18, nitrogen_dioxide: 12, ozone: 60, sulphur_dioxide: 2 })[v] ?? 10
  const current = url.searchParams.get('current')
  return many(coords(url), () => ({
    hourly: { time, ...Object.fromEntries(vars.map((v) => [v, time.map((t, i) => value(v) + (i % 24) / 4)])) },
    ...(current && { current: Object.fromEntries(current.split(',').map((v) => [v, value(v)])) }),
  }))
}

const flood = (url) => {
  const dates = range(url)
  return many(coords(url), () => ({ daily: { time: dates, river_discharge: dates.map((_, i) => 40 + (i % 30)) } }))
}

const QUAKES = 'time,latitude,longitude,depth,mag\n2010-02-27T06:34:00Z,-36.1,-72.9,22.9,8.8\n2016-04-16T23:58:00Z,-31.6,-68.2,110,6.4\n'

const STYLE = {
  version: 8,
  glyphs: 'https://basemaps.cartocdn.com/fonts/{fontstack}/{range}.pbf',
  sources: {},
  layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#e9e8e3' } }],
}

const json = (body) => ({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) })

/**
 * Routes every external request to the fakes above. Returns `calls`: the Open-Meteo / USGS requests made, by host,
 * for tests that check which layers loaded. `calls.faults` makes an API fail until the entry is removed:
 * calls.faults.set('air-quality-api', { status: 429, reason: 'Hourly API request limit exceeded…' }).
 */
export async function mockServices(page) {
  const calls = []
  calls.faults = new Map()
  await page.route((url) => url.hostname !== 'localhost' && url.hostname !== '127.0.0.1', (route) => {
    const url = new URL(route.request().url())
    calls.push(url)
    const fault = [...calls.faults].find(([api]) => url.hostname.startsWith(`${api}.`))?.[1]
    if (fault) return route.fulfill({ ...json({ error: true, reason: fault.reason }), status: fault.status })
    switch (url.hostname) {
      case 'archive-api.open-meteo.com': return route.fulfill(json(archive(url)))
      case 'historical-forecast-api.open-meteo.com':
      case 'api.open-meteo.com': return route.fulfill(json(uvDaily(url)))
      case 'air-quality-api.open-meteo.com': return route.fulfill(json(air(url)))
      case 'flood-api.open-meteo.com': return route.fulfill(json(flood(url)))
      case 'geocoding-api.open-meteo.com': return route.fulfill(json({ results: [] }))
      case 'earthquake.usgs.gov': return route.fulfill({ status: 200, contentType: 'text/csv', headers: { 'access-control-allow-origin': '*' }, body: QUAKES })
      case 'basemaps.cartocdn.com': return url.pathname.endsWith('style.json') ? route.fulfill(json(STYLE)) : route.fulfill({ status: 404, body: '' })
      default: return route.fulfill({ status: 404, body: '' })
    }
  })
  await page.route('**/api/news**', (route) => route.fulfill(json({ items: [], sources: [] })))
  return calls
}

/** Requests to an Open-Meteo API, e.g. hits(calls, 'flood-api'). */
export const hits = (calls, api) => calls.filter((u) => u.hostname.startsWith(`${api}.`))
