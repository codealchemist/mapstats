// @ts-check
// Provider metadata: browser-safe, read by the sources view, the reliability weights and the CLI.
import { defineProvider } from '#core/define.js'

export default defineProvider({
  id: 'example-stats',
  name: 'Exampleland Statistics Office – Household Survey',
  url: 'https://stats.example.gov/household-survey',
  license: 'CC BY 4.0 (https://stats.example.gov/terms)',
  kind: 'official-survey',
  access: 'dataset',
  cadence: { every: 'year', expected: 'April' },
  topics: ['services.internet', 'services.water', 'economy'],
  provides: {
    internet: { levels: ['region'] },
    water: { levels: ['region'] },
    poverty: { levels: ['region'] },
    unemployment: { levels: ['region'] },
  },
})
