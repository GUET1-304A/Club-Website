import { useState, useEffect, useRef, type ReactNode } from 'react'
import { Search } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export interface SearchItem {
  id: string
  title: string
  description?: string
  category?: string
  href?: string
}

interface SearchModalProps {
  children?: ReactNode
  items: SearchItem[]
  placeholder?: string
  onSelect?: (item: SearchItem) => void
}

export default function SearchModal({ children, items, placeholder = '搜索...', onSelect }: SearchModalProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
    else setQuery('')
  }, [open])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); setOpen(true) }
      if (e.key === 'Escape') setOpen(false)
    }
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onClickOutside)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onClickOutside)
    }
  }, [])

  const filtered = query
    ? items.filter((i) =>
        i.title.toLowerCase().includes(query.toLowerCase()) ||
        i.description?.toLowerCase().includes(query.toLowerCase())
      )
    : items.slice(0, 6)

  const handleSelect = (item: SearchItem) => {
    setOpen(false)
    onSelect?.(item)
    if (item.href) window.location.href = item.href
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger — click to open inline panel */}
      <div onClick={() => setOpen(!open)} className="cursor-pointer">
        {children || (
          <button className="flex items-center gap-2 rounded-full border border-[rgba(0,0,0,0.1)] bg-white px-4 py-2 text-sm text-[#273C46]/60 hover:border-[rgba(0,0,0,0.2)] transition-colors">
            <Search className="w-4 h-4" />
            <span>{placeholder}</span>
            <kbd className="ml-2 text-[10px] font-mono text-[#273C46]/25">⌘K</kbd>
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
            className="absolute top-full mt-2 right-0 w-80 bg-white rounded-[28px] shadow-xl border border-[rgba(0,0,0,0.06)] overflow-hidden z-50"
          >
            {/* Input */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-[rgba(0,0,0,0.04)]">
              <Search className="w-4 h-4 text-[#273C46]/30 shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={placeholder}
                className="flex-1 bg-transparent text-sm text-[#051A24] placeholder:text-[#273C46]/25 outline-none"
              />
            </div>

            {/* Results */}
            <div className="max-h-64 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="text-center text-xs text-[#273C46]/40 py-6">无结果</p>
              ) : (
                filtered.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleSelect(item)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-[#051A24]/4 transition-colors first:rounded-t-[28px] last:rounded-b-[28px]"
                  >
                    <span className="text-sm text-[#051A24] truncate flex-1">{item.title}</span>
                    {item.category && (
                      <span className="text-[10px] font-mono text-[#273C46]/35 shrink-0">{item.category}</span>
                    )}
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
