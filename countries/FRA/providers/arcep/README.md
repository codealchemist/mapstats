# arcep: fixed-broadband eligibility (ARCEP, Ma connexion internet)

| | |
|---|---|
| Publisher | ARCEP – Autorité de régulation des communications électroniques |
| Page | https://www.data.gouv.fr/datasets/ma-connexion-internet (files on data.arcep.fr) |
| Licence | Licence Ouverte 2.0 |
| Kind | `register`: eligibility of every premise as declared by the operators |
| Indicators | `fibreCoverage` (descriptive) |
| Levels | département, commune (own values for the 40 tracked cities) |
| Period | 2026 Q2 (30 June 2026) |
| Next release | Quarterly |
| Access | CSV downloads; the `…/statistiques/last/` URLs always serve the latest quarter |

## Definitions vs the MapStats catalogue

- `fibreCoverage`: premises (dwellings and business locations) eligible to fibre to the home ÷ all premises × 100. Eligibility measures availability, not the subscription rate of Argentina's `internet` (households with internet at home): shown for context, not scored. The share eligible to at least 30 Mbit/s with any technology is kept alongside in the details.

## Updating

```bash
rm countries/FRA/providers/arcep/raw/*.csv     # the "last" URLs serve a newer quarter
npm run prefill -- FRA --provider arcep
```
