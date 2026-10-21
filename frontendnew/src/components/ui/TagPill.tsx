interface TagPillProps {
  label: string
  active?: boolean
  onClick?: () => void
  className?: string
  variant?: 'default' | 'glass'
}

export default function TagPill({
  label,
  active = false,
  onClick,
  className = '',
  variant = 'default',
}: TagPillProps) {
  const activeClass = variant === 'glass'
    ? 'admin-glass-nav-active text-[#051A24]'
    : 'bg-[#051A24] dark:bg-[#3457ff] text-white border-transparent'
  const inactiveClass = variant === 'glass'
    ? 'bg-white/55 text-[#273C46] border border-white/80 backdrop-blur-md'
    : 'bg-[var(--theme-chip)] text-[var(--theme-text)] border border-[var(--theme-border)]'

  const classes = `inline-block rounded-full px-3 py-1 text-xs font-medium transition-all duration-200 ${
    active ? activeClass : inactiveClass
  } ${className}`

  if (onClick) {
    return <button type="button" aria-pressed={active} onClick={onClick} className={`${classes} cursor-pointer hover:border-[var(--theme-border)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3457ff]`}>{label}</button>
  }

  return <span className={classes}>{label}</span>
}
