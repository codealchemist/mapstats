// News settings for Argentina: shared by the app and the /api/news function (pure data).
//
// Local outlets are direct RSS sources (publisher links, no decoding needed). VERIFIED outlets have their feed
// URL pinned (checked with `npm run news:probe -- ARG` on 2026-10-05; crime-section feeds preferred where the
// outlet has one), so a request never spends time discovering feeds. CANDIDATES are not used at runtime: the
// probe found no feed for them (the site may block automated clients or use an unusual feed path). Run the
// probe to diagnose candidates and get the line to move into VERIFIED.

// regions: provinces it covers (accent-folded, lowercase) · cities: cities it mainly covers ([] = province-wide)
const VERIFIED = [
  // Buenos Aires
  // El Día's /rss/policiales.xml stopped updating (newest item 103 days old on 2026-10-05): general feed.
  { domain: 'eldia.com', feed: 'https://www.eldia.com/feed', regions: ['buenos aires'], cities: ['la plata'] },
  // Homepage shows a bot challenge to every visitor; the feed answers intermittently (403 on 2 of 3 probes).
  { domain: 'infocielo.com', feed: 'https://www.infocielo.com/feed', regions: ['buenos aires'], cities: [] },
  { domain: 'eleco.com.ar', feed: 'https://articapiv3.eleco.com.ar/feed-notes', regions: ['buenos aires'], cities: ['tandil'] },
  // Córdoba
  { domain: 'cba24n.com.ar', feed: 'https://www.cba24n.com.ar/rss', regions: ['cordoba'], cities: ['cordoba'] },
  // Santa Fe
  { domain: 'lacapital.com.ar', feed: 'https://www.lacapital.com.ar/rss/ultimas-noticias.xml', regions: ['santa fe'], cities: ['rosario'] },
  // Mendoza
  { domain: 'mdzol.com', feed: 'https://www.mdzol.com/feeds/rss', regions: ['mendoza'], cities: [] },
  // Northwest
  { domain: 'lagaceta.com.ar', feed: 'https://feeds.feedburner.com/LaGacetaUltimoMomento?format=xml', regions: ['tucuman'], cities: [] },
  { domain: 'eltribuno.com', feed: 'https://www.eltribuno.com/rss/policiales.xml', regions: ['salta', 'jujuy'], cities: [] },
  { domain: 'todojujuy.com', feed: 'https://www.todojujuy.com/rss/pages/policiales.xml', regions: ['jujuy'], cities: [] },
  { domain: 'informatesalta.com.ar', feed: 'https://informatesalta.com.ar/rss', regions: ['salta'], cities: ['salta'] },
  { domain: 'diariopanorama.com', feed: 'https://www.diariopanorama.com/rss', regions: ['santiago del estero'], cities: [] },
  // Patagonia
  { domain: 'lmneuquen.com', feed: 'https://www.lmneuquen.com/rss/policiales.xml', regions: ['neuquen'], cities: [] },
  { domain: 'rionegro.com.ar', feed: 'https://www.rionegro.com.ar/feed/', regions: ['rio negro', 'neuquen'], cities: [] },
  { domain: 'elchubut.com.ar', feed: 'https://www.elchubut.com.ar/rss/policiales.xml', regions: ['chubut'], cities: ['trelew', 'rawson'] },
  { domain: 'adnsur.com.ar', feed: 'https://www.adnsur.com.ar/rss', regions: ['chubut', 'santa cruz'], cities: ['comodoro rivadavia', 'caleta olivia'] },
  { domain: 'sur54.com', feed: 'https://www.sur54.com/rss/actualidad', regions: ['tierra del fuego'], cities: [] },
  // Northeast
  { domain: 'ellitoral.com.ar', feed: 'https://www.ellitoral.com.ar/rss/policiales', regions: ['corrientes'], cities: ['corrientes'] },
  { domain: 'elterritorio.com.ar', feed: 'https://www.elterritorio.com.ar/rss/policiales', regions: ['misiones'], cities: [] },
  { domain: 'misionesonline.net', feed: 'https://misionesonline.net/feed/', regions: ['misiones'], cities: [] },
  { domain: 'diarionorte.com', feed: 'https://www.diarionorte.com/rss', regions: ['chaco'], cities: [] },
  { domain: 'diariochaco.com', feed: 'https://www.diariochaco.com/rss', regions: ['chaco'], cities: [] },
  // Cuyo & centre
  { domain: 'tiempodesanjuan.com', feed: 'https://www.tiempodesanjuan.com/feed', regions: ['san juan'], cities: [] },
  { domain: 'eldiariodelarepublica.com', feed: 'https://www.eldiariodelarepublica.com/rss/policiales.xml', regions: ['san luis'], cities: [] },
  { domain: 'laarena.com.ar', feed: 'https://www.laarena.com.ar/rss/portada.xml', regions: ['la pampa'], cities: [] },
]

// Probe history (2026-10-05) in the notes. Not used at runtime.
const CANDIDATES = [
  { domain: 'eldiariodetandil.com', regions: ['buenos aires'], cities: ['tandil'], note: 'no feed found (its articles still arrive via Google News)' },
  { domain: 'diariojornada.com.ar', regions: ['chubut'], cities: ['trelew'], note: 'feed paths answer an HTML page, no feed links found' },
  { domain: 'elsol.com.ar', regions: ['mendoza'], cities: ['mendoza'], note: 'rate-limits our user agent (429) but not browsers: kept out out of respect; feed had 0 crime items' },
  { domain: 'lacapitalmdp.com', regions: ['buenos aires'], cities: ['mar del plata'], note: 'feed paths answer 403' },
  { domain: 'lanueva.com', regions: ['buenos aires'], cities: ['bahia blanca'], note: '/rss/policiales exists but is ~5 years stale' },
  { domain: 'lavoz.com.ar', regions: ['cordoba'], cities: [], note: 'bot challenge on homepage; /rss answers 200 (feed directory?)' },
  { domain: 'rosario3.com', regions: ['santa fe'], cities: ['rosario'], note: '/rss/ answers a page without feed links (probably built by JavaScript)' },
  { domain: 'ellitoral.com', regions: ['santa fe'], cities: ['santa fe'], note: '/rss/ answers a page without feed links (probably built by JavaScript)' },
  { domain: 'losandes.com.ar', regions: ['mendoza'], cities: [], note: 'no feed found' },
  { domain: 'bariloche2000.com', regions: ['rio negro'], cities: ['san carlos de bariloche'], note: 'robots.txt disallows automated access' },
  { domain: 'laopinionaustral.com.ar', regions: ['santa cruz'], cities: [], note: 'no feed found' },
  { domain: 'analisisdigital.com.ar', regions: ['entre rios'], cities: [], note: 'timed out' },
  { domain: 'elonce.com', regions: ['entre rios'], cities: ['parana'], note: 'no feed found' },
  { domain: 'elliberal.com.ar', regions: ['santiago del estero'], cities: [], note: '/rss answers 403' },
  { domain: 'elancasti.com.ar', regions: ['catamarca'], cities: [], note: 'no feed found' },
  { domain: 'nuevarioja.com.ar', regions: ['la rioja'], cities: [], note: 'no feed found' },
  { domain: 'diariodecuyo.com.ar', regions: ['san juan'], cities: [], note: 'no feed found' },
  // Domains that do not resolve were removed: eldiariodelfin.com, epocadigital.com.ar, lamananaonline.com.ar.
]

// All 24 Argentine jurisdictions (folded names), for coverage reports.
const REGIONS = ['ciudad de buenos aires', 'buenos aires', 'catamarca', 'chaco', 'chubut', 'cordoba', 'corrientes', 'entre rios', 'formosa', 'jujuy', 'la pampa', 'la rioja',
  'mendoza', 'misiones', 'neuquen', 'rio negro', 'salta', 'san juan', 'san luis', 'santa cruz', 'santa fe', 'santiago del estero', 'tierra del fuego', 'tucuman']

export default {
  lang: 'es',
  countryName: 'Argentina',
  edition: { hl: 'es-419', gl: 'AR' },
  // Names shared by several places in Argentina (or common words): searched together with their province.
  ambiguousNames: ['merlo', 'junin', 'concepcion', 'san martin', 'santa rosa', 'la banda', 'capital', 'san rafael', 'general roca', 'san francisco', 'belgrano', 'colon', 'rivadavia', 'san isidro', 'san fernando'],
  // Region names as they arrive from geocoding may carry this prefix ("Provincia de Buenos Aires").
  regionPrefixes: ['provincia de '],
  regions: REGIONS,
  outlets: { verified: VERIFIED, candidates: CANDIDATES },
}
