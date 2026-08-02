import { useState, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, ArrowRight } from 'lucide-react'

export interface Testimonial {
  quote: string
  name: string
  designation: string
  src: string
}

interface CircularCardsProps {
  testimonials: Testimonial[]
  autoplay?: boolean
}

function calculateGap(width: number) {
  if (width <= 1024) return 60
  if (width >= 1456) return Math.max(60, 86 + 0.06018 * (width - 1456))
  return 60 + (86 - 60) * ((width - 1024) / (1456 - 1024))
}

export default function CircularCards({ testimonials, autoplay = true }: CircularCardsProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [containerWidth, setContainerWidth] = useState(1200)
  const imageContainerRef = useRef<HTMLDivElement>(null)
  const autoplayRef = useRef<ReturnType<typeof setInterval>>(undefined)

  const len = testimonials.length

  useEffect(() => {
    const handleResize = () => {
      if (imageContainerRef.current) setContainerWidth(imageContainerRef.current.offsetWidth)
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    if (autoplay) {
      autoplayRef.current = setInterval(() => setActiveIndex((p) => (p + 1) % len), 5000)
    }
    return () => { if (autoplayRef.current) clearInterval(autoplayRef.current) }
  }, [autoplay, len])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') setActiveIndex((p) => (p - 1 + len) % len)
      if (e.key === 'ArrowRight') setActiveIndex((p) => (p + 1) % len)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [len])

  const active = useMemo(() => testimonials[activeIndex], [activeIndex, testimonials])

  function getImageStyle(index: number): React.CSSProperties {
    const gap = calculateGap(containerWidth)
    const maxStickUp = gap * 0.8
    const isActive = index === activeIndex
    const isLeft = (activeIndex - 1 + len) % len === index
    const isRight = (activeIndex + 1) % len === index

    if (isActive) {
      return { zIndex: 3, opacity: 1, pointerEvents: 'auto', transform: 'translateX(0px) translateY(0px) scale(1) rotateY(0deg)', transition: 'all 0.8s cubic-bezier(.4,2,.3,1)' }
    }
    if (isLeft) {
      return { zIndex: 2, opacity: 1, pointerEvents: 'auto', transform: `translateX(-${gap}px) translateY(-${maxStickUp}px) scale(0.85) rotateY(15deg)`, transition: 'all 0.8s cubic-bezier(.4,2,.3,1)' }
    }
    if (isRight) {
      return { zIndex: 2, opacity: 1, pointerEvents: 'auto', transform: `translateX(${gap}px) translateY(-${maxStickUp}px) scale(0.85) rotateY(-15deg)`, transition: 'all 0.8s cubic-bezier(.4,2,.3,1)' }
    }
    return { zIndex: 1, opacity: 0, pointerEvents: 'none', transition: 'all 0.8s cubic-bezier(.4,2,.3,1)' }
  }

  const quoteVariants = { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -20 } }

  return (
    <div className="w-full max-w-[56rem] mx-auto px-8">
      <div className="grid md:grid-cols-2 gap-12 items-center">
        {/* Images */}
        <div ref={imageContainerRef} className="relative w-full h-[24rem] [perspective:1000px]">
          {testimonials.map((t) => (
            <img
              key={t.src}
              src={t.src}
              alt={t.name}
              className="absolute w-full h-full object-cover rounded-2xl shadow-lg"
              style={getImageStyle(testimonials.indexOf(t))}
            />
          ))}
        </div>

        {/* Content */}
        <div className="flex flex-col justify-between">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeIndex}
              variants={quoteVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.3, ease: 'easeInOut' }}
            >
              <h3 className="text-[28px] font-bold text-[#051A24] mb-1 font-mondwest">
                {active.name}
              </h3>
              <p className="text-[#273C46] text-base mb-8">{active.designation}</p>
              <motion.p className="text-[#0D212C] text-lg leading-relaxed">
                {active.quote.split('').map((char, i) => (
                  <motion.span
                    key={i}
                    initial={{ filter: 'blur(10px)', opacity: 0, y: 5 }}
                    animate={{ filter: 'blur(0px)', opacity: 1, y: 0 }}
                    transition={{ duration: 0.22, ease: 'easeInOut', delay: 0.015 * i }}
                    style={{ display: 'inline-block' }}
                  >
                    {char === ' ' ? ' ' : char}
                  </motion.span>
                ))}
              </motion.p>
            </motion.div>
          </AnimatePresence>

          {/* Arrow buttons */}
          <div className="flex gap-6 pt-8">
            <button
              className="w-11 h-11 rounded-full bg-[#051A24] flex items-center justify-center hover:bg-[#0D212C] transition-colors"
              onClick={() => { setActiveIndex((p) => (p - 1 + len) % len); if (autoplayRef.current) clearInterval(autoplayRef.current) }}
              aria-label="Previous"
            >
              <ArrowLeft size={18} color="#F6FCFF" />
            </button>
            <button
              className="w-11 h-11 rounded-full bg-[#051A24] flex items-center justify-center hover:bg-[#0D212C] transition-colors"
              onClick={() => { setActiveIndex((p) => (p + 1) % len); if (autoplayRef.current) clearInterval(autoplayRef.current) }}
              aria-label="Next"
            >
              <ArrowRight size={18} color="#F6FCFF" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
