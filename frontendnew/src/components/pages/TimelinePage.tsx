import { useInViewAnimation } from '../../hooks/useInViewAnimation'
import Card from '../ui/Card'
import { useSiteData } from '../../store/useSiteData'
import { renderRichText } from '../../lib/richText'

export default function TimelinePage() {
  const { ref, isInView } = useInViewAnimation({ threshold: 0.05 })
  const { config } = useSiteData()
  const events = config.timelineEvents

  return (
    <div ref={ref} className="page-enter max-w-[700px] mx-auto px-6 py-24">
      <h1 className="text-[36px] md:text-[44px] font-medium text-[#051A24] text-center mb-16">
        {renderRichText(config.timelineTitle)}
      </h1>

      {config.timelineIntro && (
        <p className="text-center text-sm md:text-base text-[#273C46] leading-relaxed -mt-8 mb-16 max-w-lg mx-auto">
          {config.timelineIntro}
        </p>
      )}

      {events.length === 0 && (
        <p className="text-center text-sm text-[#273C46]/50 py-16">时间线内容正在整理中。</p>
      )}

      {events.length > 0 && <div className="relative">
        {/* Center line */}
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-[rgba(0,0,0,0.08)]" />

        <div className="flex flex-col gap-12">
          {events.map((evt, i) => {
            const isLeft = i % 2 === 0
            return (
              <div key={i} className={`relative flex items-center ${isLeft ? 'flex-row' : 'flex-row-reverse'}`}>
                {/* Dot */}
                <div className="absolute left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-[#051A24] z-10" />
                {/* Card */}
                <div className={`w-[calc(50%-24px)] ${isInView ? `animate-slide-in-${isLeft ? 'left' : 'right'} delay-${(i + 1) * 100}` : 'opacity-0'}`}>
                  <Card className="p-5 !rounded-[24px]">
                    <span className="text-xs text-[#273C46]/60">{evt.date}</span>
                    <h3 className="font-medium text-[#051A24] mt-1">{evt.title}</h3>
                    <p className="text-sm text-[#273C46] mt-1">{evt.description}</p>
                  </Card>
                </div>
                <div className="w-[calc(50%-24px)]" />
              </div>
            )
          })}
        </div>
      </div>}
    </div>
  )
}
