# todox

Vite + React + TypeScript로 만든 간단한 할 일 앱입니다.  
데이터는 **Supabase(Postgres)** 에 저장되며, 기본 로그인은 **익명 로그인(Anonymous sign-in)** 을 사용합니다.

## Supabase 설정(필수)

### 1) Auth에서 Anonymous sign-ins 활성화
- Supabase 대시보드 → **Auth** → **Sign-in methods** → **Anonymous** 활성화

### (선택) Google 로그인 활성화
- Supabase 대시보드 → **Auth** → **Sign-in methods** → **Google** 활성화
- Redirect URL에 개발/배포 도메인을 추가해야 합니다. (로컬 개발이면 보통 `http://localhost:5173`)

### 2) 테이블/RLS 생성
- Supabase SQL Editor에서 `supabase.sql` 실행

### 3) 환경변수 설정
루트에 `.env` 파일을 만들고 아래를 채웁니다. (예시는 `.env.example`)

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## 실행

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