import { indicatorById } from '../data/metrics.js'

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 })

export function fmtNum(v, digits = 0) {
  if (v == null || Number.isNaN(v)) return '—'
  return v.toLocaleString('en', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

export function fmtIndicator(id, v, { unit = true } = {}) {
  if (v == null || Number.isNaN(v)) return '—'
  const ind = indicatorById[id]
  if (id === 'pop') return compact.format(v)
  const s = fmtNum(v, ind?.digits ?? 1)
  return unit && ind?.unit ? `${s}${ind.unit.startsWith('/') || ind.unit === '%' || ind.unit === '°C' ? '' : ' '}${ind.unit}` : s
}

export const fmtScore = (v) => (v == null ? '—' : Math.round(v).toString())

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\W+/g, '-').replace(/^-|-$/g, '').toLowerCase()

export const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
