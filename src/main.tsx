import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { registerServiceWorker } from './pwa'
import { initSupabaseAuthDeepLinkListener, initSupabaseAuthWebRedirectHandler } from './supabaseClient'
import { initNativePushRegistration } from './pushNative'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// PWA: 서비스워커 등록(설치/오프라인/백그라운드 동기화 기반 알림)
void registerServiceWorker()

// Web: OAuth 리다이렉트로 돌아온 code 교환(배포 환경 보강)
void initSupabaseAuthWebRedirectHandler()

// Native(Capacitor): OAuth 딥링크로 돌아왔을 때 세션 저장
initSupabaseAuthDeepLinkListener()

// Native(Capacitor): 푸시 토큰 등록(FCM/APNs)
void initNativePushRegistration()
