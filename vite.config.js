import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Serves the Netlify functions under `npm run dev` too: requests to /api/news run the same handler
// (netlify/functions/news.mjs). Without Netlify Blobs the handler falls back to an in-memory cache,
// which lives as long as the dev server. `npm run dev:netlify` runs the real Netlify environment.
function netlifyFunctionsInDev() {
  const routes = { '/api/news': '/netlify/functions/news.mjs' }
  return {
    name: 'mapstats-netlify-functions-dev',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const path = req.url.split('?')[0]
        const entry = routes[path]
        if (!entry) return next()
        try {
          const { default: handler } = await server.ssrLoadModule(entry)
          const response = await handler(new Request(new URL(req.url, `http://${req.headers.host || 'localhost'}`), { method: req.method }))
          res.statusCode = response.status
          response.headers.forEach((value, key) => res.setHeader(key, value))
          res.end(Buffer.from(await response.arrayBuffer()))
        } catch (e) {
          server.config.logger.error(`[api] ${path} failed: ${e.stack || e}`)
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: `Local function error: ${e.message}` }))
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), netlifyFunctionsInDev()],
  worker: { format: 'es' },
  build: {
    chunkSizeWarningLimit: 1500,
  },
})
