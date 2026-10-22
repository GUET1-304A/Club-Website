export interface SearchItem {
  id: string
  title: string
  description?: string
  category?: string
  keywords?: string[]
  href?: string
}

const normalize = (value: string) => value.normalize('NFKC').trim().toLocaleLowerCase()

export function searchItems(items: readonly SearchItem[], query: string): SearchItem[] {
  const normalized = normalize(query)
  if (!normalized) return items.slice(0, 6)
  const tokens = normalized.split(/\s+/)
  return items.map((item, index) => {
    const title = normalize(item.title)
    const text = normalize(`${item.title} ${item.description || ''} ${item.category || ''} ${(item.keywords || []).join(' ')}`)
    const score = title === normalized ? 3 : title.startsWith(normalized) ? 2 : title.includes(normalized) ? 1 : 0
    return { item, index, score, matches: tokens.every(token => text.includes(token)) }
  }).filter(result => result.matches)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(result => result.item)
}
