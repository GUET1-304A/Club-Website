import { useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import Button from '../ui/Button'
import { useSiteData } from '../../store/useSiteData'
import { renderRichText } from '../../lib/richText'

export default function HeroSection() {
  const [isVisible, setIsVisible] = useState(false)
  const { config } = useSiteData()

  const paragraphs = (config.heroSubtitle || '')
    .split('\n\n')
    .map((item) => item.trim())
    .filter(Boolean)

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100)
    return () => clearTimeout(timer)
  }, [])

  const fadeClass = (delay: string) =>
    isVisible ? `animate-fade-in-up ${delay}` : 'opacity-0'

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Content */}
      <div className="relative max-w-[640px] mx-auto px-6 pt-24 md:pt-32 pb-24 flex flex-col items-center text-center">
        {/* Tag */}
        <p className={`font-mono text-xs md:text-sm text-[#273C46] mb-10 tracking-widest uppercase ${fadeClass('delay-100')}`}>
          {config.heroTagline || 'XINGYU STUDIO'}
        </p>

        {/* Title */}
        <h1
          className={`text-[40px] md:text-[52px] lg:text-[60px] leading-[1.15] text-[#051A24] tracking-tight mb-12 ${fadeClass('delay-200')}`}
        >
          {renderRichText(config.heroTitle)}
        </h1>

        {/* Description */}
        <div className={`flex flex-col gap-8 max-w-[480px] mx-auto mb-14 ${fadeClass('delay-300')}`}>
          {paragraphs.map((paragraph, index) => (
            <p key={index} className="text-base md:text-lg text-[#0D212C] leading-relaxed">
              {paragraph}
            </p>
          ))}
        </div>

        {/* Buttons */}
        <div className={`flex flex-col sm:flex-row gap-3 md:gap-4 justify-center ${fadeClass('delay-400')}`}>
          <Button variant="primary" href={config.heroPrimaryHref || '/about'}>
            {config.heroPrimaryLabel || '了解我们'}
          </Button>
          <Button variant="secondary" href={config.heroSecondaryHref || '/join'}>
            {config.heroSecondaryLabel || '加入社团'}
          </Button>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
        <ChevronDown className="w-6 h-6 text-[#273C46]/40 animate-bounce-arrow" />
      </div>
    </section>
  )
}
