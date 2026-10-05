import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement,
  Filler, Tooltip, Legend, BarController, LineController,
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Filler, Tooltip, Legend, BarController, LineController)

const FONT = 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif'

export const TOKENS = {
  light: {
    surface: '#fcfcfb', ink: '#0b0b0b', secondary: '#52514e', muted: '#898781', grid: '#e1e0d9', axis: '#c3c2b7',
    series: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100'], de: '#c3c2b7',
  },
  dark: {
    surface: '#1a1a19', ink: '#ffffff', secondary: '#c3c2b7', muted: '#898781', grid: '#2c2c2a', axis: '#383835',
    series: ['#3987e5', '#d95926', '#199e70', '#c98500'], de: '#4a4a46',
  },
}

export const alpha = (hex, a) => hex + Math.round(a * 255).toString(16).padStart(2, '0')

// Shared options: recessive hairline grid, muted ticks, legend only for 2+ series, index tooltips.
export function baseOptions(t, { legend = false, horizontal = false, yTitle, stacked = false, suggestedMax } = {}) {
  const valueAxis = {
    beginAtZero: true,
    suggestedMax,
    stacked,
    border: { display: false },
    grid: { color: t.grid, lineWidth: 1, drawTicks: false },
    ticks: { color: t.muted, font: { family: FONT, size: 11 }, padding: 6, maxTicksLimit: 6 },
    title: yTitle ? { display: true, text: yTitle, color: t.muted, font: { family: FONT, size: 11 } } : undefined,
  }
  const catAxis = {
    stacked,
    border: { color: t.axis },
    grid: { display: false },
    ticks: { color: t.secondary, font: { family: FONT, size: 11 }, autoSkipPadding: 12, maxRotation: 0 },
  }
  return {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: horizontal ? 'y' : 'x',
    animation: { duration: 400 },
    interaction: { mode: 'index', intersect: false, axis: horizontal ? 'y' : 'x' },
    layout: { padding: { top: 4, right: 8 } },
    scales: horizontal ? { x: valueAxis, y: catAxis } : { x: catAxis, y: valueAxis },
    plugins: {
      legend: {
        display: legend,
        position: 'top',
        align: 'start',
        labels: { color: t.secondary, font: { family: FONT, size: 11 }, boxWidth: 10, boxHeight: 10, useBorderRadius: true, borderRadius: 2, padding: 12 },
      },
      tooltip: {
        backgroundColor: t.surface === '#fcfcfb' ? '#ffffff' : '#262624',
        titleColor: t.ink, bodyColor: t.secondary, borderColor: t.grid, borderWidth: 1,
        padding: 10, cornerRadius: 8, boxPadding: 4, usePointStyle: true,
        titleFont: { family: FONT, size: 12, weight: '600' }, bodyFont: { family: FONT, size: 12 },
      },
    },
  }
}

export const barStyle = (color) => ({
  backgroundColor: color, borderWidth: 0, borderRadius: 4, borderSkipped: 'start', maxBarThickness: 24,
  categoryPercentage: 0.8, barPercentage: 0.9,
})

export const lineStyle = (color, { fill = false } = {}) => ({
  borderColor: color, backgroundColor: fill ? alpha(color, 0.1) : color, borderWidth: 2, fill,
  pointRadius: 0, pointHoverRadius: 5, pointHoverBorderWidth: 2, pointHoverBorderColor: '#fff', pointBackgroundColor: color,
  tension: 0.3, borderCapStyle: 'round', borderJoinStyle: 'round',
})
