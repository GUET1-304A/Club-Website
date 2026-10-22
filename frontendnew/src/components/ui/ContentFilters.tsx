import type { ReactNode } from 'react'
import TagPill from './TagPill'

interface ContentFiltersProps {
  label: string
  options: readonly { key: string; label: string }[]
  active: string
  onChange: (key: string) => void
  children?: ReactNode
}

export default function ContentFilters({ label, options, active, onChange, children }: ContentFiltersProps) {
  return (
    <div className="content-filters">
      <div className="content-filter-options" role="group" aria-label={label}>
        {options.map(option => (
          <TagPill key={option.key} label={option.label} active={active === option.key}
            onClick={() => onChange(option.key)} className="shrink-0 whitespace-nowrap min-h-11 inline-flex items-center px-4" />
        ))}
      </div>
      {children && <div className="content-filter-search">{children}</div>}
    </div>
  )
}
