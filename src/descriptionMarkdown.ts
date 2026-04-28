export type DescriptionEditorOp =
  | 'bold'
  | 'italic'
  | 'strike'
  | 'bullet'
  | 'ordered'
  | 'quote'
  | 'code'
  | 'link'
  | 'heading'

export function lineStart(s: string, pos: number): number {
  let i = pos
  while (i > 0 && s[i - 1] !== '\n') i--
  return i
}

export function lineEnd(s: string, pos: number): number {
  let i = pos
  while (i < s.length && s[i] !== '\n') i++
  return i
}

/** Tab 목록 들여쓰기 기본값(작업 설명 등에서 smartLists를 쓸 때 대비) */
const DEFAULT_LIST_TAB_INDENT = '  '

function parseListLine(line: string): null | {
  ws: string
  kind: 'bullet' | 'ordered'
  marker: string
  rest: string
  orderedParts: string[] | null
} {
  const mBullet = /^(\s*)([-+*])\s(.*)$/.exec(line)
  if (mBullet) {
    return {
      ws: mBullet[1] ?? '',
      kind: 'bullet',
      marker: mBullet[2] ?? '-',
      rest: mBullet[3] ?? '',
      orderedParts: null,
    }
  }

  // UpNote/Evernote 스타일: 레벨은 들여쓰기로만 판단하고, 마커는 항상 `n. ` 형태로 유지한다.
  // 과거 데이터 호환을 위해 `1.1.` 같은 형태도 허용하되, 표시/재정렬은 마지막 숫자만 사용한다.
  const mOrd = /^(\s*)((?:\d+\.)+)(?:\s+(.*))?$/.exec(line)
  if (mOrd) {
    const raw = mOrd[2] ?? ''
    const parts = raw.endsWith('.') ? raw.slice(0, -1).split('.').filter(Boolean) : []
    if (parts.length === 0) return null
    return {
      ws: mOrd[1] ?? '',
      kind: 'ordered',
      marker: `${raw} `,
      rest: mOrd[3] ?? '',
      orderedParts: parts,
    }
  }

  return null
}

function formatOrderedMarker(n: number): string {
  return `${n}. `
}

/**
 * 과거에 `1.1.` 같은 형태로 저장된 번호 목록 마커를 `n.` 형태로 정규화합니다.
 * - 번호 자체의 재정렬(증감/초기화)은 하지 않고 "표현"만 바꿉니다.
 * - 들여쓰기 기반 레벨은 그대로 유지됩니다.
 */
export function normalizeOrderedMarkers(value: string): string {
  const lines = value.split('\n')
  let changed = false
  for (let i = 0; i < lines.length; i++) {
    const parsed = parseListLine(lines[i]!)
    if (!parsed || parsed.kind !== 'ordered' || !parsed.orderedParts?.length) continue
    const last = Number(parsed.orderedParts[parsed.orderedParts.length - 1])
    const n = Number.isFinite(last) && last > 0 ? last : 1
    const next = `${parsed.ws}${formatOrderedMarker(n)}${parsed.rest}`
    if (next !== lines[i]) {
      lines[i] = next
      changed = true
    }
  }
  return changed ? lines.join('\n') : value
}

function renumberOrderedBlock(value: string, startLineIdx: number): string {
  const lines = value.split('\n')
  if (startLineIdx < 0 || startLineIdx >= lines.length) return value

  // startLineIdx가 속한 "연속된 ordered-list 블록" 전체를 재번호 매김한다.
  // (들여쓰기 레벨은 ws 길이의 증감으로만 판단)
  let blockStart = startLineIdx
  while (blockStart > 0) {
    const prev = parseListLine(lines[blockStart - 1]!)
    if (!prev || prev.kind !== 'ordered') break
    blockStart--
  }

  let blockEnd = startLineIdx
  while (blockEnd < lines.length) {
    const cur = parseListLine(lines[blockEnd]!)
    if (!cur || cur.kind !== 'ordered') break
    blockEnd++
  }

  type Level = { wsLen: number; next: number }
  const stack: Level[] = []

  for (let k = blockStart; k < blockEnd; k++) {
    const parsed = parseListLine(lines[k]!)
    if (!parsed || parsed.kind !== 'ordered') continue

    const wsLen = parsed.ws.length
    while (stack.length > 0 && wsLen < stack[stack.length - 1]!.wsLen) stack.pop()

    if (stack.length === 0) {
      stack.push({ wsLen, next: 1 })
    } else {
      const top = stack[stack.length - 1]!
      if (wsLen > top.wsLen) {
        stack.push({ wsLen, next: 1 })
      } else if (wsLen < top.wsLen) {
        // (while에서 pop 했으므로 여기로는 거의 오지 않음)
        stack.push({ wsLen, next: 1 })
      }
    }

    const level = stack[stack.length - 1]!
    const n = level.next
    level.next++

    lines[k] = `${parsed.ws}${formatOrderedMarker(n)}${parsed.rest}`
  }

  return lines.join('\n')
}

/**
 * textarea에서 Enter를 눌렀을 때 리스트 자동 이어쓰기.
 * - `- ` / `* ` / `+ ` 불릿
 * - `1.` / `1.1.` 같은 순번 목록(다음 줄은 같은 레벨에서 마지막 숫자 +1)
 * 빈 리스트 항목에서 Enter면 목록 종료(마커 제거).
 */
export function handleMarkdownEnter(value: string, caret: number): { text: string; caret: number } | null {
  const ls = lineStart(value, caret)
  const le = lineEnd(value, caret)
  const line = value.slice(ls, le)
  const parsed = parseListLine(line)
  if (!parsed) return null

  if (parsed.kind === 'bullet') {
    const indent = parsed.ws
    const marker = parsed.marker
    const rest = parsed.rest
    if (rest.trim() === '') {
      const text = `${value.slice(0, ls)}${value.slice(le)}`
      const nextCaret = Math.min(ls, text.length)
      return { text, caret: nextCaret }
    }
    const insert = `\n${indent}${marker} `
    const text = `${value.slice(0, caret)}${insert}${value.slice(caret)}`
    return { text, caret: caret + insert.length }
  }

  const indent = parsed.ws
  const parts = parsed.orderedParts ?? ['1']
  const rest = parsed.rest
  if (rest.trim() === '') {
    const text = `${value.slice(0, ls)}${value.slice(le)}`
    const nextCaret = Math.min(ls, text.length)
    return { text, caret: nextCaret }
  }

  // UpNote/Evernote 스타일: 같은 레벨에서 다음 번호로 이어 쓴다.
  const last = Number(parts[parts.length - 1])
  const nextN = Number.isFinite(last) && last > 0 ? last + 1 : 2
  const insert = `\n${indent}${formatOrderedMarker(nextN)}`
  const text = `${value.slice(0, caret)}${insert}${value.slice(caret)}`
  // 번호 재정렬(초기화)은 들여쓰기(Tab) 동작에서만 수행한다.
  return { text, caret: caret + insert.length }
}

/**
 * 리스트 줄에서 Tab/Shift+Tab으로 들여쓰기/내어쓰기.
 * - bullet: 들여쓰기는 ws + indentUnit
 * - ordered: 들여쓰기 시 `1.` → `1.1.`처럼 단계가 늘고, 같은 블록의 번호를 재정렬
 * @param indentUnit 한 단계 들여쓰기에 쓸 문자열(예: 스페이스 4칸). 빈 문자열이면 기본 2칸.
 */
export function handleMarkdownTab(
  value: string,
  caret: number,
  dir: 'in' | 'out',
  indentUnit: string = DEFAULT_LIST_TAB_INDENT,
): { text: string; caret: number } | null {
  const unit = indentUnit.length > 0 ? indentUnit : DEFAULT_LIST_TAB_INDENT
  const ls = lineStart(value, caret)
  const le = lineEnd(value, caret)
  const line = value.slice(ls, le)
  const parsed = parseListLine(line)
  if (!parsed) return null

  if (dir === 'in') {
    if (parsed.kind === 'bullet') {
      const nextWs = `${parsed.ws}${unit}`
      const nextLine = `${nextWs}${parsed.marker} ${parsed.rest}`
      const text = `${value.slice(0, ls)}${nextLine}${value.slice(le)}`
      const caretDelta = nextLine.length - line.length
      return { text, caret: caret + caretDelta }
    }

    const nextWs = `${parsed.ws}${unit}`
    const nextLine = `${nextWs}${formatOrderedMarker(1)}${parsed.rest}`
    let text = `${value.slice(0, ls)}${nextLine}${value.slice(le)}`
    const lineIdx = value.slice(0, ls).split('\n').length - 1
    text = renumberOrderedBlock(text, lineIdx)
    const caretDelta = nextLine.length - line.length
    return { text, caret: caret + caretDelta }
  }

  if (parsed.ws.length < unit.length) return null
  const nextWs = parsed.ws.slice(0, parsed.ws.length - unit.length)

  if (parsed.kind === 'bullet') {
    const nextLine = `${nextWs}${parsed.marker} ${parsed.rest}`
    const text = `${value.slice(0, ls)}${nextLine}${value.slice(le)}`
    const caretDelta = nextLine.length - line.length
    return { text, caret: caret + caretDelta }
  }

  const nextLine = `${nextWs}${formatOrderedMarker(1)}${parsed.rest}`
  let text = `${value.slice(0, ls)}${nextLine}${value.slice(le)}`
  const lineIdx = value.slice(0, ls).split('\n').length - 1
  text = renumberOrderedBlock(text, lineIdx)
  const caretDelta = nextLine.length - line.length
  return { text, caret: caret + caretDelta }
}

/** 선택 구간의 각 줄 앞에 prefix 삽입(이미 있으면 제거 토글은 하지 않고 중복만 방지) */
function prefixEachLineInRange(
  s: string,
  start: number,
  end: number,
  prefix: string,
): { text: string; selStart: number; selEnd: number } {
  const a = lineStart(s, start)
  const b = lineEnd(s, Math.max(end - 1, start))
  const block = s.slice(a, b)
  const lines = block.split('\n')
  const nextLines = lines.map((line) => (line.startsWith(prefix) ? line : `${prefix}${line}`))
  const nextBlock = nextLines.join('\n')
  const text = s.slice(0, a) + nextBlock + s.slice(b)
  const delta = nextBlock.length - block.length
  return { text, selStart: a, selEnd: b + delta }
}

/**
 * textarea용 마크다운 삽입/감싸기.
 * 빈 선택 시 플레이스홀더를 넣고 그 구간을 선택하도록 범위를 돌려줍니다.
 */
export function applyDescriptionOp(
  value: string,
  selStart: number,
  selEnd: number,
  op: DescriptionEditorOp,
): { text: string; selStart: number; selEnd: number } {
  const sel = value.slice(selStart, selEnd)
  const hasSel = selStart !== selEnd

  const wrap = (before: string, placeholder: string, after: string) => {
    if (hasSel) {
      const mid = `${before}${sel}${after}`
      const text = value.slice(0, selStart) + mid + value.slice(selEnd)
      return { text, selStart: selStart + before.length, selEnd: selStart + before.length + sel.length }
    }
    const mid = `${before}${placeholder}${after}`
    const text = value.slice(0, selStart) + mid + value.slice(selEnd)
    const innerStart = selStart + before.length
    const innerEnd = innerStart + placeholder.length
    return { text, selStart: innerStart, selEnd: innerEnd }
  }

  switch (op) {
    case 'bold':
      return wrap('**', '굵게', '**')
    case 'italic':
      return wrap('*', '기울임', '*')
    case 'strike':
      return wrap('~~', '취소선', '~~')
    case 'code':
      return wrap('`', '코드', '`')
    case 'link': {
      const url = typeof window !== 'undefined' ? window.prompt('링크 URL', 'https://') : null
      if (url === null) return { text: value, selStart, selEnd }
      const label = hasSel ? sel : '링크 텍스트'
      const mid = `[${label}](${url})`
      const text = value.slice(0, selStart) + mid + value.slice(selEnd)
      return { text, selStart: selStart + mid.length, selEnd: selStart + mid.length }
    }
    case 'bullet':
      return prefixEachLineInRange(value, selStart, selEnd, '- ')
    case 'ordered': {
      const a = lineStart(value, selStart)
      const b = lineEnd(value, Math.max(selEnd - 1, selStart))
      const block = value.slice(a, b)
      const lines = block.split('\n')
      const startLineIdx = value.slice(0, a).split('\n').length - 1
      const nextLines = lines.map((line, i) => {
        const parsed = parseListLine(line)
        const body = parsed ? parsed.rest : line
        const ws = parsed?.ws ?? ''
        return `${ws}${formatOrderedMarker(i + 1)}${body}`
      })
      const nextBlock = nextLines.join('\n')
      const joined = value.slice(0, a) + nextBlock + value.slice(b)
      const text = renumberOrderedBlock(joined, startLineIdx + lines.length - 1)
      const delta = text.length - value.length
      return { text, selStart: a, selEnd: b + delta }
    }
    case 'quote':
      return prefixEachLineInRange(value, selStart, selEnd, '> ')
    case 'heading': {
      const a = lineStart(value, selStart)
      const end = lineEnd(value, selStart)
      const line = value.slice(a, end)
      const stripped = line.replace(/^#{1,6}\s*/, '').trim() || '제목'
      const nextLine = `## ${stripped}`
      const text = value.slice(0, a) + nextLine + value.slice(end)
      return {
        text,
        selStart: a + 3,
        selEnd: a + 3 + stripped.length,
      }
    }
  }
}
