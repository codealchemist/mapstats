import { useMemo, useState, useSyncExternalStore } from 'react'
import { Chart } from 'react-chartjs-2'
import { NARROW_QUERY, hoverMedia, mediaStore } from '../../lib/viewport.js'

// Phones and tablets: a chart answers taps only, so dragging the page across it never picks a point, and the values
// show in a line below the chart (with a thin reference line on it) instead of a tooltip covering it.
const compactMedia = mediaStore(`${NARROW_QUERY}, (pointer: coarse)`)

// A thin line through the active point: vertical, or horizontal on horizontal bar charts. Its colour comes from the
// options (charts/theme.js baseOptions); it is drawn only where it stands in for the tooltip.
const refLine = {
  id: 'refLine',
  afterDatasetsDraw(chart, _args, opts) {
    const el = chart.tooltip?.getActiveElements?.()[0]?.element
    if (!opts?.show || !el) return
    const { ctx, chartArea: a } = chart
    ctx.save()
    ctx.strokeStyle = opts.color
    ctx.lineWidth = 1
    ctx.beginPath()
    if (chart.options.indexAxis === 'y') { ctx.moveTo(a.left, el.y); ctx.lineTo(a.right, el.y) } else { ctx.moveTo(el.x, a.top); ctx.lineTo(el.x, a.bottom) }
    ctx.stroke()
    ctx.restore()
  },
}
const PLUGINS = [refLine]

/**
 * A Chart.js chart that adapts to the device. On compact screens: tap-only events, no tooltip, and the active point's
 * title and values in a line below the chart. `cfg`: { type, data, options }; `className`/`style` go on the chart's
 * box, `chartRef` on the chart.
 */
export function InteractiveChart({ cfg, className, style, chartRef }) {
  const compact = useSyncExternalStore(compactMedia.subscribe, compactMedia.get)
  const hover = useSyncExternalStore(hoverMedia.subscribe, hoverMedia.get)
  const [readout, setReadout] = useState(null)
  // A readout from before compact mode was last turned on would describe a point no longer active: start over.
  const [wasCompact, setWasCompact] = useState(compact)
  if (wasCompact !== compact) { setWasCompact(compact); setReadout(null) }

  const options = useMemo(() => {
    if (!compact) return cfg.options
    return {
      ...cfg.options,
      // Touch screens get clicks only: a tap fires one, a drag that scrolls the page doesn't.
      events: hover ? ['mousemove', 'mouseout', 'click'] : ['click'],
      plugins: {
        ...cfg.options.plugins,
        refLine: { ...cfg.options.plugins?.refLine, show: true },
        tooltip: {
          ...cfg.options.plugins?.tooltip,
          enabled: false,
          // Called on every chart update. Only a different readout re-renders: compared by content, not by the point's
          // index, so new data at the same index (another city's chart) still updates it.
          external: ({ tooltip }) => {
            const on = tooltip.opacity && tooltip.dataPoints?.length
            // Bars are drawn in their fill colour, lines in their stroke.
            const fill = tooltip.chart.config.type === 'bar' ? 'backgroundColor' : 'borderColor'
            const next = on ? { title: tooltip.title?.join(' ') || '', items: tooltip.body.map((b, i) => ({ text: b.lines.join(' '), color: tooltip.labelColors[i]?.[fill] })) } : null
            const key = next && JSON.stringify(next)
            setReadout((prev) => ((prev?.key ?? null) === key ? prev : next && { ...next, key }))
          },
        },
      },
    }
  }, [cfg.options, compact, hover])

  return (
    <>
      <div className={className} style={style}>
        <Chart ref={chartRef} type={cfg.type} data={cfg.data} options={options} plugins={PLUGINS} />
      </div>
      {compact && <ChartReadout readout={readout} hover={hover} />}
    </>
  )
}

/** The values of the tapped (or pointed at) point, under a compact chart; a hint until there is one. */
function ChartReadout({ readout, hover }) {
  return (
    <div className="chart-readout" aria-live="polite">
      {readout ? (
        <>
          {readout.title && <b>{readout.title}</b>}
          {readout.items.map((i, k) => (
            <span key={k}><i className="swatch" style={{ background: i.color }} />{i.text}</span>
          ))}
        </>
      ) : <span className="muted">{hover ? 'Point at' : 'Tap'} the chart to read its values</span>}
    </div>
  )
}
