import { fold } from '../../lib/format.js'

// Plain-language and Spanish words → terms that appear in measure labels.
const SYNONYMS = {
  rain: ['precip', 'rainy'], lluvia: ['precip', 'rainy'], precipitacion: ['precip'],
  temperature: ['°c', 'maximum', 'minimum', 'hottest', 'coldest', 'temperature'], temp: ['°c', 'maximum', 'minimum', 'hottest', 'coldest'],
  temperatura: ['°c', 'maximum', 'minimum', 'hottest', 'coldest', 'temperature'], heat: ['hottest', 'maximum'], calor: ['hottest', 'maximum'],
  hot: ['hottest', 'maximum'], cold: ['coldest', 'minimum'], frio: ['coldest', 'minimum'],
  snow: ['snow'], nieve: ['snow'], sun: ['sunshine', 'uv'], sol: ['sunshine', 'uv'],
  crime: ['crime', 'homicide', 'robber', 'theft', 'safety'], crimen: ['crime', 'homicide', 'robber', 'theft'], delito: ['crime', 'homicide', 'robber', 'theft'],
  robo: ['robber', 'theft'], robos: ['robber', 'theft'], hurto: ['theft'], homicidio: ['homicide'], inseguridad: ['safety', 'crime'], seguridad: ['safety'],
  murder: ['homicide'], violence: ['homicide', 'violent'], air: ['air', 'aqi', 'pollut'], aire: ['air', 'aqi', 'pollut'], contaminacion: ['pollut', 'aqi'],
  pollution: ['pollut', 'aqi'], flood: ['flood', 'river'], inundacion: ['flood', 'river'], rio: ['river'],
  earthquake: ['earthquake', 'seismic'], sismo: ['earthquake', 'seismic'], terremoto: ['earthquake', 'seismic'], fire: ['wildfire'], incendio: ['wildfire'],
  health: ['health', 'physician'], salud: ['health', 'physician'], hospital: ['health', 'physician'], doctors: ['physician'], medicos: ['physician'],
  poverty: ['poverty'], pobreza: ['poverty'], desempleo: ['unemployment'], jobs: ['unemployment'], empleo: ['unemployment'],
  cost: ['cost of living', 'purchasing'], costo: ['cost of living'], precios: ['cost of living'], transport: ['transport', 'commute', 'road'],
  transporte: ['transport', 'commute'], traffic: ['commute'], transito: ['commute'], internet: ['internet'], agua: ['water'], cloacas: ['sewer'],
  population: ['population'], poblacion: ['population'], score: ['score'], puntaje: ['score'], clima: ['climate', '°c', 'precip'],
}

// Every word of the query must appear in the texts, directly or through a synonym
// (accent- and case-insensitive).
export function matches(query, ...texts) {
  const words = fold(query || '').split(/\s+/).filter(Boolean)
  if (!words.length) return true
  const hay = fold(texts.filter(Boolean).join(' '))
  return words.every((w) => hay.includes(w) || (SYNONYMS[w] || []).some((s) => hay.includes(fold(s))))
}
