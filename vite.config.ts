import type { Connect, Plugin, ViteDevServer } from 'vite'
import type { ServerResponse } from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const FIREBASE_JS_CDN = '10.12.5'

function buildFirebaseMessagingAppendix(env: Record<string, string | undefined>): string | null {
  const apiKey = env.VITE_FIREBASE_API_KEY
  const authDomain = env.VITE_FIREBASE_AUTH_DOMAIN
  const projectId = env.VITE_FIREBASE_PROJECT_ID
  const appId = env.VITE_FIREBASE_APP_ID
  const messagingSenderId = env.VITE_FIREBASE_MESSAGING_SENDER_ID
  if (!apiKey || !authDomain || !projectId || !appId || !messagingSenderId) return null

  return `
importScripts('https://www.gstatic.com/firebasejs/${FIREBASE_JS_CDN}/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/${FIREBASE_JS_CDN}/firebase-messaging-compat.js');
firebase.initializeApp({
  apiKey: ${JSON.stringify(apiKey)},
  authDomain: ${JSON.stringify(authDomain)},
  projectId: ${JSON.stringify(projectId)},
  appId: ${JSON.stringify(appId)},
  messagingSenderId: ${JSON.stringify(messagingSenderId)},
});
const __todoxMessaging = firebase.messaging();
__todoxMessaging.onBackgroundMessage((payload) => {
  const title = payload?.notification?.title || 'todox 알림';
  const body = payload?.notification?.body || '';
  self.registration.showNotification(title, { body });
});
`
}

/**
 * public/sw-core.js + (옵션) Firebase Messaging을 하나의 sw.js로 합칩니다.
 * 두 개의 SW(sw.js / firebase-messaging-sw.js)가 같은 스코프를 두고 경쟁하면 FCM 백그라운드 수신이 깨질 수 있습니다.
 */
function mergeServiceWorkerPlugin(): Plugin {
  let root = process.cwd()

  const writeMergedSw = (mode: string) => {
    const env = { ...loadEnv(mode, root, 'VITE_'), ...process.env }
    const corePath = path.join(root, 'public/sw-core.js')
    if (!fs.existsSync(corePath)) return
    const base = fs.readFileSync(corePath, 'utf8')
    const fb = buildFirebaseMessagingAppendix(env)
    const merged = fb ? `${base}\n${fb}` : base
    const distDir = path.join(root, 'dist')
    if (!fs.existsSync(distDir)) return
    fs.writeFileSync(path.join(distDir, 'sw.js'), merged, 'utf8')
  }

  return {
    name: 'todox-merge-sw',
    configResolved(c) {
      root = c.root
    },
    configureServer(server: ViteDevServer) {
      server.middlewares.use((req: Connect.IncomingMessage, res: ServerResponse, next: Connect.NextFunction) => {
        const raw = req.url?.split('?')[0] ?? ''
        if (!raw.endsWith('/sw.js') && raw !== '/sw.js') return next()
        try {
          const mode = server.config.mode
          const env = { ...loadEnv(mode, root, 'VITE_'), ...process.env }
          const corePath = path.join(root, 'public/sw-core.js')
          const base = fs.readFileSync(corePath, 'utf8')
          const fb = buildFirebaseMessagingAppendix(env)
          const merged = fb ? `${base}\n${fb}` : base
          res.setHeader('Content-Type', 'application/javascript; charset=utf-8')
          res.end(merged)
        } catch (e) {
          next(e)
        }
      })
    },
    closeBundle() {
      writeMergedSw('production')
    },
  }
}

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
  plugins: [react(), tailwindcss(), devLogPlugin(), mergeServiceWorkerPlugin()],
})
