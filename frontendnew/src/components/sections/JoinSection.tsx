import { useRef } from 'react'
import { useInViewAnimation } from '../../hooks/useInViewAnimation'
import Button from '../ui/Button'
import { useSiteData } from '../../store/useSiteData'
import { renderRichText } from '../../lib/richText'
import { Users, Code, Rocket, Heart } from 'lucide-react'

const benefits = [
  { icon: Code, title: '实战项目', desc: '参与真实项目，积累作品集，不再只做课堂作业' },
  { icon: Users, title: '团队协作', desc: '和志同道合的伙伴一起成长，体验真实开发流程' },
  { icon: Rocket, title: '技术提升', desc: '定期技术分享 + 导师指导，快速突破瓶颈' },
  { icon: Heart, title: '温暖社群', desc: '不止是技术，这里有一群懂你的朋友' },
]

function createSpawner(thumbnails: string[]) {
  let lastSpawn = 0
  return (container: HTMLDivElement | null, particlesEl: HTMLDivElement | null, clientX: number, clientY: number) => {
    if (!container || !particlesEl) return
    const now = performance.now()
    if (now - lastSpawn < 80) return
    lastSpawn = now
    const rect = container.getBoundingClientRect()
    const x = clientX - rect.left
    const y = clientY - rect.top
    const src = thumbnails[Math.floor(Math.random() * thumbnails.length)]
    const rotation = (Math.random() - 0.5) * 20
    const el = document.createElement('img')
    el.src = src
    el.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:40px;height:40px;border-radius:8px;object-fit:cover;box-shadow:0 4px 12px rgba(0,0,0,0.15);pointer-events:none;transform:translate(-50%,-50%) rotate(${rotation}deg) scale(1);opacity:1;`
    const animation = el.animate(
      [
        { transform: `translate(-50%,-50%) rotate(${rotation}deg) scale(1)`, opacity: '1' },
        { transform: `translate(-50%,-50%) rotate(${rotation}deg) scale(0)`, opacity: '0' },
      ],
      { duration: 1000, easing: 'ease-out', fill: 'forwards' }
    )
    animation.addEventListener('finish', () => el.remove(), { once: true })
    particlesEl.appendChild(el)
  }
}

export default function JoinSection() {
  const { ref, isInView } = useInViewAnimation({ threshold: 0.1 })
  const { projects, members, config } = useSiteData()
  const thumbnails = [...projects.map((p) => p.coverImage), ...members.map((m) => m.avatar)]
  // Left card refs
  const leftCardRef = useRef<HTMLDivElement>(null)
  const leftParticlesRef = useRef<HTMLDivElement>(null)
  const spawnLeft = useRef(createSpawner(thumbnails)).current
  // Right card refs
  const rightCardRef = useRef<HTMLDivElement>(null)
  const rightParticlesRef = useRef<HTMLDivElement>(null)
  const spawnRight = useRef(createSpawner(thumbnails)).current

  return (
    <section ref={ref} className="relative z-10 py-24 md:py-36">
      <div className="max-w-[1200px] mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
          {/* ===== Left — Benefits ===== */}
          <div className={isInView ? 'animate-slide-in-left' : 'opacity-0'}>
            <div ref={leftCardRef} className="rounded-[40px] bg-white shadow-lg p-10 md:p-14 h-full relative overflow-hidden">
              <div ref={leftParticlesRef} className="absolute inset-0 pointer-events-none" style={{ zIndex: 20 }} />
              <div
                className="relative z-10"
                onMouseMove={(e) => spawnLeft(leftCardRef.current, leftParticlesRef.current, e.clientX, e.clientY)}
              >
              <p className="font-mono text-sm text-[#051A24] tracking-widest uppercase mb-4">
                {config.joinEyebrow}
              </p>
              <h2 className="join-display text-[30px] md:text-[38px] text-[#051A24] leading-[1.15] tracking-[0.035em] mb-10">
                {renderRichText(config.joinTitle)}
              </h2>

              <div className="space-y-6">
                {benefits.map((b, i) => {
                  const Icon = b.icon
                  return (
                    <div key={i} className="flex gap-4 items-start group">
                      <div className="w-10 h-10 rounded-xl bg-[#051A24]/5 flex items-center justify-center shrink-0 group-hover:bg-[#051A24] transition-colors duration-300">
                        <Icon className="w-5 h-5 text-[#051A24] group-hover:text-white transition-colors duration-300" strokeWidth={1.5} />
                      </div>
                      <div>
                        <h3 className="font-ticket-cn text-[17px] tracking-[0.04em] text-[#051A24]">{b.title}</h3>
                        <p className="text-sm text-[#273C46] mt-1 leading-relaxed">{b.desc}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
            </div>
          </div>

          {/* ===== Right — CTA with particles ===== */}
          <div className={isInView ? 'animate-slide-in-right' : 'opacity-0'}>
            <div ref={rightCardRef} className="rounded-[40px] bg-[#051A24] shadow-xl overflow-hidden h-full flex flex-col justify-center relative">
              <div ref={rightParticlesRef} className="absolute inset-0 pointer-events-none" style={{ zIndex: 20 }} />
              <div
                className="px-10 md:px-14 py-20 md:py-28 text-center cursor-default relative z-10"
                onMouseMove={(e) => spawnRight(rightCardRef.current, rightParticlesRef.current, e.clientX, e.clientY)}
              >
                {/* Decorative top highlight */}
                <div className="absolute top-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

                <p className="font-mono text-xs text-[#E0EBF0]/60 tracking-widest uppercase mb-6">
                  {config.joinCtaEyebrow}
                </p>
                <h2 className="join-display text-[42px] md:text-[54px] lg:text-[62px] text-[#F6FCFF] leading-[1.05] tracking-[0.045em] mb-6">
                  {renderRichText(config.joinCtaTitle)}
                </h2>
                <p className="text-sm md:text-base text-[#E0EBF0]/70 max-w-sm mx-auto leading-relaxed mb-10">
                  {config.joinCtaDescription}
                </p>
                <Button variant="secondary" size="lg" href="/join" className="font-ticket-cn tracking-[0.08em]">
                  {config.joinCtaButton}
                </Button>

                {/* Bottom glow */}
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-48 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
