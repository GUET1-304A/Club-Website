import { type ReactNode } from 'react'

/**
 * Lightweight Markdown-to-JSX renderer.
 * Supports: headings, bold, italic, links, images, code blocks, inline code,
 * unordered lists, ordered lists, tables, horizontal rules, paragraph breaks.
 */

function splitTableRow(line: string): string[] {
  const trimmed = line.trim()
  const withoutOuterPipes = trimmed.replace(/^\|/, '').replace(/\|$/, '')
  return withoutOuterPipes.split('|').map(cell => cell.trim())
}

function parseTable(lines: string[], start: number): {
  header: string[]
  rows: string[][]
  nextIndex: number
} | null {
  const header = splitTableRow(lines[start])
  if (header.length === 0 || start + 1 >= lines.length) return null
  const separator = splitTableRow(lines[start + 1])
  // GFM 分隔行必须与表头列数一致（如 |---|---|），避免把普通文本误判成表格
  if (separator.length !== header.length || !separator.every(cell => /^:?-{1,}:?$/.test(cell))) {
    return null
  }
  const rows: string[][] = []
  let i = start + 2
  while (i < lines.length && lines[i].includes('|')) {
    rows.push(splitTableRow(lines[i]))
    i++
  }
  return { header, rows, nextIndex: i }
}

function parseInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = []
  let remaining = text
  let key = 0

  while (remaining.length > 0) {
    // Image ![alt](url)
    const imgMatch = remaining.match(/^!\[([^\]]*)\]\(([^)]+)\)/)
    if (imgMatch) {
      nodes.push(
        <img key={key++} src={imgMatch[2]} alt={imgMatch[1]} className="rounded-2xl my-4 max-w-full" />
      )
      remaining = remaining.slice(imgMatch[0].length)
      continue
    }
    // Link [text](url)
    const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/)
    if (linkMatch) {
      nodes.push(
        <a key={key++} href={linkMatch[2]} target="_blank" rel="noopener noreferrer"
          className="text-[#051A24] underline underline-offset-2 decoration-[rgba(0,0,0,0.15)] hover:decoration-[#051A24] transition-colors">
          {linkMatch[1]}
        </a>
      )
      remaining = remaining.slice(linkMatch[0].length)
      continue
    }
    // Bold **text**
    const boldMatch = remaining.match(/^\*\*(.+?)\*\*/)
    if (boldMatch) {
      nodes.push(<strong key={key++} className="font-semibold text-[#051A24]">{boldMatch[1]}</strong>)
      remaining = remaining.slice(boldMatch[0].length)
      continue
    }
    // Inline code `text`
    const codeMatch = remaining.match(/^`([^`]+)`/)
    if (codeMatch) {
      nodes.push(
        <code key={key++} className="bg-[#f0ece6] text-[#0D212C] px-1.5 py-0.5 rounded-md text-[0.9em] font-mono">
          {codeMatch[1]}
        </code>
      )
      remaining = remaining.slice(codeMatch[0].length)
      continue
    }
    // Italic *text*
    const italicMatch = remaining.match(/^\*(.+?)\*/)
    if (italicMatch) {
      nodes.push(<em key={key++} className="italic text-[#273C46]">{italicMatch[1]}</em>)
      remaining = remaining.slice(italicMatch[0].length)
      continue
    }
    // Plain text until next special char
    const nextSpecial = remaining.search(/[[!*`]/)
    if (nextSpecial === -1) {
      nodes.push(remaining)
      break
    }
    if (nextSpecial > 0) {
      nodes.push(remaining.slice(0, nextSpecial))
    }
    remaining = remaining.slice(nextSpecial)
  }
  return nodes
}

export default function Markdown({ content }: { content: string }) {
  if (!content) return null

  const lines = content.split('\n')
  const elements: ReactNode[] = []
  let i = 0
  let key = 0

  while (i < lines.length) {
    const line = lines[i]

    // Code block (fenced)
    if (line.trim().startsWith('```')) {
      const lang = line.trim().slice(3).trim()
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      i++ // skip closing ```
      elements.push(
        <pre key={key++} className="bg-[#f8f7f5] rounded-2xl p-4 my-4 overflow-x-auto border border-[rgba(0,0,0,0.06)]">
          <code className={`text-xs text-[#0D212C] leading-relaxed font-mono ${lang ? `language-${lang}` : ''}`}>
            {codeLines.join('\n')}
          </code>
        </pre>
      )
      continue
    }

    // Blank line
    if (line.trim() === '') {
      i++
      continue
    }

    // Heading
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/)
    if (headingMatch) {
      const level = headingMatch[1].length
      const sizes: Record<number, string> = { 1: 'text-2xl font-semibold mt-8 mb-4', 2: 'text-xl font-semibold mt-6 mb-3', 3: 'text-lg font-medium mt-5 mb-2' }
      const cls = sizes[level] || 'text-base font-medium mt-4 mb-2'
      elements.push(
        <h2 key={key++} className={`${cls} text-[#051A24] tracking-tight`}>
          {parseInline(headingMatch[2])}
        </h2>
      )
      i++
      continue
    }

    // Horizontal rule
    if (line.trim().match(/^[-*_]{3,}$/)) {
      elements.push(<hr key={key++} className="my-6 border-[rgba(0,0,0,0.06)]" />)
      i++
      continue
    }

    // Unordered list
    if (line.match(/^[-*+]\s+/)) {
      const items: string[] = []
      while (i < lines.length && lines[i].match(/^[-*+]\s+/)) {
        items.push(lines[i].replace(/^[-*+]\s+/, ''))
        i++
      }
      elements.push(
        <ul key={key++} className="space-y-1.5 my-3 pl-5">
          {items.map((item, idx) => (
            <li key={idx} className="text-sm md:text-base text-[#0D212C] leading-relaxed list-disc marker:text-[#273C46]/30">
              {parseInline(item)}
            </li>
          ))}
        </ul>
      )
      continue
    }

    // Ordered list
    if (line.match(/^\d+\.\s+/)) {
      const items: string[] = []
      while (i < lines.length && lines[i].match(/^\d+\.\s+/)) {
        items.push(lines[i].replace(/^\d+\.\s+/, ''))
        i++
      }
      elements.push(
        <ol key={key++} className="space-y-1.5 my-3 pl-5 list-decimal marker:text-[#273C46]/40 marker:text-sm">
          {items.map((item, idx) => (
            <li key={idx} className="text-sm md:text-base text-[#0D212C] leading-relaxed pl-1">
              {parseInline(item)}
            </li>
          ))}
        </ol>
      )
      continue
    }

    // Table (GFM)
    if (line.includes('|')) {
      const table = parseTable(lines, i)
      if (table) {
        elements.push(
          <div key={key++} className="overflow-x-auto my-4">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr>
                  {table.header.map((cell, idx) => (
                    <th key={idx} className="border border-[rgba(0,0,0,0.08)] bg-[#f8f7f5] px-3 py-2 text-left font-semibold text-[#051A24] whitespace-nowrap">
                      {parseInline(cell)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((row, rIdx) => (
                  <tr key={rIdx}>
                    {table.header.map((_, cIdx) => (
                      <td key={cIdx} className="border border-[rgba(0,0,0,0.08)] px-3 py-2 text-[#0D212C] align-top">
                        {parseInline(row[cIdx] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
        i = table.nextIndex
        continue
      }
    }

    // Paragraph (default)
    elements.push(
      <p key={key++} className="text-sm md:text-base text-[#0D212C] leading-relaxed my-2">
        {parseInline(line)}
      </p>
    )
    i++
  }

  return <div className="markdown-content">{elements}</div>
}
