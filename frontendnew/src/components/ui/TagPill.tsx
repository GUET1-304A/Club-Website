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
    : 'bg-[#051A24] text-white border-transparent'
  const inactiveClass = variant === 'glass'
    ? 'bg-white/55 text-[#273C46] border border-white/80 backdrop-blur-md'
    : 'bg-white text-[#273C46] border border-[rgba(0,0,0,0.08)]'

  return (
    <span
      onClick={onClick}
      className={`inline-block rounded-full px-3 py-1 text-xs font-medium transition-all duration-200 ${
        active ? activeClass : inactiveClass
      } ${onClick ? 'cursor-pointer hover:border-[rgba(0,0,0,0.2)]' : ''} ${className}`}
    >
      {label}
    </span>
  )
}
