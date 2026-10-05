import { useCallback, useMemo, useRef, useState } from 'react'
import {
  X, FileText, FileSpreadsheet, ExternalLink, MapPin, Building2, Users, Mountain, Thermometer, CloudRain,
  Wind, Sun, LoaderCircle, ShieldAlert, Database, Columns3, CircleAlert, Activity, ChevronRight, Smile, Meh, Frown, Info,
} from 'lucide-react'
import { CATEGORIES, INDICATORS, indicatorById } from '../data/metrics.js'
import { ICONS } from './icons.js'
import { ChartCard, ChartRegistry, renderOffscreen } from './charts/ChartCard.jsx'
import { baseOptions, barStyle, lineStyle } from './charts/theme.js'
import { useEntityDetail } from '../hooks/useEntityDetail.js'
import { fmtIndicator, fmtNum, fmtScore, MONTHS } from '../lib/format.js'
import { normalise, isOwnValue } from '../lib/scoring.js'
import { haversineKm } from '../lib/geo.js'
import { downloadBlob, reportCsv, reportPdf } from '../lib/export.js'
import { slug } from '../lib/format.js'
import { scoreTone } from '../lib/colors.js'
import { useToast } from './Toast.jsx'
import { SURVEY, SURVEY_SAFER_HIGH } from '../data/numbeoSurvey.js'
import { valuesBySource, fmtExact } from '../lib/provenance.js'
import { familyById, SOURCE_FAMILIES, isMultiSource } from '../data/sources.js'
import { agreementOf } from '../lib/sourceWeights.js'
import { floodLevel } from './mapLayers.js'
import { NewsSection } from './NewsSection.jsx'
import { SourceButtons } from './SourceButtons.jsx'
import { sourcesForIndicators } from '../data/sources.js'

const EAQI = [
  [20, 'Good', 'good'], [40, 'Fair', 'good'], [60, 'Moderate', 'warning'],
  [80, 'Poor', 'serious'], [100, 'Very poor', 'critical'], [Infinity, 'Extremely poor', 'critical'],
]
const UV = [[3, 'Low', 'good'], [6, 'Moderate', 'warning'], [8, 'High', 'serious'], [11, 'Very high', 'critical'], [Infinity, 'Extreme', 'critical']]
const level = (table, v) => (v == null ? null : table.find(([max]) => v < max))
const STATUS_ICON = { good: Smile, warning: Meh, serious: Frown, critical: CircleAlert }

const SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'sources', label: 'Sources' },
  { id: 'safety', label: 'Safety' },
  { id: 'news', label: 'News' },
  { id: 'climate', label: 'Climate' },
  { id: 'air', label: 'Air & UV' },
  { id: 'risks', label: 'Risks' },
  { id: 'indicators', label: 'Indicators' },
]

export function ReportPanel({ entity, model, country, live, theme, onClose, onSelect, sourceMode = 'combined', onCompare, compareState = 'open' }) {
  const registryRef = useRef(null)
  const scrollRef = useRef(null)
  const toast = useToast()
  const [exporting, setExporting] = useState(false)
  const detail = useEntityDetail(entity.lat, entity.lon)
  const national = model.national
  const isCity = entity.type === 'city'

  // ---------- derived data ----------
  const quakes = useMemo(() => {
    if (!live.quakes) return null
    const near = live.quakes.filter((q) => Math.abs(q.lat - entity.lat) < 2.5 && haversineKm(entity.lat, entity.lon, q.lat, q.lon) <= 200)
    const start = 1980, end = new Date().getFullYear()
    const bins = []
    for (let y = start; y <= end; y += 5) bins.push({ label: `${y}–${String(Math.min(y + 4, end)).slice(2)}`, n: 0 })
    near.forEach((q) => { const b = bins[Math.floor((+q.time.slice(0, 4) - start) / 5)]; if (b) b.n++ })
    const strongest = near.reduce((m, q) => (!m || q.mag > m.mag ? q : m), null)
    return { near, bins, strongest }
  }, [live.quakes, entity.lat, entity.lon])

  const provinceCities = useMemo(
    () => (isCity ? [] : model.cities.filter((c) => c.province === entity.id && c.score != null).sort((a, b) => b.score - a.score)),
    [isCity, model.cities, entity.id],
  )

  // ---------- chart builders (stable per data so the PDF registry stays in sync) ----------
  const cats = CATEGORIES.map((c) => c.label)
  const buildCategories = useCallback((t) => ({
    type: 'bar',
    data: {
      labels: cats,
      datasets: [
        { label: entity.name, data: CATEGORIES.map((c) => round1(entity.categories[c.id])), ...barStyle(t.series[0]) },
        { label: 'Country average', data: CATEGORIES.map((c) => round1(national.categories[c.id])), ...barStyle(t.de) },
      ],
    },
    options: baseOptions(t, { legend: true, horizontal: true, suggestedMax: 100 }),
  }), [entity, national]) // eslint-disable-line react-hooks/exhaustive-deps

  const clim = detail.climate
  const buildTemp = useCallback((t) => ({
    type: 'line',
    data: {
      labels: MONTHS,
      datasets: [
        { label: 'Avg. max °C', data: clim.monthly.map((m) => m.tmax), ...lineStyle(t.series[1]) },
        { label: 'Avg. min °C', data: clim.monthly.map((m) => m.tmin), ...lineStyle(t.series[0]) },
      ],
    },
    options: { ...baseOptions(t, { legend: true }), scales: { ...baseOptions(t).scales, y: { ...baseOptions(t).scales.y, beginAtZero: false } } },
  }), [clim])
  const monthlyBar = (key, color, yTitle) => (t) => ({
    type: 'bar',
    data: { labels: MONTHS, datasets: [{ label: yTitle, data: clim.monthly.map((m) => m[key]), ...barStyle(t.series[color]) }] },
    options: baseOptions(t, { yTitle }),
  })
  const buildPrecip = useCallback(monthlyBar('precip', 0, 'mm'), [clim]) // eslint-disable-line react-hooks/exhaustive-deps
  const buildWet = useCallback(monthlyBar('wetDays', 0, 'days ≥ 1 mm'), [clim]) // eslint-disable-line react-hooks/exhaustive-deps
  const buildSnow = useCallback(monthlyBar('snow', 2, 'cm'), [clim]) // eslint-disable-line react-hooks/exhaustive-deps
  const buildSun = useCallback(monthlyBar('sunHours', 3, 'hours / day'), [clim]) // eslint-disable-line react-hooks/exhaustive-deps
  const buildComfort = useCallback((t) => ({
    ...monthlyBar('comfort', 0, 'comfort 0–100')(t),
    options: baseOptions(t, { yTitle: 'comfort 0–100', suggestedMax: 100 }),
  }), [clim]) // eslint-disable-line react-hooks/exhaustive-deps
  const buildYearly = useCallback((t) => ({
    type: 'line',
    data: { labels: clim.yearly.map((y) => y.year), datasets: [{ label: 'Mean °C', data: clim.yearly.map((y) => y.meanTemp), ...lineStyle(t.series[1], { fill: true }), pointRadius: 3 }] },
    options: { ...baseOptions(t), scales: { ...baseOptions(t).scales, y: { ...baseOptions(t).scales.y, beginAtZero: false } } },
  }), [clim])

  const air = detail.air
  const buildAqi = useCallback((t) => ({
    type: 'line',
    data: { labels: air.daily.map((d) => d.date.slice(5)), datasets: [{ label: 'European AQI', data: air.daily.map((d) => d.aqi), ...lineStyle(t.series[0], { fill: true }) }] },
    options: baseOptions(t, { yTitle: 'EAQI (lower is better)' }),
  }), [air])
  const buildPollutants = useCallback((t) => ({
    type: 'bar',
    data: {
      labels: ['PM2.5', 'PM10', 'NO₂', 'O₃', 'SO₂'],
      datasets: [{ label: 'µg/m³', data: ['pm2_5', 'pm10', 'nitrogen_dioxide', 'ozone', 'sulphur_dioxide'].map((k) => air.means[k]), ...barStyle(t.series[0]) }],
    },
    options: baseOptions(t, { horizontal: true }),
  }), [air])
  const uv = detail.uv
  const buildUv = useCallback((t) => ({
    type: 'line',
    data: { labels: uv.map((d) => d.date.slice(5)), datasets: [{ label: 'Max UV index', data: uv.map((d) => d.uv), ...lineStyle(t.series[3], { fill: true }) }] },
    options: baseOptions(t, { yTitle: 'UV index' }),
  }), [uv])

  const buildQuakes = useCallback((t) => ({
    type: 'bar',
    data: { labels: quakes.bins.map((b) => b.label), datasets: [{ label: 'Earthquakes M5+', data: quakes.bins.map((b) => b.n), ...barStyle(t.series[1]) }] },
    options: baseOptions(t, { yTitle: 'events' }),
  }), [quakes])

  const buildCities = useCallback((t) => ({
    type: 'bar',
    data: { labels: provinceCities.map((c) => c.name), datasets: [{ label: 'MapStats score', data: provinceCities.map((c) => round1(c.score)), ...barStyle(t.series[0]) }] },
    options: baseOptions(t, { horizontal: true, suggestedMax: 100 }),
  }), [provinceCities])

  const survey = entity.numbeo?.survey
  const surveyRows = useMemo(() => (survey ? SURVEY.filter(([k]) => survey[k] != null && !SURVEY_SAFER_HIGH.has(k)) : []), [survey])
  const safetyRows = useMemo(() => (survey ? SURVEY.filter(([k]) => survey[k] != null && SURVEY_SAFER_HIGH.has(k)) : []), [survey])
  const surveyBar = (rows, color) => (t) => ({
    type: 'bar',
    data: { labels: rows.map(([, label]) => label), datasets: [{ label: 'Survey score (0–100)', data: rows.map(([k]) => survey[k]), ...barStyle(t.series[color]) }] },
    options: baseOptions(t, { horizontal: true, suggestedMax: 100 }),
  })
  const buildSurvey = useCallback(surveyBar(surveyRows, 1), [surveyRows]) // eslint-disable-line react-hooks/exhaustive-deps
  const buildWalking = useCallback(surveyBar(safetyRows, 0), [safetyRows]) // eslint-disable-line react-hooks/exhaustive-deps

  // Official SNIC series: this place vs its province vs the country (cities sit in a SNIC department).
  const snic = entity.snic
  const snicProv = isCity ? model.provinces.find((p) => p.id === entity.province)?.snic : null
  const snicNat = national.snic
  const snicYears = snicNat?.years || []
  const snicLabel = !snic ? '' : snic.level === 'department' ? `${snic.name} department` : snic.level === 'city' ? snic.name : entity.name
  const buildSnicTrend = (metric) => (t) => ({
    type: 'line',
    data: {
      labels: snicYears,
      datasets: [
        { label: snicLabel, data: snic.series[metric], ...lineStyle(t.series[0]), pointRadius: 2.5 },
        ...(snicProv ? [{ label: snicProv.name, data: snicProv.series[metric], ...lineStyle(t.series[1]), pointRadius: 0 }] : []),
        { label: 'Argentina', data: snicNat.series[metric], ...lineStyle(t.de), borderDash: [], pointRadius: 0 },
      ],
    },
    options: baseOptions(t, { legend: true, yTitle: 'per 100,000' }),
  })
  const buildHomicideTrend = useCallback(buildSnicTrend('homicide'), [snic, snicProv, snicNat]) // eslint-disable-line react-hooks/exhaustive-deps
  const buildPropertyTrend = useCallback(buildSnicTrend('propertyCrime'), [snic, snicProv, snicNat]) // eslint-disable-line react-hooks/exhaustive-deps

  const sourceGroups = useMemo(() => valuesBySource({ entity, model, detail, quakes, live }), [entity, model, detail, quakes, live])

  // ---------- exports ----------
  const exportPdf = async () => {
    setExporting(true)
    try {
      await new Promise((r) => setTimeout(r, 30))
      const charts = [...(registryRef.current?.values() || [])].map(({ title, build }) => ({ title, ...renderOffscreen(build) }))
      await reportPdf({ entity, national, charts, countryName: country.name, sourceGroups })
      toast('PDF report downloaded')
    } catch (e) {
      console.error(e)
      toast('PDF export failed', 'error')
    } finally {
      setExporting(false)
    }
  }
  const exportCsv = () => {
    downloadBlob(reportCsv(entity, detail, sourceGroups), `mapstats-${slug(entity.name)}.csv`)
    toast('CSV downloaded')
  }

  const jump = (id) => scrollRef.current?.querySelector(`#sec-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  const tone = scoreTone(entity.score, national.score)
  const delta = entity.score != null && national.score != null ? entity.score - national.score : null
  const aqiNow = air?.current?.european_aqi
  const aqiLvl = level(EAQI, aqiNow)
  const today = new Date().toISOString().slice(0, 10)
  const uvToday = uv?.find((d) => d.date === today)?.uv
  const uvLvl = level(UV, uvToday)
  const elevation = entity.values.elevation ?? clim?.elevation

  return (
    <aside className="report glass" aria-label={`${entity.name} report`}>
      <header className="report-head">
        <div className="report-title">
          <span className="chip">{isCity ? <MapPin size={12} /> : <Building2 size={12} />}{isCity ? 'City' : country.regionLabel}</span>
          <h2>{entity.name}</h2>
          <div className="muted">
            {isCity ? (
              entity.province && !entity.adHoc ? (
                <button className="link" onClick={() => onSelect({ type: 'province', id: entity.province }, { fly: true })}>{entity.provinceName}</button>
              ) : entity.provinceName
            ) : `${entity.cityCount} cities tracked`}
            {' · '}{country.name}
          </div>
        </div>
        <div className="report-actions">
          <button className="icon-btn" onClick={exportPdf} title="Download PDF report" disabled={exporting}>
            {exporting ? <LoaderCircle size={16} className="spin" /> : <FileText size={16} />}
          </button>
          <button className="icon-btn" onClick={exportCsv} title="Download CSV"><FileSpreadsheet size={16} /></button>
          {onCompare && (
            <button className="icon-btn" onClick={onCompare} disabled={compareState === 'full'}
              title={compareState === 'added' ? 'Already in comparison — open it' : compareState === 'full' ? 'Comparison is full (3 places): remove one first' : 'Add to comparison'}>
              <Columns3 size={16} />
            </button>
          )}
          <button className="icon-btn" onClick={onClose} title="Close"><X size={18} /></button>
        </div>
      </header>
      <nav className="report-nav">
        {SECTIONS.map((s) => <button key={s.id} onClick={() => jump(s.id)}>{s.label}</button>)}
      </nav>

      <div className="report-scroll" ref={scrollRef}>
        <ChartRegistry registryRef={registryRef}>
          {/* ---------- Overview ---------- */}
          <section id="sec-overview" className="report-section">
            <div className="hero">
              <div>
                <div className="eyebrow">MapStats score · {familyById[sourceMode].short}</div>
                <div className="hero-num">{fmtScore(entity.score)}<small>/100</small></div>
                <div className="hero-meta">
                  {entity.rank && <span>Rank <b>#{entity.rank}</b> of {entity.rankOf} {isCity ? 'cities' : `${country.regionLabel.toLowerCase()}s`}</span>}
                  {delta != null && <span className={`delta ${tone}`}>{delta >= 0 ? '+' : '−'}{Math.abs(delta).toFixed(1)} vs country avg.</span>}
                </div>
              </div>
              <Coverage value={entity.coverage} />
            </div>
            {isCity && entity.inherited?.size > 0 && (
              <p className="note">
                <Info size={13} /> Scores use province-level figures{entity.provinceName ? ` (${entity.provinceName})` : ''} where {entity.name} has no city-level data.
                These are listed as missing in each category below, not shown as city values.
              </p>
            )}
            {entity.adHoc && (
              <p className="note"><Info size={13} /> Not in the curated city list — scored with live data{entity.province ? ' and its region baseline' : ''} only.</p>
            )}

            <div className="tiles">
              <Tile icon={Users} label="Population" value={fmtIndicator('pop', entity.values.pop)} />
              <Tile icon={Mountain} label="Elevation" value={elevation != null ? `${fmtNum(elevation)} m` : '—'} />
              <Tile icon={Thermometer} label="Mean temp." value={fmtIndicator('meanTemp', clim?.meanTemp ?? entity.values.meanTemp)} />
              <Tile icon={CloudRain} label="Rain / year" value={fmtIndicator('annualPrecip', clim?.annualPrecip ?? entity.values.annualPrecip)} />
              <Tile icon={Wind} label="Air now (EAQI)" value={aqiNow != null ? fmtNum(aqiNow) : '—'} status={aqiLvl} />
              <Tile icon={Sun} label="UV today" value={uvToday != null ? fmtNum(uvToday, 1) : '—'} status={uvLvl} />
            </div>

            <ChartCard id="categories" title="Score by category" subtitle="0–100, higher is better" theme={theme} build={buildCategories} height={230}
              table={{ columns: ['Category', entity.name, 'Country avg.'], rows: CATEGORIES.map((c) => [c.label, fmtScore(entity.categories[c.id]), fmtScore(national.categories[c.id])]) }} />

            <ScoreBySource entity={entity} mode={sourceMode} />

            {!isCity && provinceCities.length > 0 && (
              <ChartCard id="cities" title={`Cities in ${entity.name}`} subtitle="MapStats score" theme={theme} build={buildCities}
                height={Math.max(120, provinceCities.length * 30 + 30)}
                table={{ columns: ['City', 'Score'], rows: provinceCities.map((c) => [c.name, fmtScore(c.score)]) }} />
            )}
            {!isCity && provinceCities.length > 0 && (
              <div className="city-links">
                {provinceCities.map((c) => (
                  <button key={c.id} className="pill" onClick={() => onSelect({ type: 'city', id: c.id }, { fly: true })}>
                    {c.name} <ChevronRight size={12} />
                  </button>
                ))}
              </div>
            )}

            {(entity.numbeoSlug || isCity) && (
              <div className="ext-links">
                {entity.numbeoSlug && (
                  <a href={`https://es.numbeo.com/criminalidad/ciudad/${entity.numbeoSlug}`} target="_blank" rel="noreferrer">Numbeo crime <ExternalLink size={12} /></a>
                )}
                {entity.numbeoSlug && (
                  <a href={`https://es.numbeo.com/calidad-de-vida/ciudad/${entity.numbeoSlug}`} target="_blank" rel="noreferrer">Numbeo quality of life <ExternalLink size={12} /></a>
                )}
                <a href={`https://es.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(entity.name + ' ' + country.name)}`} target="_blank" rel="noreferrer">Wikipedia <ExternalLink size={12} /></a>
              </div>
            )}
          </section>

          {/* ---------- Safety ---------- */}
          <section id="sec-safety" className="report-section">
            <SectionHead icon={ShieldAlert} title="Safety"
              sub={[snic && 'Official SNIC statistics', entity.numbeo?.survey && 'Numbeo survey'].filter(Boolean).join(' · ') || (isCity ? 'City-level crime data' : 'Province crime statistics')}
              sources={sourcesForIndicators(['crimeIndex', 'homicide', 'propertyCrime', 'roadDeaths'].filter((k) => isOwnValue(entity, k)))} entity={entity} category="safety" />
            {['crimeIndex', 'homicide', 'propertyCrime', 'roadDeaths'].some((k) => isOwnValue(entity, k)) && (
              <div className="kv">
                {['crimeIndex', 'homicide', 'propertyCrime', 'roadDeaths'].filter((k) => isOwnValue(entity, k)).map((k) => (
                  <span key={k}>{indicatorById[k].label} <b>{fmtIndicator(k, entity.values[k])}</b> <span className="faint">avg {fmtIndicator(k, national.values[k])}</span></span>
                ))}
                {entity.numbeo?.safetyIndex != null && <span>Safety index <b>{fmtNum(entity.numbeo.safetyIndex, 2)}</b></span>}
                {entity.numbeo?.contributors != null && <span>Contributors <b>{entity.numbeo.contributors}</b></span>}
              </div>
            )}
            {entity.numbeo?.source === 'snapshot' && (
              <p className="note"><Info size={13} /> Numbeo values for {entity.name} are an approximate snapshot. Run the Numbeo scraper or check the live page.</p>
            )}
            {snic && snicYears.length > 0 && (
              <>
                <div className="sub-head">
                  Official statistics · SNIC {snicYears[0]}–{snic.latestYear}
                  <span className="muted small"> · {snic.level === 'department' ? `${snic.name} department (partido), the finest level SNIC publishes` : snic.level === 'city' ? 'city-wide' : 'province-wide'}</span>
                </div>
                <ChartCard id="snic-homicide" title="Homicide rate" subtitle="Victims of intentional homicide per 100,000 · SNIC" theme={theme} build={buildHomicideTrend} height={190}
                  table={{ columns: ['Year', snicLabel, ...(snicProv ? [snicProv.name] : []), 'Argentina'], rows: snicYears.map((y, i) => [y, fmt2(snic.series.homicide[i]), ...(snicProv ? [fmt2(snicProv.series.homicide[i])] : []), fmt2(snicNat.series.homicide[i])]) }} />
                <ChartCard id="snic-property" title="Robberies and thefts" subtitle="Incidents per 100,000 · SNIC" theme={theme} build={buildPropertyTrend} height={190}
                  table={{ columns: ['Year', snicLabel, ...(snicProv ? [snicProv.name] : []), 'Argentina'], rows: snicYears.map((y, i) => [y, fmt0(snic.series.propertyCrime[i]), ...(snicProv ? [fmt0(snicProv.series.propertyCrime[i])] : []), fmt0(snicNat.series.propertyCrime[i])]) }} />
                <div className="table-wrap">
                  <table className="data-table">
                    <thead><tr><th>Crime type ({snic.latestYear}, per 100k)</th><th className="num">{isCity ? 'Department' : entity.name}</th>{snicProv && <th className="num">Province</th>}<th className="num">Argentina</th></tr></thead>
                    <tbody>
                      {Object.entries(SNIC_TABLE).map(([k, label]) => (
                        <tr key={k}>
                          <td>{label}</td>
                          <td className="num">{fmtRate(snic.latest[k])}</td>
                          {snicProv && <td className="num">{fmtRate(snicProv.latest[k])}</td>}
                          <td className="num">{fmtRate(snicNat.latest[k])}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="chart-foot">Scores use 3-year averages. Rates are as published by SNIC; blank cells are not published for this area.</p>
              </>
            )}
            {surveyRows.length > 0 && (
              <div className="sub-head">
                Numbeo crowd-sourced survey
                <span className="muted small"> · {entity.numbeo.source === 'scraped' ? 'scraped' : entity.numbeo.source} {entity.numbeo.fetchedAt || ''}</span>
              </div>
            )}
            {surveyRows.length > 0 && (
              <ChartCard id="survey" title="Crime perception survey" subtitle="Numbeo, 0–100 · higher = worse" theme={theme} build={buildSurvey}
                height={surveyRows.length * 26 + 40}
                table={{ columns: ['Question', 'Score'], rows: surveyRows.map(([k, label]) => [label, survey[k]]) }}
                footnote="0–20 very low · 20–40 low · 40–60 moderate · 60–80 high · 80–100 very high" />
            )}
            {safetyRows.length > 0 && (
              <ChartCard id="walking" title="Perceived safety walking alone" subtitle="Numbeo, 0–100 · higher = safer" theme={theme} build={buildWalking}
                height={safetyRows.length * 30 + 40}
                table={{ columns: ['Question', 'Score'], rows: safetyRows.map(([k, label]) => [label, survey[k]]) }} />
            )}
            <MissingStats entity={entity} ids={['crimeIndex', 'homicide', 'propertyCrime', 'roadDeaths'].filter((k) => !isOwnValue(entity, k))} category="safety" />
          </section>

          <NewsSection entity={entity} country={country} model={model} />

          {/* ---------- Climate ---------- */}
          <section id="sec-climate" className="report-section">
            <SectionHead icon={Thermometer} title="Climate" sub={clim ? `ERA5 reanalysis, ${clim.period}` : 'ERA5 reanalysis, last 10 years'} status={detail.status.climate} sources={['Open-Meteo ERA5 (live)']} />
            {clim && (
              <>
                <div className="kv">
                  <span>Climate comfort <b>{clim.climateComfort}/100</b></span>
                  <span>Snow <b>{fmtNum(clim.snowfall)} cm/yr</b></span>
                  <span>Sunshine <b>{fmtNum(clim.sunshine)} h/yr</b></span>
                  {clim.tempMaxAnnual != null && <span>Hottest day <b>{fmtNum(clim.tempMaxAnnual, 1)}°C</b></span>}
                  {clim.tempMinAnnual != null && <span>Coldest night <b>{fmtNum(clim.tempMinAnnual, 1)}°C</b></span>}
                  {live.uv?.[entity.id]?.uvMean != null && <span>UV (mean daily max) <b>{fmtNum(live.uv[entity.id].uvMean, 1)}</b></span>}
                </div>
                <ChartCard id="temp" title="Temperature by month" subtitle="Average daily max & min, °C" theme={theme} build={buildTemp}
                  table={{ columns: ['Month', 'Max °C', 'Min °C'], rows: clim.monthly.map((m, i) => [MONTHS[i], m.tmax, m.tmin]) }} />
                <ChartCard id="precip" title="Precipitation by month" subtitle="Average monthly total, mm" theme={theme} build={buildPrecip}
                  table={{ columns: ['Month', 'mm', 'Wet days'], rows: clim.monthly.map((m, i) => [MONTHS[i], m.precip, m.wetDays]) }} />
                <ChartCard id="wet" title="Rainy days by month" subtitle="Days with ≥ 1 mm" theme={theme} build={buildWet} height={170} />
                {clim.snowfall > 0 && (
                  <ChartCard id="snow" title="Snowfall by month" subtitle="Average monthly total, cm" theme={theme} build={buildSnow} height={170}
                    table={{ columns: ['Month', 'cm'], rows: clim.monthly.map((m, i) => [MONTHS[i], m.snow]) }} />
                )}
                <ChartCard id="sun" title="Sunshine by month" subtitle="Average hours per day" theme={theme} build={buildSun} height={170} />
                <ChartCard id="comfort" title="Climate comfort by month" subtitle="MapStats comfort model, 0–100" theme={theme} build={buildComfort} height={170}
                  table={{ columns: ['Month', 'Comfort'], rows: clim.monthly.map((m, i) => [MONTHS[i], m.comfort]) }} />
                <ChartCard id="yearly" title="Annual mean temperature" subtitle="°C per year" theme={theme} build={buildYearly} height={170}
                  table={{ columns: ['Year', '°C', 'Precip. mm'], rows: clim.yearly.map((y) => [y.year, y.meanTemp, y.precip]) }} />
              </>
            )}
          </section>

          {/* ---------- Air & UV ---------- */}
          <section id="sec-air" className="report-section">
            <SectionHead icon={Wind} title="Air quality & UV" sub="Copernicus CAMS via Open-Meteo, last 92 days" status={detail.status.air} sources={['Open-Meteo CAMS (live)', 'Open-Meteo UV (live)']} />
            {air && (
              <>
                <ChartCard id="aqi" title="Daily air quality" subtitle="European AQI, daily mean" theme={theme} build={buildAqi}
                  footnote="0–20 good · 20–40 fair · 40–60 moderate · 60–80 poor · 80+ very poor" />
                <ChartCard id="pollutants" title="Average pollutant concentration" subtitle="µg/m³, last 92 days" theme={theme} build={buildPollutants} height={170}
                  table={{ columns: ['Pollutant', 'µg/m³'], rows: Object.entries(air.means) }} />
              </>
            )}
            {uv && (
              <ChartCard id="uv" title="Daily maximum UV index" subtitle="Last 3 months and 7-day forecast" theme={theme} build={buildUv} height={170}
                footnote="0–2 low · 3–5 moderate · 6–7 high · 8–10 very high · 11+ extreme" />
            )}
          </section>

          {/* ---------- Risks ---------- */}
          <section id="sec-risks" className="report-section">
            <SectionHead icon={Activity} title="Natural risks" sub="USGS earthquakes M5+ within 200 km since 1980" status={live.status.quakes}
              sources={['USGS (live)']} />
            {HAZARD_KEYS.some((k) => isOwnValue(entity, k)) && (
              <div className="kv">
                {HAZARD_KEYS.filter((k) => isOwnValue(entity, k)).map((k) => (
                  <span key={k}>{indicatorById[k].label} <b>{fmtIndicator(k, entity.values[k])}</b></span>
                ))}
              </div>
            )}
            <MissingStats entity={entity} ids={HAZARD_KEYS.filter((k) => !isOwnValue(entity, k))} />
            <FloodWatch flood={live.flood?.[entity.id]} status={live.status.flood} isCity={isCity} />
            {quakes && (
              <>
                <div className="kv">
                  <span>Events <b>{quakes.near.length}</b></span>
                  {quakes.strongest && <span>Strongest <b>M{quakes.strongest.mag.toFixed(1)}</b> ({quakes.strongest.time.slice(0, 4)})</span>}
                </div>
                {quakes.near.length > 0 && (
                  <ChartCard id="quakes" title="Earthquakes by period" subtitle="M5+ within 200 km, 5-year bins" theme={theme} build={buildQuakes} height={170}
                    table={{ columns: ['Period', 'Events'], rows: quakes.bins.map((b) => [b.label, b.n]) }} />
                )}
              </>
            )}
          </section>

          {/* ---------- Values by source ---------- */}
          <section id="sec-sources" className="report-section">
            <SectionHead icon={Database} title="Values by source" sub="Exactly as each source publishes them, with the area and period they describe" />
            {sourceGroups.map((g) => <SourceGroup key={g.key} group={g} />)}
          </section>

          {/* ---------- Indicators ---------- */}
          <section id="sec-indicators" className="report-section">
            <SectionHead icon={Info} title="All indicators" sub="Value · country average · normalised score" />
            {CATEGORIES.map((c) => <IndicatorGroup key={c.id} category={c} entity={entity} national={national} />)}
          </section>
        </ChartRegistry>
      </div>
    </aside>
  )
}

const round1 = (v) => (v == null ? null : Math.round(v * 10) / 10)
const fmt2 = (v) => (v == null ? null : v.toFixed(2))
const fmt0 = (v) => (v == null ? null : Math.round(v).toLocaleString('en'))
const fmtRate = (v) => (v == null ? '—' : v >= 100 ? Math.round(v).toLocaleString('en') : v.toFixed(1))

const SNIC_TABLE = {
  homicide: 'Intentional homicide (victims)', robbery: 'Robbery', theft: 'Theft', injuries: 'Intentional injuries',
  threats: 'Threats', sexualAssault: 'Rape', drugs: 'Drug law offences', roadDeaths: 'Road deaths (victims)',
}

function SectionHead({ icon: Icon, title, sub, status, sources, entity, category }) {
  return (
    <>
      <div className="section-head">
        <Icon size={16} />
        <div>
          <h3>{title}</h3>
          {sub && <div className="muted small">{sub}</div>}
        </div>
        {status === 'loading' && <LoaderCircle size={15} className="spin muted push" />}
        {status === 'error' && <span className="push err small"><CircleAlert size={13} /> unavailable</span>}
      </div>
      <SourceButtons keys={sources} entity={entity} category={category} />
    </>
  )
}

function Tile({ icon: Icon, label, value, status }) {
  const SIcon = status ? STATUS_ICON[status[2]] : null
  return (
    <div className="tile">
      <div className="tile-label"><Icon size={13} /> {label}</div>
      <div className="tile-value">{value}</div>
      {status && <div className={`status ${status[2]}`}><SIcon size={12} /> {status[1]}</div>}
    </div>
  )
}

function Coverage({ value = 0 }) {
  const pct = Math.round(value * 100)
  const r = 22, c = 2 * Math.PI * r
  return (
    <div className="coverage" title="Share of scored indicators with data">
      <svg width="58" height="58" viewBox="0 0 58 58" aria-hidden="true">
        <circle cx="29" cy="29" r={r} className="cov-track" />
        <circle cx="29" cy="29" r={r} className="cov-fill" strokeDasharray={`${(c * pct) / 100} ${c}`} transform="rotate(-90 29 29)" />
      </svg>
      <div><b>{pct}%</b><span>data coverage</span></div>
    </div>
  )
}

function IndicatorGroup({ category, entity, national }) {
  const Icon = ICONS[category.icon]
  const isCity = entity.type === 'city'
  const inCategory = INDICATORS.filter((i) => i.category === category.id)
  // Cities only show values measured for the city; province figures are reported as missing.
  const rows = inCategory.filter((i) => (isCity ? isOwnValue(entity, i.id) : entity.values[i.id] != null || national.values[i.id] != null))
  const missing = isCity ? inCategory.filter((i) => i.better && !isOwnValue(entity, i.id)).map((i) => i.id) : []
  if (!rows.length && !missing.length) return null
  return (
    <div className="ind-group">
      <div className="ind-head">
        <span><Icon size={14} /> {category.label}</span>
        <span className="muted small">{fmtScore(entity.categories[category.id])} <span className="faint">/ avg {fmtScore(national.categories[category.id])}</span></span>
      </div>
      <SourceButtons keys={sourcesForIndicators(rows.map((i) => i.id))} entity={entity} category={category.id} label={null} />
      {rows.map((i) => {
        const n = normalise(i.id, entity.values[i.id])
        const na = normalise(i.id, national.values[i.id])
        return (
          <div key={i.id} className="ind-row">
            <div className="ind-label">{i.label}</div>
            <div className="ind-val">{fmtIndicator(i.id, entity.values[i.id])}</div>
            <div className="meter" title={n != null ? `Normalised score ${Math.round(n)}/100` : 'Not scored'}>
              {n != null && <span style={{ width: `${n}%` }} />}
              {na != null && <i style={{ left: `${na}%` }} title="Country average" />}
            </div>
          </div>
        )
      })}
      <MissingStats entity={entity} ids={missing} category={category.id} />
    </div>
  )
}

const HAZARD_KEYS = ['seismicZone', 'fireRisk', 'floodRisk']

// Notice for indicators with no city-level data, with links to where they could be found.
function MissingStats({ entity, ids, category }) {
  if (entity.type !== 'city' || !ids.length) return null
  const fallback = ids.filter((id) => entity.inherited?.has(id))
  return (
    <div className="missing">
      <div className="missing-head"><CircleAlert size={13} /> No city-level stats for {entity.name}</div>
      <div className="missing-list">{ids.map((id) => indicatorById[id].label).join(' · ')}</div>
      {fallback.length > 0 && (
        <div className="missing-foot">
          The score uses province-level figures{entity.provinceName ? ` (${entity.provinceName})` : ''} for {fallback.length === ids.length ? 'these' : fallback.map((id) => indicatorById[id].label.toLowerCase()).join(', ')}.
        </div>
      )}
      <SourceButtons keys={sourcesForIndicators(ids)} entity={entity} category={category} label="Look up" />
    </div>
  )
}

function SourceGroup({ group: g }) {
  const showSource = g.rows.some((r) => r.source)
  return (
    <div className="src-group">
      <div className="src-group-head">
        {g.url ? <a href={g.url} target="_blank" rel="noreferrer">{g.name} <ExternalLink size={11} /></a> : <b>{g.name}</b>}
        {g.status && <span className="tag">{g.status}</span>}
      </div>
      {(g.level || g.area || g.period) && (
        <div className="src-meta">{[g.level, g.area, g.period].filter(Boolean).join(' · ')}</div>
      )}
      {g.rows.length > 0 && (
        <div className="table-wrap">
          <table className="data-table">
            <tbody>
              {g.rows.map((r, i) => (
                <tr key={i}>
                  <td>{r.label}{showSource && <span className="faint"> · {r.source}</span>}</td>
                  <td className="num exact">{fmtExact(r.value)}</td>
                  <td className="muted">{r.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {g.note && <p className="chart-foot">{g.note}</p>}
    </div>
  )
}

// Category × source matrix: how each source scores the place, and both integrations side by side.
const DISAGREE = 25
function ScoreBySource({ entity, mode }) {
  const cmp = entity.compare
  // Per-source columns follow the integration being viewed (fixed-domain for median, percentile for weighted).
  const view = mode === 'weighted' ? cmp?.weighted : cmp?.combined
  if (!view) return null
  const fams = SOURCE_FAMILIES.filter((f) => !isMultiSource(f.id) && CATEGORIES.some((c) => view.bySource?.[c.id]?.[f.id] != null))
  if (!fams.length) return null
  const w = cmp.weighted
  return (
    <div className="chart-card">
      <div className="chart-head">
        <div>
          <div className="chart-title">Score by source</div>
          <div className="chart-sub">
            0–100 per category · source columns {mode === 'weighted' ? 'as percentiles among places each source covers, with reliability weight' : 'on fixed ranges'} · both integrations compared
          </div>
        </div>
      </div>
      <div className="table-wrap">
        <table className="data-table score-by-source">
          <thead>
            <tr>
              <th>Category</th>
              {fams.map((f) => <th key={f.id} className="num">{f.short}</th>)}
              <th className={`num ${mode === 'combined' ? 'cur' : ''}`}>Median</th>
              <th className={`num ${mode === 'weighted' ? 'cur' : ''}`}>Weighted</th>
            </tr>
          </thead>
          <tbody>
            {CATEGORIES.map((c) => {
              const sp = w.spread?.[c.id]
              const agree = agreementOf(sp)
              return (
                <tr key={c.id}>
                  <td>
                    {c.label}
                    {mode !== 'weighted' && cmp.combined.spread?.[c.id] >= DISAGREE && (
                      <span className="disagree" title={`Sources differ by ${Math.round(cmp.combined.spread[c.id])} points`}><CircleAlert size={11} /> sources disagree</span>
                    )}
                  </td>
                  {fams.map((f) => {
                    const v = view.bySource?.[c.id]?.[f.id]
                    const wt = mode === 'weighted' ? w.sourceWeights?.[c.id]?.[f.id]?.w : null
                    return <td key={f.id} className="num">{fmtScore(v)}{v != null && wt != null && <small className="wt"> ×{wt.toFixed(2)}</small>}</td>
                  })}
                  <td className={`num ${mode === 'combined' ? 'cur' : ''}`}>{fmtScore(cmp.combined.categories[c.id])}</td>
                  <td className={`num ${mode === 'weighted' ? 'cur' : ''}`}>
                    {fmtScore(w.categories[c.id])}
                    {sp != null && <small className={`agree ${agree}`} title={`${agree} agreement between sources`}> ±{Math.round(sp)}</small>}
                  </td>
                </tr>
              )
            })}
            <tr className="total">
              <td>MapStats score</td>
              {fams.map((f) => <td key={f.id} />)}
              <td className={`num ${mode === 'combined' ? 'cur' : ''}`}>{fmtScore(cmp.combined.score)}</td>
              <td className={`num ${mode === 'weighted' ? 'cur' : ''}`}>{fmtScore(w.score)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="chart-foot">
        ± is the weighted standard deviation between sources: under 10 high agreement, 10–20 medium, over 20 low.
        Only data measured for {entity.name} votes; province figures fill a category only when no source has local data.
      </div>
      {mode === 'weighted' && <WeightDetails weighted={w} />}
    </div>
  )
}

function WeightDetails({ weighted }) {
  const seen = {}
  for (const c of CATEGORIES) for (const [f, x] of Object.entries(weighted.sourceWeights?.[c.id] || {})) seen[`${f}:${x.w.toFixed(3)}`] ||= { f, ...x }
  const rows = Object.values(seen)
  if (!rows.length) return null
  return (
    <details className="weights-detail">
      <summary>How the source weights were set</summary>
      <ul>
        {rows.map((r) => (
          <li key={r.f + r.w}>
            <b>{familyById[r.f].short} ×{r.w.toFixed(2)}</b> = {r.factors.map(([why, m]) => `${why} ${m}`).join(' × ')}
          </li>
        ))}
      </ul>
    </details>
  )
}

function FloodWatch({ flood, status, isCity }) {
  if (!isCity) return null
  if (status === 'loading') return <div className="kv"><span>River flood watch <LoaderCircle size={12} className="spin muted inline" /></span></div>
  if (!flood) return null
  if (!flood.river) return <p className="chart-foot">River flood watch: no significant river in the GloFAS cell at this location (median flow under 1 m³/s).</p>
  const lvl = floodLevel(flood.floodWatch ?? 0)
  const tone = { normal: 'good', near: 'warning', above: 'serious', 'well-above': 'critical' }[lvl.id]
  const Icon = STATUS_ICON[tone]
  return (
    <div className="flood-watch">
      <div className="sub-head">River flood watch <span className="muted small">· Copernicus GloFAS via Open-Meteo, nearest river cell</span></div>
      <div className="kv">
        <span>Forecast peak (30 days) <b>{fmtNum(flood.forecastPeak)} m³/s</b> {flood.forecastPeakDate && <span className="faint">on {flood.forecastPeakDate}</span>}</span>
        <span>Usual high water <b>{fmtNum(flood.highWater)} m³/s</b></span>
        <span>Normal flow <b>{fmtNum(flood.normalFlow)} m³/s</b></span>
        <span>Past-year peak <b>{fmtNum(flood.pastPeak)} m³/s</b></span>
      </div>
      <div className={`status ${tone}`}><Icon size={12} /> {lvl.label} · {flood.floodWatch?.toFixed(2)}× usual high water</div>
      <p className="chart-foot">“Usual high water” is the 90th percentile of the past year’s daily flow. A signal of rising rivers, not an official flood warning.</p>
    </div>
  )
}
