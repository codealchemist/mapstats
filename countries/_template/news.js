// News settings: pure data, shared by the app and the /api/news function.
export default {
  lang: 'es',
  // As local outlets write it (used as a required phrase in searches).
  countryName: 'Exampleland',
  // Google News edition; check that https://news.google.com/?hl=<hl>&gl=<gl>&ceid=<gl>:<hl> doesn't redirect.
  edition: { hl: 'es-419', gl: 'XX' },
  // Extends the core crime keywords for `lang`.
  keywords: { add: [] },
  // Place names shared by several regions, or common words: searched together with their region.
  ambiguousNames: ['san martin'],
  outlets: {
    // Checked with `npm run news:probe -- XXX`; the feed is pinned so requests never spend time discovering it.
    verified: [
      { domain: 'example-daily.com', feed: 'https://www.example-daily.com/rss/police.xml', regions: ['north'], cities: ['capital city'] },
    ],
    // Not used at runtime until the probe finds a feed.
    candidates: [
      { domain: 'south-herald.example', regions: ['south'], cities: [], note: 'no feed found' },
    ],
  },
}
