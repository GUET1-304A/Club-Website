import { useInViewAnimation } from '../../hooks/useInViewAnimation'
import CountUp from '../effects/CountUp'
import Card from '../ui/Card'
import { useSiteData } from '../../store/useSiteData'
import { renderRichText } from '../../lib/richText'

export default function AboutSection() {
  const { ref, isInView } = useInViewAnimation({ threshold: 0.15 })
  const { config } = useSiteData(['config'])

  return (
    <section ref={ref} className="site-container home-section">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        {/* Left - Text slides in from left */}
        <div className={isInView ? 'animate-slide-in-left' : 'opacity-0'}>
          <p className="font-mono text-sm text-[#051A24] tracking-widest uppercase mb-4">
            ABOUT US
          </p>
          <h2 className="text-[28px] md:text-[36px] leading-[1.2] text-[#051A24] tracking-tight">
            {renderRichText(config.aboutTitle)}
          </h2>
          <p className="text-sm md:text-base text-[#0D212C] leading-relaxed mt-5">
            {config.aboutDescription}
          </p>
          {config.aboutExtra && (
            <p className="text-sm md:text-base text-[#0D212C] leading-relaxed mt-3">
              {config.aboutExtra}
            </p>
          )}

          {/* Stats */}
          <div className="flex gap-10 mt-8">
            {config.stats.map((stat) => (
              <div key={stat.label}>
                <div className="text-[28px] font-medium text-[#051A24]">
                  {isInView && <CountUp end={stat.value} suffix={stat.suffix} />}
                  {!isInView && '0'}
                </div>
                <div className="text-xs text-[#273C46] mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right - Image slides in from right */}
        <div className={isInView ? 'animate-slide-in-right' : 'opacity-0'}>
          <Card hover={false} className="overflow-hidden p-2">
            <img
              src={config.aboutImage}
              alt="星雨作坊成员围桌开发项目"
              className="w-full rounded-[24px] md:rounded-[32px] object-cover aspect-video"
              loading="lazy"
            />
          </Card>
        </div>
      </div>
    </section>
  )
}
