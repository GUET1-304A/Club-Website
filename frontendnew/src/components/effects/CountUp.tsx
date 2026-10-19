import { useCountUp } from '../../hooks/useCountUp'

interface CountUpProps {
  end: number
  duration?: number
  suffix?: string
  prefix?: string
  className?: string
}

export default function CountUp({
  end,
  duration = 2000,
  suffix = '',
  prefix = '',
  className = '',
}: CountUpProps) {
  const value = useCountUp(end, duration)

  return (
    <span className={className} style={{ fontFamily: 'var(--font-accent)' }}>
      {prefix}
      {value}
      {suffix}
    </span>
  )
}
