// Crime news for reports, through the /api/news function (netlify/news/). Never used in scores.
import { defineProvider } from '#core/define.js'

export default [
  defineProvider({
    id: 'google-news', short: 'Google News RSS', name: 'Google News (RSS search)', url: 'https://news.google.com/',
    covers: 'Finds recent articles mentioning a place together with crime keywords; links decoded to the publisher',
    access: 'live', cadence: 'Continuous; cached 24 h per place', scope: 'News in the country’s edition, last 30 days', types: ['crime'],
    usedFor: '“In the news” section of reports (never used in scores)',
  }),
  defineProvider({
    id: 'outlet-rss', short: 'Outlet RSS', name: 'Local outlets’ RSS feeds', url: null,
    covers: 'Feeds of ~40 Argentine regional newspapers (El Eco, La Voz, La Capital, Los Andes…), matched by place and crime keywords',
    access: 'live', cadence: 'Each outlet’s latest items; cached 24 h', scope: 'Argentina · by province and city', types: ['crime'],
    usedFor: '“In the news” section of reports',
  }),
  defineProvider({
    id: 'news-service', short: 'News service', name: 'MapStats news service', url: null,
    covers: 'Our Netlify function: reads each article page, extracts ≤ 400 characters of the main text (respecting robots.txt), caches 24 h in Netlify Blobs',
    access: 'live', cadence: 'First request per place fetches; 24 h cache', scope: 'Netlify Functions + Blobs', types: ['crime'],
    usedFor: 'Article excerpts and images in “In the news”',
  }),
]
