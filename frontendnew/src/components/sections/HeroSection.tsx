import { useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import Button from '../ui/Button'

export default function HeroSection() {
  const [isVisible, setIsVisible] = useState(false)

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
          XINGYU STUDIO
        </p>

        {/* Title */}
        <h1
          className={`text-[40px] md:text-[52px] lg:text-[60px] leading-[1.15] text-[#051A24] tracking-tight mb-12 ${fadeClass('delay-200')}`}
        >
          把灵感变成<span className="font-mondwest">作品</span>，
          <br />
          把热爱做成<span className="font-mondwest">长效主义</span>。
        </h1>

        {/* Description */}
        <div className={`flex flex-col gap-8 max-w-[480px] mx-auto mb-14 ${fadeClass('delay-300')}`}>
          <p className="text-base md:text-lg text-[#0D212C] leading-relaxed">
            星雨作坊是一个面向产品、设计与技术协作的校园创意社团。我们围绕真实项目进行学习、共创和开源。
          </p>
          <p className="text-base md:text-lg text-[#0D212C] leading-relaxed">
            把想法一步步做成可被看见、可被使用、可持续迭代的作品。
          </p>
        </div>

        {/* Buttons */}
        <div className={`flex flex-col sm:flex-row gap-3 md:gap-4 justify-center ${fadeClass('delay-400')}`}>
          <Button variant="primary" href="/about">
            了解我们
          </Button>
          <Button variant="secondary" href="/join">
            加入社团
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
