# todox

Vite + React + TypeScript로 만든 간단한 할 일 앱입니다.  
데이터는 **Supabase(Postgres)** 에 저장되며, 기본 로그인은 **익명 로그인(Anonymous sign-in)** 을 사용합니다.

## Supabase 설정(필수)

### 1) Auth에서 Anonymous sign-ins 활성화
- Supabase 대시보드 → **Auth** → **Sign-in methods** → **Anonymous** 활성화

### (선택) Google 로그인 활성화
- Supabase 대시보드 → **Auth** → **Sign-in methods** → **Google** 활성화
- Redirect URL에 개발/배포 도메인을 추가해야 합니다. (로컬 개발이면 보통 `http://localhost:57327`)
  - Android(Capacitor) 앱을 쓰는 경우 Redirect URL에 `todox://auth-callback`도 추가하세요.

### 2) 테이블/RLS 생성
- Supabase SQL Editor에서 `supabase.sql` 실행

### 3) 환경변수 설정
루트에 `.env` 파일을 만들고 아래를 채웁니다. (예시는 `.env.example`)

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## 실행

## Android 앱 빌드(Capacitor)
- **사전 준비물**: Android Studio(권장), JDK 17+(Android Studio 내장 JDK 사용 가능)
- **동기화(웹 빌드 → Android로 복사)**:
```bash
npm run cap:sync:android
```
- **Android Studio 열기**:
```bash
npm run android:open
```
- **딥링크/OAuth**: Supabase Redirect URL에 `todox://auth-callback` 추가(위 “Google 로그인 활성화” 참고)

### Windows PowerShell에서 npm이 안 잡히는 경우
이 프로젝트 환경에 따라 `npm`이 PATH에 없을 수 있어요. 그럴 땐 아래처럼 `npm.cmd`를 직접 호출하면 됩니다.

```powershell
& "C:\Program Files\nodejs\npm.cmd" install
& "C:\Program Files\nodejs\npm.cmd" run dev
```

### 정상적으로 npm이 잡히는 경우

```bash
npm install
npm run dev
```

## 동작 방식(요약)
- 앱 시작 시 로컬 캐시(`localStorage`)로 즉시 렌더링
- 백그라운드에서 Supabase의 `todox_user_states`에서 상태를 불러와 덮어씀
- 변경사항은 **디바운스** 후 Supabase에 `upsert`로 저장

## Chrome 북마크 확장프로그램(선택)

이 레포에는 간단한 크롬 확장프로그램이 포함되어 있습니다.

- **아이콘 클릭**: 현재 탭을 북마크 목록에 추가
- **아이콘 우클릭 메뉴**: `북마크 목록`(리스트 화면 열기), `현재 탭 북마크 추가`
- **todox 앱 연결**: todox(`http://localhost:57327`)에서 좌측 메뉴 **북마크** 화면을 열면 확장프로그램의 북마크를 불러와 표시합니다.

### 로드 방법(개발자 모드)

1) 크롬에서 `chrome://extensions` 열기  
2) 우측 상단 **개발자 모드** 켜기  
3) **압축해제된 확장 프로그램을 로드합니다** 클릭  
4) 이 프로젝트의 `chrome-extension/` 폴더 선택

## GitHub Pages 무료 배포(웹 + 확장프로그램)

### 웹 배포(GitHub Pages)

이 프로젝트는 GitHub Pages의 **project pages**( `https://<user>.github.io/todox/` )로 배포하도록 설정되어 있습니다.

1) GitHub 저장소 → **Settings → Pages**
2) **Build and deployment** → Source를 **GitHub Actions**로 설정
3) `main` 브랜치에 푸시하면 자동으로 배포됩니다. (`.github/workflows/deploy-gh-pages.yml`)

> 중요: GitHub Pages 배포는 GitHub Actions에서 빌드되므로, Supabase 환경변수도 **GitHub Secrets**로 넣어야 합니다.
> - 저장소 → Settings → Secrets and variables → Actions → **New repository secret**
>   - `VITE_SUPABASE_URL`
>   - `VITE_SUPABASE_ANON_KEY`

### 서버 푸시(FCM) 설정(최종형 알림)

서버 푸시는 Firebase(FCM) 기반으로 동작합니다.

#### 1) 웹(Web Push)용 Firebase 환경변수

GitHub Actions Secrets에 아래를 추가하세요(배포 빌드에 포함됩니다).

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_VAPID_KEY`

> 위 값이 있으면 빌드 시 `dist/firebase-messaging-sw.js`가 자동 생성됩니다. (Vite 플러그인)

#### 2) Supabase Edge Function 환경변수

Supabase Dashboard → Edge Functions → Secrets(환경변수)에 아래를 넣어야 합니다.

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `FIREBASE_SERVICE_ACCOUNT_JSON` (Firebase 서비스 계정 JSON 전체를 문자열로)

#### 3) Edge Function 배포/스케줄

- 함수 파일: `supabase/functions/send-reminders/index.ts`
- Supabase Scheduled Functions로 1분마다 호출하도록 스케줄을 설정하세요.

#### 4) 앱에서 토큰 등록

설정 → 알림 → **서버 푸시(최종형) → 웹 푸시 토큰 등록** 버튼으로 토큰을 등록합니다.\n

> 참고: 리포지토리 이름이 `todox`가 아니라면 `vite.config.ts`의 `base`와, 확장프로그램 `manifest.json`의 `https://*.github.io/todox/*` 경로를 함께 바꿔야 합니다.

### 확장프로그램(배포 도메인에서 브리지 동작)

확장프로그램은 아래 URL에서 브리지가 동작하도록 설정되어 있습니다.

- 로컬 개발: `http://localhost:57327/*`
- GitHub Pages: `https://*.github.io/todox/*`

배포 후에도 확장프로그램은 **Chrome 개발자 모드에서 `chrome-extension/`을 Load unpacked**로 로드해 사용하면 됩니다.







