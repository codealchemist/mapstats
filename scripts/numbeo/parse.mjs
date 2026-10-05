// Numbeo HTML parsers. Structure-tolerant: they look for label/number pairs and
// header names rather than exact markup, and understand both the English
// (www.numbeo.com) and Spanish (es.numbeo.com) pages.
import { load } from 'cheerio'
import { SURVEY } from '../../src/data/numbeoSurvey.js'

export const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase()

// "70,99" | "70.99" -> 70.99
export function parseNum(s) {
  if (s == null) return null
  const t = String(s).trim().replace(/\s/g, '')
  if (!/^-?[\d.,]+$/.test(t)) return null
  const n = Number(t.includes(',') && !t.includes('.') ? t.replace(',', '.') : t.replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}


const surveyKey = (label) => {
  const f = fold(label)
  return SURVEY.find(([, , pats]) => pats.some((p) => f.includes(p)))?.[0] || null
}

/** City crime page -> { crimeIndex, safetyIndex, survey, contributors, updated, name } or null if the page has no data. */
export function parseCityCrime(html) {
  const $ = load(html)
  const text = fold($('body').text())
  const idx = (re) => parseNum(text.match(re)?.[1])
  const crimeIndex = idx(/(?:indice de criminalidad|crime index)\s*:?\s*([\d.,]+)/)
  const safetyIndex = idx(/(?:indice de seguridad|safety index)\s*:?\s*([\d.,]+)/)

  const survey = {}
  $('tr').each((_, tr) => {
    const cells = $(tr).children('td').map((__, td) => $(td).text().trim()).get()
    if (cells.length < 2) return
    const key = surveyKey(cells[0])
    if (!key || survey[key] != null) return
    const value = cells.slice(1).map(parseNum).find((n) => n != null && n >= 0 && n <= 100)
    if (value != null) survey[key] = value
  })

  if (crimeIndex == null && !Object.keys(survey).length) return null
  return {
    name: $('h1').first().text().replace(/^(crime in|delincuencia en)\s+/i, '').replace(/,\s*argentina$/i, '').trim() || null,
    crimeIndex,
    safetyIndex,
    survey,
    contributors: idx(/(?:contributors|contribuyentes|colaboradores)\s*:?\s*([\d.,]+)/),
    inArgentina: text.includes('argentina'),
    updated: text.match(/(?:last update|ultima actualizacion)\s*:?\s*([a-z]+\s+\d{4})/)?.[1] || null,
  }
}

// Country ranking tables (quality-of-life / crime "country_result" pages).
const COLUMNS = [
  ['qualityOfLife', ['quality of life', 'calidad de vida']],
  ['purchasingPower', ['purchasing power', 'poder adquisitivo']],
  ['safetyIndex', ['safety index', 'indice de seguridad']],
  ['crimeIndex', ['crime index', 'indice de criminalidad']],
  ['healthcareIndex', ['health care', 'sanidad', 'salud']],
  ['climateIndex', ['climate', 'clima']],
  ['costOfLiving', ['cost of living', 'coste de vida', 'costo de vida']],
  ['propertyPriceToIncome', ['property price', 'precio de la vivienda', 'precio de las propiedades']],
  ['trafficIndex', ['traffic', 'trafico']],
  ['pollutionIndex', ['pollution', 'contaminacion']],
]
const columnKey = (h) => COLUMNS.find(([, pats]) => pats.some((p) => fold(h).includes(p)))?.[0] || null

/** Country table page -> [{ name, slug, ...indices }] */
export function parseCountryTable(html) {
  const $ = load(html)
  const out = []
  $('table').each((_, table) => {
    const headers = $(table).find('thead th, tr:first-child th').map((__, th) => $(th).text().trim()).get()
    const cityCol = headers.findIndex((h) => /^(city|ciudad)$/i.test(fold(h)))
    if (cityCol < 0) return
    const keys = headers.map((h, i) => (i === cityCol ? null : columnKey(h)))
    if (!keys.some(Boolean)) return
    $(table).find('tbody tr').each((__, tr) => {
      const tds = $(tr).children('td')
      if (tds.length < headers.length - 1) return
      // Some tables have a leading rank column without a header cell.
      const offset = tds.length - headers.length
      const cityTd = tds.eq(cityCol + offset)
      const href = cityTd.find('a').attr('href') || ''
      const row = { name: cityTd.text().trim().replace(/,\s*Argentina$/i, ''), slug: href.split('/').filter(Boolean).pop()?.split('?')[0] || null }
      keys.forEach((k, i) => { if (k) row[k] = parseNum(tds.eq(i + offset).text()) })
      if (row.name) out.push(row)
    })
  })
  return out
}

/** robots.txt -> function(path) => allowed, for User-agent: * */
export function robotsAllows(txt) {
  const rules = []
  let applies = false
  for (const raw of txt.split('\n')) {
    const line = raw.split('#')[0].trim()
    const [k, ...rest] = line.split(':')
    const v = rest.join(':').trim()
    if (/^user-agent$/i.test(k)) applies = v === '*'
    else if (applies && /^disallow$/i.test(k) && v) rules.push(v)
  }
  return (path) => !rules.some((r) => path.startsWith(r))
}
