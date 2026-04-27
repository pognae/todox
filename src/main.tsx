import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { registerServiceWorker } from './pwa'
import { initSupabaseAuthDeepLinkListener } from './supabaseClient'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// PWA: 서비스워커 등록(설치/오프라인/백그라운드 동기화 기반 알림)
void registerServiceWorker()

// Native(Capacitor): OAuth 딥링크로 돌아왔을 때 세션 저장
initSupabaseAuthDeepLinkListener()
