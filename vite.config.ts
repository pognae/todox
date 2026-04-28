import type { Connect, Plugin, ViteDevServer } from 'vite'
import type { ServerResponse } from 'node:http'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

function firebaseMessagingSwPlugin(): Plugin {
  return {
    name: 'todox-firebase-messaging-sw',
    apply: 'build',
    generateBundle() {
      const apiKey = process.env.VITE_FIREBASE_API_KEY ?? ''
      const authDomain = process.env.VITE_FIREBASE_AUTH_DOMAIN ?? ''
      const projectId = process.env.VITE_FIREBASE_PROJECT_ID ?? ''
      const appId = process.env.VITE_FIREBASE_APP_ID ?? ''
      const messagingSenderId = process.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? ''

      // Firebase web push를 쓰지 않는 환경에서도 빌드는 성공해야 하므로, 값이 없으면 SW를 생성하지 않음.
      if (!apiKey || !authDomain || !projectId || !appId || !messagingSenderId) return

      const code = `/* eslint-disable no-restricted-globals */
importScripts('https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.5/firebase-messaging-compat.js');
self.firebase.initializeApp({
  apiKey: ${JSON.stringify(apiKey)},
  authDomain: ${JSON.stringify(authDomain)},
  projectId: ${JSON.stringify(projectId)},
  appId: ${JSON.stringify(appId)},
  messagingSenderId: ${JSON.stringify(messagingSenderId)},
});
const messaging = self.firebase.messaging();
messaging.onBackgroundMessage((payload) => {
  const title = payload?.notification?.title || 'todox 알림';
  const body = payload?.notification?.body || '';
  self.registration.showNotification(title, { body });
});
`

      this.emitFile({
        type: 'asset',
        fileName: 'firebase-messaging-sw.js',
        source: code,
      })
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
  plugins: [react(), tailwindcss(), devLogPlugin(), firebaseMessagingSwPlugin()],
})
