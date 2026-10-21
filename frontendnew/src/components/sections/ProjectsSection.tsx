import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useInViewAnimation } from '../../hooks/useInViewAnimation'
import Button from '../ui/Button'
import { useSiteData } from '../../store/useSiteData'
import { renderRichText } from '../../lib/richText'
import type { Keycap, KeycapFinish } from '../ui/keycap-orb'

const KeycapOrb = lazy(() => import('../ui/keycap-orb'))

const FINISHES: KeycapFinish[] = ['cobalt', 'ink', 'glass', 'ash', 'lime', 'ash']
const PAGE_SIZE = 6

/** 键帽上的短标签：中文取 2 字，英文最多 4 个字母。 */
function shortLabel(name: string): string {
  const cleaned = name.replace(/^AI/i, '').replace(/[\s\-_&·，,。.]/g, '')
  const ascii = /^[\x20-\x7e]+$/.test(cleaned)
  return ascii ? cleaned.slice(0, 4).toUpperCase() : cleaned.slice(0, 2)
}

export default function ProjectsSection() {
  const { ref, isInView } = useInViewAnimation({ threshold: 0.05 })
  const { config, projects } = useSiteData()
  const [page, setPage] = useState(0)
  const [launching, setLaunching] = useState(false)
  const launchTimer = useRef<number | null>(null)
  const pageCount = Math.max(1, Math.ceil(projects.length / PAGE_SIZE))

  useEffect(() => {
    if (page > pageCount - 1) setPage(pageCount - 1)
  }, [page, pageCount])

  useEffect(() => () => {
    if (launchTimer.current) window.clearTimeout(launchTimer.current)
  }, [])

  const pageStart = page * PAGE_SIZE
  const pageProjects = projects.slice(pageStart, pageStart + PAGE_SIZE)

  const keys: Keycap[] = projects.map((project, index) => ({
    label: shortLabel(project.name),
    finish: FINISHES[index % FINISHES.length],
    hotkey: `project-${index}`,
  }))

  const openProject = (key: Keycap) => {
    const index = Number((key.hotkey || '').replace('project-', ''))
    const target = projects[index]
    if (!target || launching) return
    setLaunching(true)
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    launchTimer.current = window.setTimeout(() => {
      window.history.pushState({}, '', `/project/${target.slug}`)
      window.dispatchEvent(new PopStateEvent('popstate'))
      window.scrollTo({ top: 0 })
    }, reduce ? 0 : 600)
  }

  return (
    <section ref={ref} className="max-w-[1100px] mx-auto px-6 py-20 md:py-28">
      {/* Header — left aligned */}
      <div className="mb-2 pl-4 md:pl-12">
        <p
          className={`font-mono text-sm text-[#051A24] tracking-widest uppercase mb-4 ${
            isInView ? 'animate-fade-in-up delay-100' : 'opacity-0'
          }`}
        >
          {config.projectsEyebrow}
        </p>
        <h2
          className={`text-[28px] md:text-[36px] text-[#051A24] ${
            isInView ? 'animate-fade-in-up delay-200' : 'opacity-0'
          }`}
        >
          {renderRichText(config.projectsTitle)}
        </h2>
      </div>

      {/* Keycap orb — each cap is a project */}
      {projects.length > 0 ? (
        <>
          <div className="relative mt-6">
            <div className={`relative transition-all duration-500 ease-out ${launching ? 'opacity-0 scale-105 delay-75' : 'opacity-100 scale-100'}`}>
              <Suspense fallback={<div className="h-[420px] md:h-[580px]" />}><KeycapOrb
                keys={keys}
                rings={9}
                scale={0.75}
                height="clamp(420px, 58vw, 620px)"
                transparent
                glow="#3457ff"
                reflection={false}
                speed={0.8}
                palette={{
                  ink: { cap: '#0d2630', legend: '#dce9ee' },
                  ash: { cap: '#cdd6d9', legend: '#0b2632' },
                  glass: { cap: '#9fb4ff', legend: '#3457ff' },
                  cobalt: { cap: '#2e4bdb', legend: '#0b1a8a' },
                  lime: { cap: '#c8d46a', legend: '#24300a' },
                }}
                onKeyPress={openProject}
                aria-label="作品键帽球：拖动旋转，点击键帽进入项目详情"
              /></Suspense>
              <div
                aria-hidden="true"
                className={`pointer-events-none absolute inset-0 transition-opacity duration-500 ${launching ? 'opacity-100' : 'opacity-0'}`}
                style={{ background: 'radial-gradient(circle at 50% 52%, rgba(52,87,255,0.28) 0%, rgba(52,87,255,0) 62%)' }}
              />
            </div>
            <p className="pointer-events-none absolute bottom-4 left-0 right-0 flex justify-center">
              <span className="rounded-full bg-white/70 px-3 py-1 text-[11px] text-[#051A24]/60 backdrop-blur-sm">
                {launching ? '正在打开…' : '拖动旋转 · 点击键帽进入项目详情'}
              </span>
            </p>
          </div>
          <p className="mt-6 text-center text-sm text-[#273C46] md:hidden">选择作品查看详情</p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
            {pageCount > 1 && (
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="order-2 md:order-none p-3 rounded-full bg-white/70 text-[#051A24]/60 backdrop-blur-sm hover:bg-white disabled:opacity-25 transition-colors shrink-0"
                aria-label="上一页作品"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
            <div className="order-1 grid w-full grid-cols-1 gap-2 sm:grid-cols-2 md:order-none md:flex md:w-auto md:flex-wrap md:justify-center">
              {pageProjects.map((project, index) => (
                <a
                  key={project.id}
                  href={`/project/${project.slug}`}
                  className="group inline-flex min-h-12 items-center gap-2 rounded-xl border border-[#051A24]/10 bg-white/80 px-4 py-2 text-sm text-[#273C46] shadow-sm backdrop-blur-sm hover:border-[#051A24]/30 hover:bg-white transition-colors md:min-h-0 md:rounded-full md:px-3 md:py-1.5 md:text-xs"
                >
                  <span className="font-mono text-[10px] tracking-wider text-[#051A24]/45 group-hover:text-[#051A24]">
                    {keys[pageStart + index]?.label}
                  </span>
                  {project.name}
                </a>
              ))}
            </div>
            {pageCount > 1 && (
              <button
                onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))}
                disabled={page === pageCount - 1}
                className="order-2 md:order-none p-3 rounded-full bg-white/70 text-[#051A24]/60 backdrop-blur-sm hover:bg-white disabled:opacity-25 transition-colors shrink-0"
                aria-label="下一页作品"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
          {pageCount > 1 && (
            <p className="flex justify-center mt-2">
              <span className="rounded-full bg-white/60 px-2 py-0.5 text-[10px] text-[#273C46]/60 backdrop-blur-sm">
                {page + 1} / {pageCount}
              </span>
            </p>
          )}
        </>
      ) : (
        <p className="text-center text-sm text-[#273C46]/50 py-16">作品整理中，敬请期待。</p>
      )}

      {/* CTA */}
      <div className="text-center mt-2">
        <Button variant="tertiary" href="/projects">
          {config.projectsCta}
        </Button>
      </div>
    </section>
  )
}
