// Map color scales. Sequential = one hue light→dark; diverging = two hues around
// a neutral gray (the country average), never a rainbow.
import { indicatorById } from '../data/metrics.js'

export const BLUE = ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95', '#0d366b']
export const RED = ['#fde4df', '#f9c2b8', '#f29a8b', '#e8705f', '#d44a3d', '#ad332b', '#7f2420']
export const ORANGE = ['#fdebd3', '#fbd2a2', '#f6b26b', '#ee8f3c', '#d9701f', '#b05615', '#7f3d0f']
export const VIOLET = ['#e6e3f8', '#c9c3f0', '#a99ee6', '#8a7bd9', '#6c5bc5', '#4a3aa7', '#2f2470']

// Named single-hue ramps for descriptive metrics (metrics.js `ramp`); '-rev' puts the dark end at low values.
export const RAMPS = { blue: BLUE, red: RED, orange: ORANGE, violet: VIOLET }
export function rampFor(name) {
  const [base, rev] = name.split('-')
  const r = RAMPS[base] || BLUE
  return rev === 'rev' ? [...r].reverse() : r
}
const DIV_LOW = ['#ad332b', '#d44a3d', '#e8705f', '#f29a8b']
const DIV_HIGH = ['#86b6ef', '#3987e5', '#256abf', '#184f95']
const MID = { light: '#e6e4de', dark: '#4a4a46' }

export const NO_DATA = { light: '#d9d7d0', dark: '#3a3a37' }

// Returns { kind, stops: [[value, color]...], domain, mid?, lowLabel, highLabel }
export function scaleFor(metric, values, theme) {
  const v = values.filter((x) => x != null && Number.isFinite(x))
  if (!v.length) return null
  let lo = Math.min(...v), hi = Math.max(...v)
  if (lo === hi) { lo -= 1; hi += 1 }

  if (metric.kind === 'score') {
    const mid = v.reduce((s, x) => s + x, 0) / v.length
    const arm = (colors, from, to) => colors.map((c, i) => [from + ((to - from) * (i + 0.5)) / colors.length, c])
    const lowArm = arm(DIV_LOW, lo, mid)
    const highArm = arm(DIV_HIGH, mid, hi)
    return {
      kind: 'diverging', domain: [lo, hi], mid,
      stops: [[lo, DIV_LOW[0]], ...lowArm.slice(1), [mid, MID[theme]], ...highArm.slice(0, -1), [hi, DIV_HIGH.at(-1)]],
      legend: [...DIV_LOW, MID[theme], ...DIV_HIGH],
      lowLabel: 'Below average', highLabel: 'Above average',
    }
  }
  const ind = indicatorById[metric.id]
  const ramp = ind.ramp ? rampFor(ind.ramp) : ind.better === 'low' ? RED : BLUE
  const stops = ramp.map((c, i) => [lo + ((hi - lo) * i) / (ramp.length - 1), c])
  return {
    kind: 'sequential', domain: [lo, hi], stops, legend: ramp,
    lowLabel: ind.better === 'low' ? 'Better' : ind.better === 'high' ? 'Worse' : 'Lower',
    highLabel: ind.better === 'low' ? 'Worse' : ind.better === 'high' ? 'Better' : 'Higher',
  }
}

export function colorAt(scale, value, theme) {
  if (!scale || value == null) return NO_DATA[theme]
  const s = scale.stops
  if (value <= s[0][0]) return s[0][1]
  for (let i = 1; i < s.length; i++) if (value <= s[i][0]) return mix(s[i - 1][1], s[i][1], (value - s[i - 1][0]) / (s[i][0] - s[i - 1][0]))
  return s.at(-1)[1]
}

function mix(a, b, t) {
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
  const [x, y] = [p(a), p(b)]
  return '#' + x.map((c, i) => Math.round(c + (y[i] - c) * t).toString(16).padStart(2, '0')).join('')
}

// Score badge tone: blue above the country average, red below, gray around it.
export function scoreTone(score, avg) {
  if (score == null || avg == null) return 'neutral'
  if (score >= avg + 3) return 'good'
  if (score <= avg - 3) return 'bad'
  return 'neutral'
}
