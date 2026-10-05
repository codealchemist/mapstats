import { CATEGORIES, INDICATORS } from '../data/metrics.js'
import { sourceOf } from '../data/sources.js'
import { fmtIndicator, fmtScore, MONTHS, slug } from './format.js'
import { isOwnValue } from './scoring.js'

// ---------- Images & clipboard ----------

// Chart.js canvases are transparent; flatten onto the surface colour so pasted images aren't see-through.
export function canvasToBlob(canvas, background) {
  const out = document.createElement('canvas')
  out.width = canvas.width
  out.height = canvas.height
  const ctx = out.getContext('2d')
  ctx.fillStyle = background
  ctx.fillRect(0, 0, out.width, out.height)
  ctx.drawImage(canvas, 0, 0)
  return new Promise((resolve) => out.toBlob(resolve, 'image/png'))
}

export async function copyImage(blobPromise) {
  if (!navigator.clipboard || typeof ClipboardItem === 'undefined') throw new Error('Clipboard images are not supported in this browser')
  // Passing the promise keeps Safari's user-gesture requirement satisfied.
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blobPromise })])
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = Object.assign(document.createElement('a'), { href: url, download: filename })
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// ---------- CSV ----------

const esc = (v) => {
  if (v == null) return ''
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
const toCsv = (rows) => '﻿' + rows.map((r) => r.map(esc).join(',')).join('\n')
const round = (v, d = 2) => (v == null ? null : Math.round(v * 10 ** d) / 10 ** d)

export function rankingCsv(entities, regionLabel) {
  const head = ['type', 'rank', 'name', regionLabel, 'lat', 'lon', 'mapstats_score', 'data_coverage',
    ...CATEGORIES.map((c) => `score_${c.id}`), ...INDICATORS.map((i) => i.id)]
  const rows = entities.map((e) => [
    e.type, e.rank, e.name, e.type === 'city' ? e.provinceName : '', round(e.lat, 4), round(e.lon, 4),
    round(e.score, 1), round(e.coverage, 2), ...CATEGORIES.map((c) => round(e.categories[c.id], 1)),
    ...INDICATORS.map((i) => round(e.values[i.id], 3)),
  ])
  return new Blob([toCsv([head, ...rows])], { type: 'text/csv;charset=utf-8' })
}

export function reportCsv(entity, detail, sourceGroups = [], country) {
  // `scope` says whether a value was measured for this place or is its region's figure (used only for scoring).
  const rows = [['section', 'metric', 'value', 'unit', 'source', 'scope']]
  const own = entity.type === 'city' ? 'city' : 'region'
  const regionLabel = (country?.regionLabel || 'region').toLowerCase()
  rows.push(['score', 'MapStats score', round(entity.score, 1), '/100', 'MapStats', own])
  CATEGORIES.forEach((c) => rows.push(['score', c.label, round(entity.categories[c.id], 1), '/100', 'MapStats', own]))
  INDICATORS.forEach((i) => {
    const scope = isOwnValue(entity, i.id) ? own : entity.inherited?.has(i.id) ? `${entity.provinceName} (${regionLabel}, no city data)` : 'no data'
    rows.push(['indicator', i.label, round(entity.values[i.id], 3), i.unit, sourceOf(i.id, country?.iso3) || '', scope])
  })
  if (detail?.climate) {
    detail.climate.monthly.forEach((m, k) =>
      Object.entries(m).forEach(([key, v]) => rows.push([`climate ${detail.climate.period}`, `${MONTHS[k]} ${key}`, v, '', 'Open-Meteo ERA5', own])),
    )
  }
  if (detail?.air) Object.entries(detail.air.means).forEach(([k, v]) => rows.push(['air (92-day mean)', k, v, 'µg/m³', 'Open-Meteo CAMS', own]))
  // Exact values per source, with the area and period each one describes.
  for (const g of sourceGroups) {
    const scope = [g.level, g.area, g.period].filter(Boolean).join(' · ')
    for (const r of g.rows) rows.push([`source: ${g.name}`, r.label, r.value, r.unit, r.source || g.name, scope])
  }
  return new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' })
}

// ---------- PDF ----------

const fmtExactPdf = (v) => (v == null ? '—' : Number.isInteger(v) ? v.toLocaleString('en') : String(+v.toFixed(4)))

// jsPDF is loaded on demand to keep it out of the initial bundle.
const loadPdf = () => Promise.all([import('jspdf'), import('jspdf-autotable')]).then(([a, b]) => ({ jsPDF: a.jsPDF, autoTable: b.autoTable }))

const INK = [11, 11, 11]
const MUTED = [110, 108, 102]
const ACCENT = [42, 120, 214]

function header(doc, title, subtitle) {
  doc.setFont('helvetica', 'bold').setFontSize(18).setTextColor(...INK).text(title, 40, 52)
  doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(...MUTED).text(subtitle, 40, 70)
  doc.setDrawColor(225, 224, 217).line(40, 82, doc.internal.pageSize.getWidth() - 40, 82)
}

function footer(doc) {
  const n = doc.getNumberOfPages()
  for (let i = 1; i <= n; i++) {
    doc.setPage(i)
    doc.setFontSize(8).setTextColor(...MUTED)
    doc.text(`MapStats · generated ${new Date().toLocaleString()} · page ${i}/${n}`, 40, doc.internal.pageSize.getHeight() - 24)
  }
}

const tableStyle = {
  theme: 'plain',
  styles: { fontSize: 9, cellPadding: 4, textColor: INK },
  headStyles: { textColor: MUTED, fontStyle: 'bold', lineWidth: { bottom: 0.5 }, lineColor: [195, 194, 183] },
  alternateRowStyles: { fillColor: [247, 246, 243] },
  margin: { left: 40, right: 40 },
}

// charts: [{ title, dataUrl, width, height }]
export async function reportPdf({ entity, national, charts, country, sourceGroups = [] }) {
  const { jsPDF, autoTable } = await loadPdf()
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const where = [entity.type === 'city' ? entity.provinceName : null, country.name].filter(Boolean).join(', ')
  header(doc, entity.name, `${entity.type === 'city' ? 'City' : 'Region'} report · ${where}`)

  doc.setFont('helvetica', 'bold').setFontSize(40).setTextColor(...ACCENT).text(fmtScore(entity.score), 40, 130)
  doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(...MUTED)
  doc.text(`MapStats score /100${entity.rank ? ` · rank ${entity.rank} of ${entity.rankOf}` : ''} · country average ${fmtScore(national?.score)}`, 40, 148)
  doc.text(`Data coverage ${Math.round((entity.coverage || 0) * 100)}%`, 40, 162)

  autoTable(doc, {
    ...tableStyle,
    startY: 180,
    head: [['Category', 'Score', 'Country avg.']],
    body: CATEGORIES.map((c) => [c.label, fmtScore(entity.categories[c.id]), fmtScore(national?.categories[c.id])]),
  })
  autoTable(doc, {
    ...tableStyle,
    startY: doc.lastAutoTable.finalY + 16,
    head: [['Indicator', 'Value', 'Country avg.', 'Source']],
    body: INDICATORS.filter((i) => isOwnValue(entity, i.id)).map((i) => [
      i.label, fmtIndicator(i.id, entity.values[i.id]), fmtIndicator(i.id, national?.values[i.id]), sourceOf(i.id, country.iso3) || '',
    ]),
  })

  const missing = entity.type === 'city' ? INDICATORS.filter((i) => i.better && !isOwnValue(entity, i.id)) : []
  if (missing.length) {
    const text = doc.splitTextToSize(
      `No city-level stats for ${entity.name}: ${missing.map((i) => i.label).join(', ')}. ` +
      `The score uses ${country.regionLabel.toLowerCase()}-level figures${entity.provinceName ? ` (${entity.provinceName})` : ''} where available.`,
      W - 80,
    )
    doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(...MUTED).text(text, 40, doc.lastAutoTable.finalY + 16)
    doc.lastAutoTable.finalY += 16 + text.length * 11
  }

  const bySource = sourceGroups.filter((g) => g.rows.length)
  if (bySource.length) {
    autoTable(doc, {
      ...tableStyle,
      startY: doc.lastAutoTable.finalY + 16,
      head: [['Source · area · period', 'Value', '', 'Unit']],
      body: bySource.flatMap((g) => [
        [{ content: [g.name, g.level, g.area, g.period].filter(Boolean).join(' · '), colSpan: 4, styles: { fontStyle: 'bold', fillColor: [238, 237, 232] } }],
        ...g.rows.map((r) => [r.label + (r.source ? ` (${r.source})` : ''), fmtExactPdf(r.value), '', r.unit]),
      ]),
      columnStyles: { 1: { halign: 'right' } },
    })
  }

  let y = doc.lastAutoTable.finalY + 24
  const H = doc.internal.pageSize.getHeight()
  for (const c of charts) {
    const w = W - 80
    const h = (c.height / c.width) * w
    if (y + h + 30 > H - 40) { doc.addPage(); y = 50 }
    doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(...INK).text(c.title, 40, y)
    doc.addImage(c.dataUrl, 'PNG', 40, y + 8, w, h, undefined, 'FAST')
    y += h + 34
  }
  footer(doc)
  doc.save(`mapstats-${slug(entity.name)}.pdf`)
}

export async function rankingPdf({ entities, countryName, regionLabel, mapImage, kind }) {
  const { jsPDF, autoTable } = await loadPdf()
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  header(doc, `MapStats ranking · ${countryName}`, `${kind === 'city' ? 'Cities' : regionLabel + 's'} ranked by the MapStats livability score`)
  let y = 96
  if (mapImage) {
    const w = W - 80
    const h = (mapImage.height / mapImage.width) * w
    doc.addImage(mapImage.dataUrl, 'JPEG', 40, y, w, Math.min(h, 360), undefined, 'FAST')
    y += Math.min(h, 360) + 16
  }
  autoTable(doc, {
    ...tableStyle,
    startY: y,
    head: [['#', 'Name', ...(kind === 'city' ? [regionLabel] : []), 'Score', ...CATEGORIES.map((c) => c.label)]],
    body: entities.map((e) => [
      e.rank ?? '—', e.name, ...(kind === 'city' ? [e.provinceName] : []), fmtScore(e.score),
      ...CATEGORIES.map((c) => fmtScore(e.categories[c.id])),
    ]),
    styles: { ...tableStyle.styles, fontSize: 8 },
  })
  footer(doc)
  doc.save(`mapstats-ranking-${slug(countryName)}-${kind}.pdf`)
}
