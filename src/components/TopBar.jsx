import { useCallback, useRef, useState } from 'react'
import { Moon, Sun, Info, Camera, PanelLeft, ChevronDown, Columns3, Database, Ellipsis } from 'lucide-react'
import { SearchBox } from './SearchBox.jsx'
import { canvasToBlob, copyImage } from '../lib/export.js'
import { useToast } from './Toast.jsx'
import { useDismiss } from '../hooks/useDismiss.js'

export function Logo() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6da7ec" />
          <stop offset="1" stopColor="#184f95" />
        </linearGradient>
      </defs>
      <path d="M12 2.5c-4 0-7 3-7 6.9 0 4.9 5.6 10.6 6.4 11.4a.85.85 0 0 0 1.2 0c.8-.8 6.4-6.5 6.4-11.4 0-3.9-3-6.9-7-6.9Z" fill="url(#lg)" />
      <rect x="8.6" y="9.6" width="1.8" height="3.6" rx=".9" fill="#fff" />
      <rect x="11.1" y="7" width="1.8" height="6.2" rx=".9" fill="#fff" />
      <rect x="13.6" y="8.4" width="1.8" height="4.8" rx=".9" fill="#fff" />
    </svg>
  )
}

export function TopBar({ onHome, country, countries, onCountry, theme, onTheme, model, live, geo, onSelect, onInfo, onSources, onCompare, compareCount = 0, onTogglePanel, panelOpen, mapRef }) {
  const toast = useToast()
  const [snapping, setSnapping] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  useDismiss(menuRef, menuOpen, useCallback(() => setMenuOpen(false), []))

  const copyMap = async () => {
    const snap = mapRef.current?.snapshot()
    if (!snap) return
    setSnapping(true)
    try {
      await copyImage(canvasToBlob(snap.canvas, theme === 'dark' ? '#1a1a19' : '#fcfcfb'))
      toast('Map image copied to clipboard')
    } catch (e) {
      toast(e.message || 'Copy failed', 'error')
    } finally {
      setSnapping(false)
    }
  }

  // Icon buttons on wide screens, items of the "more" menu on phones.
  const actions = [
    { icon: Camera, title: 'Copy map image to clipboard', label: 'Copy map image', onClick: copyMap, disabled: snapping },
    { icon: theme === 'dark' ? Sun : Moon, title: theme === 'dark' ? 'Light mode' : 'Dark mode', onClick: onTheme },
    { icon: Database, title: 'Data sources', onClick: onSources },
    { icon: Info, title: 'Methodology & sources', label: 'How scores work', onClick: onInfo },
  ]
  const iconButtons = (list) => (
    <span className="wide-only">
      {list.map((a) => <button key={a.title} className="icon-btn" onClick={a.onClick} title={a.title} disabled={a.disabled}><a.icon size={17} /></button>)}
    </span>
  )

  return (
    <header className="topbar">
      <div className="brand glass">
        <button className={`icon-btn ${panelOpen ? 'active' : ''}`} onClick={onTogglePanel} title="Toggle side panel" aria-pressed={panelOpen}>
          <PanelLeft size={17} />
        </button>
        <button className="brand-home" onClick={onHome} title="Home view: reset filters and close data views">
          <Logo />
          <span className="brand-name">Map<span>Stats</span></span>
        </button>
      </div>

      <SearchBox model={model} country={country} live={live} geo={geo} onSelect={onSelect} />

      <div className="top-actions glass">
        <label className="country-select" title="Country">
          <select value={country.iso3} onChange={(e) => onCountry(e.target.value)} aria-label="Country">
            {countries.map((c) => <option key={c.iso3} value={c.iso3}>{c.name}</option>)}
          </select>
          <ChevronDown size={14} />
        </label>
        <span className="divider" />
        {iconButtons(actions.slice(0, 2))}
        <button className="icon-btn badge-host" onClick={onCompare} title="Compare places (up to 3)">
          <Columns3 size={17} />{compareCount > 0 && <span className="count-badge">{compareCount}</span>}
        </button>
        {iconButtons(actions.slice(2))}
        {/* Phones: the less frequent actions move into a menu so the bar fits on one row. */}
        <div className="more" ref={menuRef}>
          <button className={`icon-btn ${menuOpen ? 'active' : ''}`} onClick={() => setMenuOpen((o) => !o)} title="More" aria-haspopup="menu" aria-expanded={menuOpen}>
            <Ellipsis size={17} />
          </button>
          {menuOpen && (
            <div className="more-menu glass" role="menu" onClick={() => setMenuOpen(false)}>
              {actions.map((a) => <button key={a.title} role="menuitem" onClick={a.onClick} disabled={a.disabled}><a.icon size={16} /> {a.label || a.title}</button>)}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
