interface TagPillProps {
  label: string
  active?: boolean
  onClick?: () => void
  className?: string
}

export default function TagPill({
  label,
  active = false,
  onClick,
  className = '',
}: TagPillProps) {
  return (
    <span
      onClick={onClick}
      className={`inline-block rounded-full px-3 py-1 text-xs font-medium transition-all duration-200 ${
        active
          ? 'bg-[#051A24] text-white border-transparent'
          : 'bg-white text-[#273C46] border border-[rgba(0,0,0,0.08)]'
      } ${onClick ? 'cursor-pointer hover:border-[rgba(0,0,0,0.2)]' : ''} ${className}`}
    >
      {label}
    </span>
  )
}
