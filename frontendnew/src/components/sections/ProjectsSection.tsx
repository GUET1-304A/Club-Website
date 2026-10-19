import { useInViewAnimation } from '../../hooks/useInViewAnimation'
import Button from '../ui/Button'
import { useSiteData } from '../../store/useSiteData'
import { renderRichText } from '../../lib/richText'
import KeycapOrb, { type Keycap, type KeycapFinish } from '../ui/keycap-orb'

const FINISHES: KeycapFinish[] = ['cobalt', 'ink', 'glass', 'ash', 'lime', 'ash']

/** 键帽上的短标签：中文取 2 字，英文最多 4 个字母。 */
function shortLabel(name: string): string {
  const cleaned = name.replace(/^AI/i, '').replace(/[\s\-_&·，,。.]/g, '')
  const ascii = /^[\x20-\x7e]+$/.test(cleaned)
  return ascii ? cleaned.slice(0, 4).toUpperCase() : cleaned.slice(0, 2)
}

export default function ProjectsSection() {
  const { ref, isInView } = useInViewAnimation({ threshold: 0.05 })
  const { config, projects } = useSiteData()

  const keys: Keycap[] = projects.map((project, index) => ({
    label: shortLabel(project.name),
    finish: FINISHES[index % FINISHES.length],
    hotkey: `project-${index}`,
  }))

  const openProject = (key: Keycap) => {
    const index = Number((key.hotkey || '').replace('project-', ''))
    const target = projects[index]
    if (!target) return
    window.history.pushState({}, '', `/project/${target.slug}`)
    window.dispatchEvent(new PopStateEvent('popstate'))
    window.scrollTo({ top: 0 })
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
          <div className="relative mt-6 rounded-[36px] overflow-hidden border border-[#051A24]/10 shadow-[0_30px_80px_-30px_rgba(5,26,36,0.45)]">
            <KeycapOrb
              keys={keys}
              rings={9}
              scale={0.75}
              height="clamp(420px, 58vw, 620px)"
              background="#051A24"
              glow="#3457ff"
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
            />
            <p className="pointer-events-none absolute bottom-5 left-0 right-0 text-center text-xs text-white/45">
              拖动旋转 · 点击键帽进入项目详情
            </p>
          </div>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {projects.map((project, index) => (
              <a
                key={project.id}
                href={`/project/${project.slug}`}
                className="group inline-flex items-center gap-2 rounded-full border border-[#051A24]/10 bg-white/80 px-3 py-1.5 text-xs text-[#273C46] shadow-sm backdrop-blur-sm hover:border-[#051A24]/30 hover:bg-white transition-colors"
              >
                <span className="font-mono text-[10px] tracking-wider text-[#051A24]/45 group-hover:text-[#051A24]">
                  {keys[index]?.label}
                </span>
                {project.name}
              </a>
            ))}
          </div>
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
