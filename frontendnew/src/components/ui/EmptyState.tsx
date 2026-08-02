import type { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon?: LucideIcon
  message: string
}

export default function EmptyState({ icon: Icon, message }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {Icon && <Icon className="w-12 h-12 text-[#273C46]/30 mb-4" />}
      <p className="text-[#273C46]/60 text-sm">{message}</p>
    </div>
  )
}
