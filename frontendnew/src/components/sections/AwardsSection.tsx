import { useInViewAnimation } from '../../hooks/useInViewAnimation'
import Button from '../ui/Button'
import FanCards from '../ui/FanCards'
import { useSiteData } from '../../store/useSiteData'
import { thumbUrl } from '../../lib/ossImage'
import type { CardItem } from '../ui/FanCards'
import { renderRichText } from '../../lib/richText'

// Award cover images using Unsplash
const awardCovers = [
  'https://images.unsplash.com/photo-1567427017947-545c5f8d16ad?w=400&q=80',
  'https://images.unsplash.com/photo-1554475901-4538ddfbccc2?w=400&q=80',
  'https://images.unsplash.com/photo-1544928147-79a2dbc1f389?w=400&q=80',
  'https://images.unsplash.com/photo-1492725764893-90b379c2b6e7?w=400&q=80',
]

const levelLabels: Record<string, string> = {
  national: '国家级', provincial: '省级', school: '校级', other: '其他',
}

export default function AwardsSection() {
  const { ref, isInView } = useInViewAnimation({ threshold: 0.05 })
  const { awards, config } = useSiteData()

  const awardCards: CardItem[] = awards.map((a, i) => ({
    imgUrl: thumbUrl(a.certificateImages[0]) || awardCovers[i % awardCovers.length],
    alt: a.name,
    linkUrl: `/award/${a.slug}`,
    title: a.name,
    subtitle: `${a.winner} · ${a.date}`,
    tag: levelLabels[a.level] || a.level,
  }))

  return (
    <section ref={ref} className="max-w-[1400px] mx-auto px-6 py-20 md:py-28">
      {/* Header — left aligned */}
      <div className="mb-6 pl-4 md:pl-12">
        <p
          className={`font-mono text-sm text-[#051A24] tracking-widest uppercase mb-4 ${
            isInView ? 'animate-fade-in-up delay-100' : 'opacity-0'
          }`}
        >
          {config.awardsEyebrow}
        </p>
        <h2
          className={`text-[28px] md:text-[36px] text-[#051A24] ${
            isInView ? 'animate-fade-in-up delay-200' : 'opacity-0'
          }`}
        >
          {renderRichText(config.awardsTitle)}
        </h2>
      </div>

      {/* Fan card carousel */}
      <FanCards cards={awardCards} autoplay={true} />

      {/* CTA */}
      <div className="text-center mt-6">
        <Button variant="tertiary" href="/awards">
          {config.awardsCta}
        </Button>
      </div>
    </section>
  )
}
