export type DescriptionEditorOp =
  | 'bold'
  | 'italic'
  | 'bullet'
  | 'ordered'
  | 'quote'
  | 'code'
  | 'link'
  | 'heading'

function lineStart(s: string, pos: number): number {
  let i = pos
  while (i > 0 && s[i - 1] !== '\n') i--
  return i
}

function lineEnd(s: string, pos: number): number {
  let i = pos
  while (i < s.length && s[i] !== '\n') i++
  return i
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
      const nextLines = lines.map((line, i) => {
        const without = line.replace(/^\d+\.\s+/, '')
        return `${i + 1}. ${without}`
      })
      const nextBlock = nextLines.join('\n')
      const text = value.slice(0, a) + nextBlock + value.slice(b)
      const delta = nextBlock.length - block.length
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
