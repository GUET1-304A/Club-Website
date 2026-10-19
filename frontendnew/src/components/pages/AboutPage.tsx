import { useInViewAnimation } from '../../hooks/useInViewAnimation'
import Divider from '../ui/Divider'
import { useSiteData } from '../../store/useSiteData'

export default function AboutPage() {
  const { ref, isInView } = useInViewAnimation({ threshold: 0.1 })
  const { config } = useSiteData()
  const stats = config.stats

  return (
    <div ref={ref} className="page-enter max-w-[900px] mx-auto px-6 py-24">
      <h1 className="text-[36px] md:text-[44px] font-medium text-[#051A24]">
        关于<span className="font-mondwest">{config.siteName}</span>
      </h1>

      <div className="mt-8 space-y-6 text-sm md:text-base text-[#0D212C] leading-relaxed">
        <p>{config.aboutDescription}</p>
        {config.aboutExtra && <p>{config.aboutExtra}</p>}
      </div>

      <Divider />

      {/* Stats */}
      <div className="flex gap-10 justify-center">
        {stats.map((stat, i) => (
          <div
            key={stat.label}
            className={`text-center ${isInView ? `animate-fade-in-up delay-${(i + 1) * 100}` : 'opacity-0'}`}
          >
            <div className="text-[28px] font-medium text-[#051A24] font-mondwest">
              {stat.value}
              {stat.suffix || ''}
            </div>
            <div className="text-xs text-[#273C46] mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      <Divider />

      {/* Photo wall */}
      <h2 className="text-2xl font-medium text-[#051A24] mb-6">
        <span className="font-mondwest">活动</span>剪影
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {['1522071820081-009f0129c71c', '1517245386807-bb43f82c33c4', '1552664730-d307ca884978', '1523240795612-9a054b0db460', '1531482611025-2d93d9bc2900', '1543269865-cbf427effbad'].map((id) => (
          <img
            key={id}
            src={`https://images.unsplash.com/photo-${id}?w=400&q=80`}
            alt="活动照片"
            className="rounded-2xl object-cover aspect-square hover:scale-[1.02] transition-transform"
            loading="lazy"
          />
        ))}
      </div>
    </div>
  )
}
