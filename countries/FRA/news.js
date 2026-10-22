// News settings for France: shared by the app and the /api/news function (pure data). See docs/country-guide.md §4.6.
export default {
  lang: 'fr',
  countryName: 'France', // as the local press writes it
  edition: { hl: 'fr', gl: 'FR' },
  // Place names shared by several départements, or that are also common words: searched together with their département.
  ambiguousNames: ['saint-denis', 'saint-étienne', 'saint-etienne', 'melun', 'tours', 'brest', 'nice'],
  regionPrefixes: ['département de ', 'département du ', 'département des '],
  regions: [],
  // No outlet feed has been probed yet (npm run news:probe -- --country=FRA --outlets-only): Google News only.
  outletsNote: 'Local outlets are not verified yet. The regional dailies below publish RSS feeds; they need probing and pinning before they are used.',
  outlets: {
    verified: [],
    candidates: [
      { domain: 'ouest-france.fr', regions: ['ille-et-vilaine', 'loire-atlantique', 'maine-et-loire', 'finistere', 'calvados', 'sarthe'], cities: ['rennes', 'nantes', 'angers', 'brest', 'caen', 'le mans'], note: 'faits-divers section feed to probe' },
      { domain: 'lavoixdunord.fr', regions: ['nord', 'pas-de-calais'], cities: ['lille'], note: 'faits-divers section feed to probe' },
      { domain: 'nicematin.com', regions: ['alpes-maritimes', 'var'], cities: ['nice', 'toulon'], note: 'faits-divers section feed to probe' },
      { domain: 'leparisien.fr', regions: ['paris', 'seine-et-marne', 'yvelines', 'essonne', 'hauts-de-seine', 'seine-saint-denis', 'val-de-marne', 'val-d-oise'], cities: ['paris', 'melun'], note: 'faits-divers section feed to probe' },
      { domain: 'laprovence.com', regions: ['bouches-du-rhone'], cities: ['marseille', 'aix-en-provence'], note: 'faits-divers section feed to probe' },
      { domain: 'ladepeche.fr', regions: ['haute-garonne'], cities: ['toulouse'], note: 'faits-divers section feed to probe' },
      { domain: 'sudouest.fr', regions: ['gironde', 'pyrenees-atlantiques'], cities: ['bordeaux', 'biarritz'], note: 'faits-divers section feed to probe' },
      { domain: 'leprogres.fr', regions: ['rhone', 'loire'], cities: ['lyon', 'saint-etienne'], note: 'faits-divers section feed to probe' },
      { domain: 'dna.fr', regions: ['bas-rhin', 'haut-rhin'], cities: ['strasbourg', 'mulhouse'], note: 'faits-divers section feed to probe' },
      { domain: 'ledauphine.com', regions: ['isere', 'haute-savoie'], cities: ['grenoble', 'annecy'], note: 'faits-divers section feed to probe' },
    ],
  },
}
