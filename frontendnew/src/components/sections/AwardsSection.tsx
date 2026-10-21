import { lazy, Suspense } from 'react'
import { useInViewAnimation } from '../../hooks/useInViewAnimation'
import Button from '../ui/Button'
import { useSiteData } from '../../store/useSiteData'
import { thumbUrl } from '../../lib/ossImage'
import type { LandPalette, Slide } from '../ui/polaroid-line-carousel'
import { renderRichText } from '../../lib/richText'

const PolaroidLineCarousel = lazy(() => import('../ui/polaroid-line-carousel'))
const palettes: LandPalette[] = ['dawn', 'alpine', 'dusk', 'mist']

const levelLabels: Record<string, string> = {
  national: '国家级', provincial: '省级', school: '校级', other: '其他',
}

export default function AwardsSection() {
  const { ref, isInView } = useInViewAnimation({ threshold: 0.05 })
  const { awards, config } = useSiteData()

  const slides: Slide[] = awards.map((a, i) => ({
    image: thumbUrl(a.certificateImages[0]) || undefined,
    alt: a.name,
    title: a.name,
    caption: [levelLabels[a.level] || a.level, a.winner, a.date].filter(Boolean).join(' · '),
    href: `/award/${a.slug}`,
    palette: palettes[i % palettes.length],
    seed: i + 1,
  }))

  return (
    <section ref={ref} className="w-full py-20 md:py-28">
      {/* Header — left aligned */}
      <div className="mx-auto mb-6 max-w-[1400px] px-10 md:px-[72px]">
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

      {slides.length > 0 ? (
        <Suspense fallback={<div className="h-[540px]" />}>
          <PolaroidLineCarousel
            key={awards.map(a => a.id).join(',')}
            slides={slides}
            height="clamp(540px, 55vw, 650px)"
            cardWidth={300}
            background="var(--award-carousel-bg)"
            ink="var(--award-carousel-ink)"
            string="var(--award-carousel-string)"
            className="award-polaroid"
            ariaLabel="奖项照片轮播"
          />
        </Suspense>
      ) : (
        <p className="py-16 text-center text-sm text-[#273C46]/60">奖项整理中，敬请期待。</p>
      )}

      {/* CTA */}
      <div className="text-center mt-6">
        <Button variant="tertiary" href="/awards">
          {config.awardsCta}
        </Button>
      </div>
    </section>
  )
}
