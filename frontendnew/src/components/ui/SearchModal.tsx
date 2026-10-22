import { useState, useEffect, useRef, useId, type ReactNode, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { navigate } from '../../lib/navigation'
import { Search } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { searchItems, type SearchItem } from '../../lib/search'
export type { SearchItem } from '../../lib/search'

interface SearchModalProps {
  children?: ReactNode
  items: SearchItem[]
  placeholder?: string
  onSelect?: (item: SearchItem) => void
}

export default function SearchModal({ children, items, placeholder = '搜索...', onSelect }: SearchModalProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const resultsId = useId()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) { setQuery(''); return }
    const timer = setTimeout(() => inputRef.current?.focus(), 50)
    return () => clearTimeout(timer)
  }, [open])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); setOpen(true) }
      if (e.key === 'Escape' && containerRef.current?.contains(document.activeElement)) { setOpen(false); triggerRef.current?.focus() }
    }
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onClickOutside)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onClickOutside)
    }
  }, [])

  const filtered = searchItems(items, query)

  const handleSelect = (item: SearchItem) => {
    setOpen(false)
    if (item.href) navigate(item.href)
    else { onSelect?.(item); triggerRef.current?.focus() }
  }

  const moveFocus = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.nativeEvent.isComposing || (event.key !== 'ArrowDown' && event.key !== 'ArrowUp')) return
    event.preventDefault()
    const results = Array.from(containerRef.current?.querySelectorAll<HTMLElement>('[data-search-result]') || [])
    if (!results.length) return
    const index = results.indexOf(document.activeElement as HTMLElement)
    const next = index < 0 ? (event.key === 'ArrowDown' ? 0 : results.length - 1) : (index + (event.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length
    results[next].focus()
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger — click to open inline panel */}
      <div className="cursor-pointer" onClick={children ? () => setOpen(!open) : undefined}>
        {children || (
          <button ref={triggerRef} type="button" aria-expanded={open} aria-controls={resultsId} onClick={() => setOpen(!open)} className="flex items-center gap-2 rounded-full border border-[var(--theme-border)] bg-[var(--theme-surface)] px-4 py-2 text-sm text-[var(--theme-text-strong)] hover:border-[#3457ff] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3457ff] transition-colors">
            <Search className="w-4 h-4" />
            <span>{placeholder}</span>
            <kbd className="ml-2 hidden sm:inline text-[10px] font-mono text-[#273C46]/60">Ctrl K</kbd>
          </button>
        )}
      </div>

      {/* Dropdown panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.12 }}
            className="absolute top-full mt-2 right-0 w-[min(24rem,calc(100vw-5rem))] bg-[var(--theme-surface)] rounded-[20px] shadow-xl border border-[var(--theme-border)] overflow-hidden z-50"
          >
            {/* Input */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--theme-border)]">
              <Search className="w-4 h-4 text-[var(--theme-text)] shrink-0" />
              <input
                ref={inputRef}
                type="search"
                aria-label={placeholder}
                aria-controls={resultsId}
                onKeyDown={event => {
                  moveFocus(event)
                  if (event.key === 'Enter' && filtered[0] && !event.nativeEvent.isComposing) { event.preventDefault(); handleSelect(filtered[0]) }
                }}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={placeholder}
                className="min-w-0 flex-1 bg-transparent text-sm text-[var(--theme-text-strong)] placeholder:text-[var(--theme-text)] outline-none"
              />
            </div>

            {/* Results */}
            <p className="sr-only" aria-live="polite">{filtered.length} 个结果，使用上下方向键选择，回车打开，Escape 关闭</p>
            <ul id={resultsId} className="max-h-80 overflow-y-auto overscroll-contain" onKeyDown={moveFocus}>
              {filtered.length === 0 ? (
                <li className="text-center text-sm text-[var(--theme-text)] py-6">没有找到匹配内容，试试其他关键词</li>
              ) : filtered.map(item => {
                const secondary = item.description?.trim() && item.description.trim() !== item.title.trim()
                  ? item.description : item.keywords?.slice(0, 4).join(' · ')
                const content = <>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-[var(--theme-text-strong)] line-clamp-2 break-words">{item.title}</span>
                    {secondary && <span className="mt-1 block text-xs text-[var(--theme-text)] line-clamp-2 leading-relaxed">{secondary}</span>}
                  </span>
                  {item.category && <span className="text-[11px] text-[var(--theme-text)] shrink-0">{item.category}</span>}
                </>
                const className = 'w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-[var(--nav-active-bg)] focus-visible:bg-[var(--nav-active-bg)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#3457ff] transition-colors'
                return <li key={item.id}>
                  {item.href ? (
                    <a href={item.href} data-search-result className={className} onClick={event => {
                      if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) setOpen(false)
                    }}>{content}</a>
                  ) : (
                    <button type="button" data-search-result className={className} onClick={() => handleSelect(item)}>{content}</button>
                  )}
                </li>
              })}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
