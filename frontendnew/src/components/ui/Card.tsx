import type { ReactNode, HTMLAttributes } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  variant?: 'default' | 'dark'
  hover?: boolean
  className?: string
}

export default function Card({
  children,
  variant = 'default',
  hover = true,
  className = '',
  ...props
}: CardProps) {
  const base = variant === 'dark' ? 'card-dark' : 'card'
  const hoverClass = hover ? '' : ''
  return (
    <div className={`${base} ${hoverClass} ${className}`.trim()} {...props}>
      {children}
    </div>
  )
}
