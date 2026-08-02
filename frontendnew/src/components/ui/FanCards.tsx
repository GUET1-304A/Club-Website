import { useState, useEffect, useRef, useCallback } from 'react'
import gsap from 'gsap'

export interface CardItem {
  imgUrl: string
  alt?: string
  linkUrl?: string
  title?: string
  subtitle?: string
  tag?: string
}

interface FanCardsProps {
  cards: CardItem[]
  autoplay?: boolean
  autoplayInterval?: number
}

const MAX_VISIBLE = 7
const HALF = 3

const FAN_POSITIONS = [
  { rot: -21, scale: 0.7756, x: -30, y: 7.3, zIndex: 1 },
  { rot: -14, scale: 0.8498, x: -22, y: 4.0, zIndex: 2 },
  { rot: -7, scale: 0.9346, x: -11, y: 1.3, zIndex: 3 },
  { rot: 0, scale: 1.0, x: 0, y: 0.0, zIndex: 10 },
  { rot: 7, scale: 0.9346, x: 11, y: 1.3, zIndex: 3 },
  { rot: 14, scale: 0.8498, x: 22, y: 4.0, zIndex: 2 },
  { rot: 21, scale: 0.7756, x: 30, y: 7.3, zIndex: 1 },
]

function getResponsiveMultiplier(width: number) {
  if (width < 480) return 0.28
  if (width < 640) return 0.38
  if (width < 768) return 0.5
  if (width < 1024) return 0.75
  return 1.0
}

function getHeightMultiplier(width: number) {
  let idealPx: number
  if (width < 480) idealPx = 22 * 16
  else if (width < 640) idealPx = 26 * 16
  else if (width < 768) idealPx = 28 * 16
  else if (width < 1024) idealPx = 34 * 16
  else idealPx = 38 * 16

  const available = window.innerHeight * 0.7
  if (available >= idealPx) return 1
  return available / idealPx
}

function getSlotConfig(totalCards: number, slot: number) {
  if (totalCards >= MAX_VISIBLE) return FAN_POSITIONS[slot]
  const center = totalCards >> 1
  const distance = totalCards > 1 ? (slot - center) / center : 0
  const absDistance = Math.abs(distance)
  return {
    rot: distance * 21,
    scale: 1.0 - 0.2244 * absDistance * absDistance,
    x: distance * 30,
    y: absDistance * absDistance * 7.3,
    zIndex: 10 - Math.abs(slot - center),
  }
}

const ARROW_CLASSES =
  'relative flex items-center justify-center rounded-full border-[1.5px] border-[rgba(0,0,0,0.1)] bg-[rgba(0,0,0,0.03)] backdrop-blur-[16px] text-[#051A24]/40 cursor-pointer shrink-0 z-30 outline-none shadow-[0_4px_20px_rgba(0,0,0,0.08)] hover:border-[rgba(0,0,0,0.2)] hover:text-[#051A24]/70 active:opacity-70 transition-colors duration-300'

// Card dimensions — responsive
function getCardSize(w: number) {
  if (w < 480) return { w: 140, h: 180 }
  if (w < 768) return { w: 180, h: 230 }
  if (w < 1024) return { w: 220, h: 280 }
  return { w: 260, h: 330 }
}

export default function FanCards({ cards, autoplay = false, autoplayInterval = 4000 }: FanCardsProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const isAnimating = useRef(false)
  const hasEntered = useRef(false)
  const directionRef = useRef<'left' | 'right' | null>(null)
  const prevVisible = useRef<Set<number>>(new Set())
  const [isHovering, setIsHovering] = useState(false)
  const [cardSize, setCardSize] = useState(() => getCardSize(window.innerWidth))

  const totalCards = cards.length
  const needsPagination = totalCards > MAX_VISIBLE
  const [centerIndex, setCenterIndex] = useState(
    needsPagination ? HALF : totalCards >> 1
  )

  // Responsive card size
  useEffect(() => {
    const onResize = () => setCardSize(getCardSize(window.innerWidth))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const getVisibleMap = useCallback(
    (center: number) => {
      const map = new Map<number, number>()
      if (!needsPagination) {
        cards.forEach((_, i) => map.set(i, i))
        return map
      }
      for (let slot = 0; slot < MAX_VISIBLE; slot++) {
        map.set(
          ((center + slot - HALF) % totalCards + totalCards) % totalCards,
          slot
        )
      }
      return map
    },
    [totalCards, needsPagination, cards]
  )

  const cycle = useCallback(
    (direction: 'left' | 'right') => {
      if (isAnimating.current || !needsPagination) return
      isAnimating.current = true
      directionRef.current = direction
      setCenterIndex((prev) =>
        direction === 'right'
          ? (prev + 1) % totalCards
          : (prev - 1 + totalCards) % totalCards
      )
    },
    [totalCards, needsPagination]
  )

  // Autoplay timer
  useEffect(() => {
    if (!autoplay || !needsPagination || isHovering) return
    const timer = setInterval(() => cycle('right'), autoplayInterval)
    return () => clearInterval(timer)
  }, [autoplay, needsPagination, isHovering, autoplayInterval, cycle])

  useEffect(() => {
    const container = containerRef.current
    if (!container || !totalCards) return

    const cardElements = Array.from(
      container.querySelectorAll<HTMLElement>('.fan-card')
    )
    if (!cardElements.length) return

    const visibleMap = getVisibleMap(centerIndex)
    const previouslyVisible = prevVisible.current
    const direction = directionRef.current
    const isFirstMount = !hasEntered.current
    const multiplier = getResponsiveMultiplier(window.innerWidth)
    const hMult = getHeightMultiplier(window.innerWidth)
    const slotCount = needsPagination ? MAX_VISIBLE : totalCards
    const config = (slot: number) => getSlotConfig(slotCount, slot)

    if (isFirstMount) isAnimating.current = true

    let completedCount = 0
    const visibleCount = visibleMap.size
    const onCardDone = () => {
      if (++completedCount >= visibleCount) {
        isAnimating.current = false
        if (isFirstMount) hasEntered.current = true
      }
    }

    cardElements.forEach((card, cardIndex) => {
      const slot = visibleMap.get(cardIndex)
      const wasVisible = previouslyVisible.has(cardIndex)

      if (slot !== undefined) {
        const { x, y, rot, scale, zIndex } = config(slot)
        const target = {
          x: `${x * multiplier}rem`,
          y: `${y * hMult}rem`,
          rotation: rot,
          scale,
          opacity: 1,
          zIndex,
        }

        if (isFirstMount) {
          gsap.set(card, {
            x: 0,
            y: `${12 * hMult}rem`,
            rotation: 0,
            scale: 0.5,
            opacity: 0,
          })
          gsap.to(card, {
            ...target,
            duration: 1.2,
            ease: 'elastic.out(1.05,.78)',
            delay: 0.2 + slot * 0.06,
            onComplete: onCardDone,
          })
        } else if (!wasVisible) {
          const enterX = direction === 'right' ? 40 : -40
          gsap.set(card, {
            x: `${enterX}rem`,
            y: `${y * hMult}rem`,
            rotation: direction === 'right' ? 30 : -30,
            scale: 0.5,
            opacity: 0,
          })
          gsap.to(card, {
            ...target,
            duration: 0.6,
            ease: 'power2.out',
            onComplete: onCardDone,
          })
        } else {
          gsap.to(card, {
            ...target,
            duration: 0.5,
            ease: 'power2.out',
            onComplete: onCardDone,
          })
        }
      } else if (wasVisible) {
        const exitX = direction === 'right' ? -40 : 40
        gsap.to(card, {
          x: `${exitX}rem`,
          opacity: 0,
          scale: 0.5,
          rotation: direction === 'right' ? -30 : 30,
          duration: 0.4,
          ease: 'power2.in',
          zIndex: 0,
        })
      } else if (isFirstMount) {
        gsap.set(card, { opacity: 0, scale: 0.3, x: 0, y: 0, zIndex: 0 })
      }
    })

    prevVisible.current = new Set(visibleMap.keys())

    // === Hover interactions ===
    const visibleEntries: { el: HTMLElement; slot: number }[] = []
    cardElements.forEach((el, i) => {
      const slot = visibleMap.get(i)
      if (slot !== undefined) visibleEntries.push({ el, slot })
    })
    visibleEntries.sort((a, b) => a.slot - b.slot)

    let activeSlot: number | null = null
    let leaveTimer: ReturnType<typeof setTimeout> | null = null
    const centerSlot = visibleEntries.length >> 1

    const updateHoverLayout = (hoveredSlot: number | null) => {
      const mult = getResponsiveMultiplier(window.innerWidth)
      const hM = getHeightMultiplier(window.innerWidth)

      visibleEntries.forEach(({ el, slot }) => {
        const base = config(slot)
        let targetX = base.x * mult
        let targetY = base.y * hM
        let targetRot = base.rot
        let targetScale = base.scale
        let delay = 0

        if (hoveredSlot !== null) {
          const distance = Math.abs(slot - hoveredSlot)
          delay = distance * 0.02

          if (slot === hoveredSlot) {
            targetY -= 2.5 * hM
            targetScale *= 1.08
          } else {
            const normalized =
              centerSlot > 0 ? (slot - centerSlot) / centerSlot : 0
            const pushStrength =
              8 *
              (1 - Math.abs(normalized)) *
              (1 + 0.2 * Math.max(0, 3 - distance))

            if (slot < hoveredSlot) {
              targetX -= pushStrength * mult
              targetRot -= 3 / (distance + 1)
            } else {
              targetX += pushStrength * mult
              targetRot += 3 / (distance + 1)
            }
          }
        } else {
          delay = Math.abs(slot - centerSlot) * 0.02
        }

        gsap.to(el, {
          x: `${targetX}rem`,
          y: `${targetY}rem`,
          rotation: targetRot,
          scale: targetScale,
          duration: 0.5,
          delay,
          ease: 'elastic.out(1,.75)',
          overwrite: 'auto',
        })
        gsap.set(el, { zIndex: base.zIndex })
      })
    }

    const enterHandlers = visibleEntries.map(({ el, slot }) => {
      const handler = () => {
        if (isAnimating.current) return
        if (leaveTimer) {
          clearTimeout(leaveTimer)
          leaveTimer = null
        }
        if (activeSlot !== slot) {
          activeSlot = slot
          updateHoverLayout(slot)
        }
      }
      el.addEventListener('mouseenter', handler)
      return { el, handler }
    })

    const onMouseLeave = () => {
      if (isAnimating.current) return
      if (leaveTimer) clearTimeout(leaveTimer)
      leaveTimer = setTimeout(() => {
        activeSlot = null
        updateHoverLayout(null)
      }, 50)
    }
    container.addEventListener('mouseleave', onMouseLeave)

    const onResize = () => {
      if (!isAnimating.current) updateHoverLayout(activeSlot)
    }
    window.addEventListener('resize', onResize)

    return () => {
      enterHandlers.forEach(({ el, handler }) =>
        el.removeEventListener('mouseenter', handler)
      )
      container.removeEventListener('mouseleave', onMouseLeave)
      window.removeEventListener('resize', onResize)
      if (leaveTimer) clearTimeout(leaveTimer)
    }
  }, [centerIndex, totalCards, getVisibleMap, needsPagination])

  if (!totalCards) return null

  const { w, h } = cardSize

  const chevron = (dir: 'left' | 'right') => (
    <svg
      className="relative z-[2] w-4 h-4 md:w-5 md:h-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline
        points={
          dir === 'left' ? '15 18 9 12 15 6' : '9 18 15 12 9 6'
        }
      />
    </svg>
  )

  return (
    <div
      className="flex flex-col items-center w-full"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {/* Fan container */}
      <div className="flex items-center justify-center w-full">
        <div
          ref={containerRef}
          className="fan-layout flex relative justify-center items-center w-full overflow-visible"
          style={{ height: `${h * 2.0}px`, maxHeight: '620px' }}
        >
          {cards.map((card, index) => {
            const image = (
              <div
                className="relative overflow-hidden rounded-2xl shadow-lg group"
                style={{ width: `${w}px`, height: `${h}px` }}
              >
                <img
                  src={card.imgUrl}
                  loading="lazy"
                  alt={card.alt || `Card ${index}`}
                  className="absolute inset-0 w-full h-full object-cover"
                />
                {/* Content overlay — visible on center card, on hover for others */}
                {(card.title || card.subtitle || card.tag) && (
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#051A24]/90 via-[#051A24]/50 to-transparent p-4 pt-10">
                    {card.tag && (
                      <span className="inline-block text-[10px] font-mono text-white/70 bg-white/10 rounded-full px-2 py-0.5 mb-1">
                        {card.tag}
                      </span>
                    )}
                    {card.title && (
                      <p className="text-white text-sm font-medium leading-tight">{card.title}</p>
                    )}
                    {card.subtitle && (
                      <p className="text-white/60 text-xs mt-0.5">{card.subtitle}</p>
                    )}
                  </div>
                )}
              </div>
            )
            const cardClasses =
              'fan-card absolute top-1/2 left-1/2'
            return card.linkUrl ? (
              <a
                key={index}
                href={card.linkUrl}
                target={card.linkUrl.startsWith('http') ? '_blank' : '_self'}
                rel="noopener noreferrer"
                className={cardClasses}
              >
                {image}
              </a>
            ) : (
              <div key={index} className={cardClasses}>
                {image}
              </div>
            )
          })}
        </div>
      </div>

      {/* Pagination controls */}
      {needsPagination && (
        <div className="flex items-center justify-center gap-4 mt-4 z-30">
          <button
            className={`${ARROW_CLASSES} w-10 h-10 md:w-12 md:h-12`}
            onClick={() => cycle('left')}
            aria-label="Previous"
          >
            {chevron('left')}
          </button>
          <div className="flex items-center gap-2">
            {cards.map((_, i) => (
              <span
                key={i}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  i === centerIndex
                    ? 'bg-[#051A24]/70 scale-[1.3]'
                    : 'bg-[#051A24]/15'
                }`}
              />
            ))}
          </div>
          <button
            className={`${ARROW_CLASSES} w-10 h-10 md:w-12 md:h-12`}
            onClick={() => cycle('right')}
            aria-label="Next"
          >
            {chevron('right')}
          </button>
        </div>
      )}
    </div>
  )
}
