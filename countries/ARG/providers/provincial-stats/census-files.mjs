// The census tables the prefill reads, shared with censo-download.mjs. No dependencies, so the download script runs on
// a plain Node install, outside the dev container.
//
// Censo 2022 definitive results: per province, three household tables (2: procedencia del agua, 3: desagüe del
// inodoro, 7: internet en la vivienda). Files are c2022_<slug>_hogares_c<table>_<n>.xlsx, n being INDEC's 1–24 order.
// When a new census is published, update CENSO, the file pattern and RENAMED (find the names with
// `node censo-download.mjs --all`).
export const CENSO = 'https://censo.gob.ar/wp-content/uploads/2023/11/'
const PROVINCES = [
  ['caba', 'AR-C'], ['bsas', 'AR-B'], ['catamarca', 'AR-K'], ['chaco', 'AR-H'], ['chubut', 'AR-U'], ['cordoba', 'AR-X'],
  ['corrientes', 'AR-W'], ['entrerios', 'AR-E'], ['formosa', 'AR-P'], ['jujuy', 'AR-Y'], ['lapampa', 'AR-L'], ['larioja', 'AR-F'],
  ['mendoza', 'AR-M'], ['misiones', 'AR-N'], ['neuquen', 'AR-Q'], ['rionegro', 'AR-R'], ['salta', 'AR-A'], ['sanjuan', 'AR-J'],
  ['sanluis', 'AR-D'], ['santacruz', 'AR-Z'], ['santafe', 'AR-S'], ['santiago', 'AR-G'], ['tdf', 'AR-V'], ['tucuman', 'AR-T'],
]
const TABLES = { water: 2, sewer: 3, internet: 7 }
// Files published under a different name than the pattern gives.
const RENAMED = { 'c2022_lapampa_hogares_c3_11.xlsx': 'c2022_lapampa_hogares_c3_11-1.xlsx', 'c2022_larioja_hogares_c3_12.xlsx': 'c2022_larioja_hogares_c3_12-1.xlsx' }

/** [{ iso, measure, name, url }]: 24 provinces × 3 tables. */
export const CENSUS = PROVINCES.flatMap(([slug, iso], i) => Object.entries(TABLES).map(([measure, table]) => {
  const pattern = `c2022_${slug}_hogares_c${table}_${i + 1}.xlsx`
  const name = RENAMED[pattern] || pattern
  return { iso, measure, name, url: CENSO + name }
}))
