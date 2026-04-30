# todox 디자인 시스템 (이식용)

이 문서는 **todox** 웹앱에서 실제로 쓰인 색·타이포·간격·컴포넌트 규칙을 정리한 것이다. 다른 프로젝트를 같은 톤으로 맞출 때 **소스 오브 트루스**로 사용한다.

---

## 1. 컨셉

| 항목 | 내용 |
|------|------|
| **제품 톤** | 생산성·할 일·노트 — **Todoist류**: 밝은 UI, **코랄/토마토 레드** 액센트, **중립 그레이** 본문 |
| **밀도** | 정보 밀도 중간: 리스트·설정·폼이 많음. 본문 `text-sm` 기본, 보조는 `text-xs` |
| **레이아웃** | 좌 **사이드바(고정 폭)** + 우 **메인(스크롤)** + 선택 시 **우측 시트(패널)** |
| **기술** | React + **Tailwind CSS v4** (`@import 'tailwindcss'`), 테마는 **`@theme`** 블록에서 커스텀 토큰 정의 |

---

## 2. 폰트

- **본문**: **Inter** — `400`, `500`, `600`, `700`
- **로드**: Google Fonts (`preconnect` + `family=Inter:wght@400;500;600;700`)
- **스택**: `'Inter', ui-sans-serif, system-ui, sans-serif`
- **렌더링**: `body`에 `-webkit-font-smoothing: antialiased`
- **코드·ID**: `font-mono` + 작은 크기 (`text-xs`) — 설정 등에서 사용

---

## 3. 색상 토큰

### 3.1 CSS / `@theme` (단일 정의)

`src/index.css` 기준:

| 토큰 | 값 | 용도 |
|------|-----|------|
| `--color-todoist-red` | `#db4c3f` | 브랜드·주요 CTA·선택·체크·포커스 테두리·테마 컬러 메타 |
| `--color-todoist-red-hover` | `#c53727` | Primary 버튼 hover |
| `--color-surface` | `#fafafa` | 메인 콘텐츠 배경 |
| `--color-sidebar` | `#f4f4f4` | 사이드바 배경 |
| `--font-sans` | Inter 스택 | 전역 폰트 |

Tailwind에서 `bg-todoist-red`, `text-todoist-red`, `hover:bg-todoist-red-hover`, `focus:border-todoist-red`, `focus:ring-todoist-red/25` 등으로 사용한다.

### 3.2 중립 팔레트 (Tailwind `neutral`)

실사용 빈도가 높은 단계:

| 클래스 | 역할 |
|--------|------|
| `text-neutral-900` / `text-neutral-800` | 제목·강한 본문 |
| `text-neutral-700` | 기본 본문·버튼 텍스트 |
| `text-neutral-600` | 보조 설명 |
| `text-neutral-500` | 더 약한 보조·플레이스홀더 근처 |
| `text-neutral-400` | 라벨(uppercase)·비활성 느낌·완료 줄글 |
| `border-neutral-200` | 카드·입력·구분선 기본 |
| `border-neutral-100` | 얇은 구분·인셋 영역 |
| `bg-neutral-50` / `bg-neutral-100` | 입력 배경·태그·칩·서브 영역 |
| `hover:bg-neutral-50` | 보조 버튼·행 hover |

### 3.3 액센트·시맨틱 (Tailwind 기본 팔레트)

| 용도 | 예시 클래스 |
|------|-------------|
| 로그인/비로그인 로고 구분 | `text-sky-600` (미연결 시 브랜드 대체 — Sidebar) |
| 경고·충돌 | `amber-50` 배경, `amber-200` 테두리, `amber-700`/`amber-900` 텍스트 |
| 진행 | `blue-50` / `blue-200` / `blue-900` (저장 중 배너) |
| 성공 | `emerald-50` / `emerald-200` / `emerald-900` (저장됨) |
| 오류 | `red-50` / `red-200` / `red-900` |
| 마감 연체 | `text-red-600` |
| 외부 링크(마크다운) | `text-blue-600`, hover `text-blue-700`, 밑줄 `underline-offset-2` |
| 작업 링크(커스텀) | `text-todoist-red`, hover `text-red-700` |

### 3.4 선택·강조 배경

- 내비·토글 **선택됨**: `bg-red-50` + `text-todoist-red` (+ `font-medium`)
- 작업 행 **선택됨**: `bg-red-50/50`
- 설정 **세그먼트·칩 선택**: `border-todoist-red` + `bg-red-50` + `text-todoist-red`
- 태그 버튼 hover: `hover:bg-red-100` + `hover:text-todoist-red`

---

## 4. 타이포그래피 스케일

| 역할 | 클래스 | 비고 |
|------|--------|------|
| 페이지 제목 | `text-xl font-semibold md:text-2xl` | Main 헤더 |
| 섹션 제목(설정 카드) | `text-sm font-semibold text-neutral-800` | |
| 서브섹션·그룹 라벨 | `text-xs font-semibold text-neutral-700` | |
| 필드 라벨(대문자 스타일) | `text-xs font-medium uppercase text-neutral-400` | 상세 패널 |
| 본문 기본 | `text-sm` | 작업 제목, 입력, 리스트 |
| 보조·메타 | `text-xs text-neutral-500` | 날짜, 힌트 |
| 캘린더 셀 내 작은 텍스트 | `text-[11px]` ~ `text-[9px]` (반응형으로 `sm:` 키움) | 밀집 UI만 |
| 빈 상태 | `text-sm text-neutral-500` + `text-center` + `py-8` ~ `py-12` | |

---

## 5. 간격·모서리·그림자

### 5.1 간격

- 카드 내부: `p-4` ~ `p-5`, 섹션 간 `mb-4`
- 리스트 행: `py-3`, 요소 간 `gap-2` ~ `gap-3`
- 폼 라벨-필드: `mb-1` / `mb-2`
- 메인 패딩: `px-4 py-4 sm:px-6 sm:py-6 md:px-10` + 배경 `bg-surface`

### 5.2-radius

| 크기 | 클래스 | 사용처 |
|------|--------|--------|
| 작음 | `rounded` | 세그먼트 내부, 작은 칩 |
| 기본 | `rounded-md` | 버튼·입력·인라인 컨트롤 |
| 카드 | `rounded-lg` | 작업 목록 래퍼, 노트 카드, 슬래시 팝업 |

### 5.3 그림자

- `shadow-sm`: 카드·빠른 추가 바·노트 카드
- `shadow-xl`: 우측 상세 시트, 슬래시 명령 팝업

### 5.4 테두리

- 기본: `border border-neutral-200`
- 얇은 구분: `border-neutral-100`, `divide-neutral-100`
- 포커스 링: `focus:border-todoist-red focus:ring-1 focus:ring-todoist-red/25` (입력·검색)
- 그룹 포커스: `focus-within:border-todoist-red focus-within:ring-1 focus-within:ring-todoist-red/30` (QuickAdd 트랙)
- 체크박스: `focus:ring-todoist-red/30`, `accent-todoist-red`

---

## 6. 레이아웃 셸

```text
App: flex h-dvh w-full overflow-hidden bg-white text-neutral-900
  ├─ SyncBanner (fixed top, full width, z-50)
  └─ flex flex-1 min-h-0 overflow-hidden
       ├─ Sidebar: w-[280px], border-r, bg-sidebar, md:static / mobile: drawer + overlay bg-black/30
       ├─ MainContent: flex-1 overflow-y-auto bg-surface + 반응형 px/py
       └─ DetailPanels: fixed overlay + right sheet
```

- **뷰포트**: `#root` / 셸에 `min-h-100dvh` 또는 `h-dvh` — 모바일 주소창 대응
- **모바일 햄버거**: `border-neutral-200 bg-white` 아이콘 버튼

---

## 7. 컴포넌트 패턴 (Tailwind 요약)

### 7.1 사이드바 내비 버튼

- 기본: `rounded-md px-3 py-2 text-sm`, `text-neutral-700`, `hover:bg-neutral-200/80`
- 활성: `bg-red-50 font-medium text-todoist-red`
- 아이콘 슬롯: `h-5 w-5 text-neutral-500`

### 7.2 검색 입력

- `rounded-md border border-neutral-200 bg-white py-2 pl-9 pr-3 text-sm`
- 아이콘: `absolute left-3 text-neutral-400`
- 포커스: 위 **포커스 링** 패턴

### 7.3 보조(고스트) 버튼

- `rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50`
- `disabled:opacity-50` 공통

### 7.4 Primary 버튼

- `rounded-md bg-todoist-red px-3 py-2 text-sm font-medium text-white hover:bg-todoist-red-hover`

### 7.5 작업 행 (TaskItem)

- 행: `border-b border-neutral-100`, hover `hover:bg-neutral-50`, 선택 `bg-red-50/50`
- 하위 작업: `border-l-2 border-l-neutral-200 bg-neutral-50/50 pl-3`
- 완료 원형 체크: `h-5 w-5 rounded-full border-2`, 완료 시 `border-todoist-red bg-todoist-red text-white` + 체크 SVG
- 태그: `rounded-full bg-neutral-100 px-2 py-0.5 text-[11px]`, hover `hover:bg-red-100 hover:text-todoist-red`
- 우선순위 점: `h-2 w-2 rounded-full` + `bg-red-500` / `bg-orange-400` / `bg-blue-500`

### 7.6 빠른 추가 (QuickAdd)

- 바깥: `rounded-md border border-neutral-200 bg-white shadow-sm` + **focus-within** 레드 링
- 모드 토글 영역: `border-r border-neutral-200 bg-neutral-50 p-1`
- 선택된 모드 탭: `bg-white text-todoist-red shadow-sm`

### 7.7 설정 카드

- `rounded-lg border border-neutral-200 bg-white p-5 shadow-sm`
- 내부 구분: `border-t border-neutral-100 pt-4`

### 7.8 우측 상세 시트 (Task / Note)

- 오버레이: `fixed inset-0 z-[60] flex justify-end bg-black/20`
- 패널: `h-full w-full max-w-md flex-col bg-white shadow-xl`
- 헤더: `border-b border-neutral-100 px-4 py-3`, 제목 `text-sm font-medium text-neutral-500`
- 닫기: `rounded p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700`

### 7.9 동기화 배너 (토스트 스트립)

- `fixed inset-x-0 top-0 z-50 border-b` + 톤별 `border-*-200 bg-*-50 text-*-900`
- 내부: `max-w-5xl mx-auto px-4 py-2 text-sm`, 버튼은 `rounded-md border … px-2 py-1 text-xs`

### 7.10 캘린더 그리드

- 겉 테두리: `rounded-lg border border-neutral-200 bg-neutral-200 shadow-sm` + `grid grid-cols-7 gap-px`
- 요일 헤더: `bg-neutral-100 py-2 text-xs font-semibold text-neutral-500`
- 셀: `bg-white`, 비현재 월 `opacity-40`
- 오늘 날짜 뱃지: `rounded-full bg-todoist-red text-white`
- 셀 내 작업 hover: `hover:bg-red-50`

### 7.11 마크다운 에디터 (DescriptionEditor)

- 툴바: `border-b border-neutral-100`, 탭 스위치는 `rounded-md border border-neutral-200 p-0.5`, 활성 세그먼트 `bg-neutral-200 font-medium`
- 편집 영역: 모바일 `text-base sm:text-sm`, 스크롤 영역 `overscroll-contain`, 하단 `pb-[max(1rem,env(safe-area-inset-bottom))]`
- 미리보기 본문: `text-sm leading-5 text-neutral-800` + GFM용 인용·코드·표·`hr` 등 유틸 선택자
- 슬래시 팝업: `rounded-lg border bg-white shadow-xl`, 포커스 열 `ring-1 ring-todoist-red/30`
- 링크: 작업 `text-todoist-red`, 일반 URL `text-blue-600`

---

## 8. 아이콘

- **스타일**: SVG **스트로크**, 대체로 Heroicons 느낌
- **크기**: 리스트/툴바 `h-5 w-5`, 작은 곳 `h-4 w-4`
- **두께**: `strokeWidth={2}` 또는 `1.5`

---

## 9. 모션·접근성

- **전환**: `transition-colors` — 버튼·내비·행에만 간단히 사용 (과한 애니메이션 없음)
- **터치**: 인터랙티브 요소에 `touch-manipulation` (버튼·체크·슬래시 UI)
- **모달**: `role="dialog"`, `aria-modal="true"`, 라벨 연결 `aria-labelledby`

---

## 10. 새 프로젝트에 옮길 체크리스트

1. **`index.html`**: Inter 프리로드 + weights 400–700 + `theme-color` `#db4c3f` (또는 브랜드에 맞게 변경)
2. **글로벌 CSS**: `@import 'tailwindcss'` + `@theme { … }`에 위 색·폰트 토큰 복사
3. **`body`**: `margin: 0`, `font-family: var(--font-sans)`, antialiased
4. **Tailwind 사용 규칙**: 입력 포커스는 **`todoist-red` + ring 25%** 로 통일하면 앱 전체가 한 톤으로 맞는다
5. **레이아웃**: `h-dvh` / `min-h-[100dvh]` / `#root min-height` 로 모바일 안전하게
6. **카드·폼**: `rounded-lg` + `border-neutral-200` + `shadow-sm` 를 기본 카드로 고정

---

## 11. 의도적으로 쓰지 않는 것

- **다크 모드**: 현재 코드베이스에 일관된 다크 토큰 없음 — 도입 시 별도 스펙 필요
- **`App.css`**: Vite 템플릿 잔재 수준; 실제 앱 스타일은 **`index.css` + 컴포넌트 클래스**가 기준

---

## 12. 파일 참조

| 파일 | 내용 |
|------|------|
| `src/index.css` | `@theme` 토큰, body |
| `index.html` | 폰트, theme-color |
| `src/App.tsx` | 셸 레이아웃 |
| `src/components/Sidebar.tsx` | 내비·드로어 |
| `src/components/MainContent.tsx` | 헤더·검색·리스트 래퍼 |
| `src/components/TaskItem.tsx` | 행·체크·태그 |
| `src/components/QuickAdd.tsx` | 복합 입력 바 |
| `src/components/SettingsPanel.tsx` | 폼·카드·세그먼트 |
| `src/components/TaskDetailPanel.tsx` | 시트·폼 필드 |
| `src/components/SyncBanner.tsx` | 상태별 컬러 배너 |
| `src/components/CalendarMonth.tsx` | 그리드·오늘 강조 |
| `src/components/DescriptionEditor.tsx` | 에디터·미리보기·슬래시 |

이 목록을 바꾸지 않고 **토큰과 패턴만** 새 저장소로 복사하면 동일한 시각 언어를 재현할 수 있다.
