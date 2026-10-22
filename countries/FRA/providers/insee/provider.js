// INSEE's published département statistics, read by prefill.mjs from the api.insee.fr Melodi and BDM APIs (insee.fr's
// robots.txt disallows its file downloads) into countries/FRA/data/insee.json. Each publication is its own provider so
// values cite it; the scored ones share the "insee" family with DREES (providers/drees).
import { defineProvider } from '#core/define.js'

const insee = { url: 'https://www.insee.fr/', access: 'import', scope: 'France · département', types: ['society'], refresh: 'year' }
const row = (label, value, unit) => ({ label, value, unit })

// "Values by source" group for a provider whose figures are plain indicator values: the place's own values (a
// commune's) or, when the dataset has none for it, its département's.
export const valuesProvenance = ({ entity, country }, { rows, period, status = 'Official download (api.insee.fr)', note }) => {
  const list = rows.map(([id, label, unit]) => row(label, entity.values[id], unit)).filter((r) => r.value != null)
  if (!list.length) return null
  const own = entity.type !== 'city' || rows.some(([id]) => entity.values[id] != null && !entity.inherited?.has(id))
  return {
    level: own ? (entity.type === 'city' ? (entity.id === 'FRA-paris' ? 'City (its own département)' : country.subregionLabel) : country.regionLabel) : country.regionLabel,
    area: own ? entity.name : entity.provinceName, period, status, rows: list, note,
  }
}

export default [
  defineProvider({
    ...insee, id: 'insee-unemployment', short: 'INSEE', name: 'INSEE – localised unemployment rates', url: 'https://www.insee.fr/fr/statistiques/series/102760732',
    covers: 'ILO unemployment rate by département, annual average (BDM series TCRED-TRAVAIL-EMPLOI-TCHOMA-SA; survey-based for overseas départements)',
    kind: 'official-survey', levels: ['region'], provides: ['unemployment'], cadence: 'Yearly (annual averages, June)',
    family: { id: 'insee', label: 'INSEE & DREES · official statistics', short: 'INSEE & DREES', why: 'statistics office series and registers (labour force estimates, vital statistics, physician register)' },
  }),
  defineProvider({
    ...insee, id: 'insee-mortality', short: 'INSEE vital statistics', name: 'INSEE – deaths and mortality series', url: 'https://www.insee.fr/fr/statistiques/7765185',
    covers: 'Life expectancy at birth by département, women and men separately (Melodi DS_DECES_MORTALITE_SERIES); the scored value is their mean',
    kind: 'register', levels: ['region'], family: 'insee', provides: ['lifeExp', 'lifeExpWomen', 'lifeExpMen'], cadence: 'Yearly (the last three years provisional)',
  }),
  defineProvider({
    ...insee, id: 'insee-population', short: 'INSEE population', name: 'INSEE – population estimates and reference populations', url: 'https://www.insee.fr/fr/statistiques/1893198',
    covers: 'Population at 1 January by département (localised estimates) and municipal populations of communes (populations légales)',
    // Context, not a scored source: no family.
    levels: ['region', 'subregion'], provides: ['pop'], cadence: 'Yearly', scope: 'France · département & commune',
  }),
  defineProvider({
    ...insee, id: 'insee-filosofi', short: 'INSEE Filosofi', name: 'INSEE – Filosofi', url: 'https://www.insee.fr/fr/statistiques/7756729',
    covers: 'Relative poverty rate (60 % of the median standard of living) for départements and communes; metropolitan France and La Réunion only',
    kind: 'register', levels: ['region', 'subregion'], provides: ['povertyRelative'], cadence: 'Yearly (two years after the income year)', scope: 'Metropolitan France & La Réunion · département & commune',
    provenance: (ctx) => valuesProvenance(ctx, { rows: [['povertyRelative', 'Relative poverty rate (below 60 % of the median standard of living)', '%']], period: String(ctx.meta?.period?.filosofi ?? ''), note: 'Fiscal and social data of every household (Filosofi): metropolitan France and La Réunion; the other overseas départements are not covered.' }),
  }),
  defineProvider({
    ...insee, id: 'insee-census', short: 'INSEE census', name: 'INSEE – population census, commuting', url: 'https://www.insee.fr/fr/statistiques/8201212',
    covers: 'Employed residents by main mode of transport to work (Melodi DS_RP_NAVETTES_PRINC): share using public transport',
    kind: 'official-survey', levels: ['region', 'subregion'], provides: ['transitCommute'], cadence: 'Yearly census results', scope: 'France excluding Mayotte · département & commune',
    provenance: (ctx) => valuesProvenance(ctx, { rows: [['transitCommute', 'Employed residents aged 15+ whose main mode of transport to work is public transport', '%']], period: `census ${ctx.meta?.period?.census ?? ''}`, note: 'Computed by MapStats as public-transport commuters ÷ all commuters, from the census counts INSEE publishes.' }),
  }),
]
