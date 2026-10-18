// @ts-check
// Provider metadata: browser-safe, read by the sources view, the reliability weights and the CLI.
import { defineProvider } from '#core/define.js'

export default defineProvider({
  id: 'example-stats',
  short: 'Household survey',
  name: 'Exampleland Statistics Office – Household Survey',
  url: 'https://stats.example.gov/household-survey',
  covers: 'Internet and running water by household, poverty and unemployment, by province',
  // official-survey: base reliability 0.8 (src/core/define.js KINDS)
  kind: 'official-survey',
  // Source-selector group. Countries can share a family by declaring the same id, label and short.
  family: { id: 'stats-office', label: 'Statistics office · official surveys', short: 'Stats office' },
  levels: ['region'],
  provides: ['internet', 'water', 'poverty', 'unemployment'],
  access: 'import',
  cadence: 'Yearly, published each April',
  refresh: 'year',
  scope: 'Exampleland · province',
  types: ['society'],
})
