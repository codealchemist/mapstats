import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Chart } from 'react-chartjs-2'
import { Chart as ChartJS } from 'chart.js'
import { Copy, Download, Check, Table2 } from 'lucide-react'
import { TOKENS } from './theme.js'
import { canvasToBlob, copyImage, downloadBlob } from '../../lib/export.js'
import { slug } from '../../lib/format.js'
import { useToast } from '../Toast.jsx'

// Registry so the PDF exporter can re-render every visible chart off-screen in the light theme.
const RegistryContext = createContext(null)

export function ChartRegistry({ children, registryRef }) {
  const value = useMemo(() => {
    const map = new Map()
    registryRef.current = map
    return map
  }, [registryRef])
  return <RegistryContext.Provider value={value}>{children}</RegistryContext.Provider>
}

// Renders a chart config at fixed size on a detached canvas (used by PDF export).
export function renderOffscreen(build, width = 900, height = 380) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const cfg = build(TOKENS.light)
  const chart = new ChartJS(canvas, {
    ...cfg,
    options: { ...cfg.options, responsive: false, animation: false, devicePixelRatio: 2 },
  })
  const out = document.createElement('canvas')
  out.width = canvas.width
  out.height = canvas.height
  const ctx = out.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, out.width, out.height)
  ctx.drawImage(canvas, 0, 0)
  chart.destroy()
  return { dataUrl: out.toDataURL('image/png'), width: out.width, height: out.height }
}

/**
 * build(tokens) -> { type, data, options }. `table` = { columns, rows } for the accessible table view.
 * height: pixels, or 'fill' to take the remaining height of a flex-column parent.
 */
export function ChartCard({ id, title, subtitle, theme, build, height = 200, table, footnote }) {
  const ref = useRef(null)
  const registry = useContext(RegistryContext)
  const toast = useToast()
  const [copied, setCopied] = useState(false)
  const [showTable, setShowTable] = useState(false)
  const t = TOKENS[theme]
  const cfg = useMemo(() => build(t), [build, t])

  useEffect(() => {
    if (!registry) return
    registry.set(id, { title, build })
    return () => registry.delete(id)
  }, [registry, id, title, build])

  const blob = () => canvasToBlob(ref.current.canvas, t.surface)

  const onCopy = async () => {
    try {
      await copyImage(blob())
      setCopied(true)
      toast('Chart copied to clipboard')
      setTimeout(() => setCopied(false), 1500)
    } catch (e) {
      toast(e.message || 'Copy failed', 'error')
    }
  }

  return (
    <figure className={`chart-card ${height === 'fill' ? 'fill' : ''}`}>
      <figcaption className="chart-head">
        <div>
          <div className="chart-title">{title}</div>
          {subtitle && <div className="chart-sub">{subtitle}</div>}
        </div>
        <div className="chart-actions">
          {table && (
            <button className={`icon-btn sm ${showTable ? 'active' : ''}`} title="Show data table" onClick={() => setShowTable((s) => !s)}>
              <Table2 size={14} />
            </button>
          )}
          <button className="icon-btn sm" title="Copy image to clipboard" onClick={onCopy}>
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
          <button className="icon-btn sm" title="Download PNG" onClick={async () => downloadBlob(await blob(), `${slug(title)}.png`)}>
            <Download size={14} />
          </button>
        </div>
      </figcaption>
      <div className="chart-body" style={height === 'fill' ? undefined : { height }}>
        <Chart ref={ref} type={cfg.type} data={cfg.data} options={cfg.options} />
      </div>
      {showTable && table && (
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr>{table.columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
            <tbody>{table.rows.map((r, i) => <tr key={i}>{r.map((v, j) => <td key={j}>{v ?? '—'}</td>)}</tr>)}</tbody>
          </table>
        </div>
      )}
      {footnote && <div className="chart-foot">{footnote}</div>}
    </figure>
  )
}
