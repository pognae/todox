import type { Connect, Plugin, ViteDevServer } from 'vite'
import type { ServerResponse } from 'node:http'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

function devLogPlugin(): Plugin {
  return {
    name: 'todox-dev-log',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(
        '/__todox_log',
        (req: Connect.IncomingMessage, res: ServerResponse, next: Connect.NextFunction) => {
        if (req.method !== 'POST') return next()
        let body = ''
        req.on('data', (c: Buffer) => (body += c.toString('utf8')))
        req.on('end', () => {
          try {
            const payload = body ? JSON.parse(body) : null
            // Vite dev server 터미널에 찍히는 로그(서버단 로그 대용)
            // eslint-disable-next-line no-console
            console.log('[todox][client-log]', payload)
          } catch (e) {
            // eslint-disable-next-line no-console
            console.log('[todox][client-log] invalid json', String(e))
          }
          res.statusCode = 204
          res.end()
        })
        },
      )
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages(project pages) 배포용 base 경로
  // - https://<user>.github.io/<repo>/ 형태에서 <repo>가 "todox"라면 "/todox/"
  // - 로컬/dev는 "/"
  base: process.env.GITHUB_PAGES ? '/todox/' : '/',
  plugins: [react(), tailwindcss(), devLogPlugin()],
})
