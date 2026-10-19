import { useInViewAnimation } from '../../hooks/useInViewAnimation'
import Button from '../ui/Button'
import LunarBoardingPass from '../ui/lunar-boarding-pass'
import { useSiteData } from '../../store/useSiteData'
import { renderRichText } from '../../lib/richText'
import { Users, Code, Rocket, Heart } from 'lucide-react'

const benefits = [
  { icon: Code, title: '实战项目', desc: '参与真实项目，积累作品集，不再只做课堂作业' },
  { icon: Users, title: '团队协作', desc: '和志同道合的伙伴一起成长，体验真实开发流程' },
  { icon: Rocket, title: '技术提升', desc: '定期技术分享 + 导师指导，快速突破瓶颈' },
  { icon: Heart, title: '温暖社群', desc: '不止是技术，这里有一群懂你的朋友' },
]

export default function JoinSection() {
  const { ref, isInView } = useInViewAnimation({ threshold: 0.05 })
  const { config } = useSiteData()

  return (
    <section ref={ref} className="relative z-10 py-24 md:py-32">
      <div className="max-w-[1000px] mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-10 md:mb-12">
          <p className="font-mono text-sm text-[#051A24] tracking-widest uppercase mb-4">
            {config.joinEyebrow}
          </p>
          <h2 className="text-[28px] md:text-[36px] text-[#051A24] leading-[1.15] tracking-tight">
            {renderRichText(config.joinTitle)}
          </h2>
          <p className="text-sm md:text-base text-[#273C46] leading-relaxed max-w-2xl mx-auto mt-4">
            {config.joinCtaDescription}
          </p>
        </div>

        {/* Boarding pass */}
        <div className={isInView ? 'animate-fade-in-up delay-100' : 'opacity-0'}>
          <div className="hidden md:block">
            <LunarBoardingPass
              title={config.siteName}
              tier="CREW"
              date="2026"
              welcome={'加入我们\n一起造点东西'}
              eyebrow={'A pass to\nbuild real things'}
              words={['Build', 'Together']}
              notes={['学生开发者社群 · 长期招新', '前端 / 后端 / 设计 / 算法 / 产品']}
              passenger="YOUR NAME"
              from="CAMPUS"
              to="XINGYU"
              craft="STUDIO-01"
              dateCode="OPEN2026"
              gate="A1"
              group="CREW"
              seat="01"
              boardingTime="ANYTIME"
              site="GUILIN"
              lat={25.2736}
              lon={110.29}
              seq=""
              featuring="前端 · 后端 · 设计 · 算法 · 产品"
              headline="Join the crew"
              stamp="WELCOME"
              sideLabels={['成员凭证', '加入须知']}
              night="#051A24"
              starInk="#e8eef2"
              paper="#f0ece6"
              paperInk="#0d212c"
              stampColor="#3457ff"
              maxWidth={960}
            />
          </div>

          {/* Mobile: a compact version of the same ticket */}
          <div className="md:hidden relative overflow-hidden rounded-[28px] bg-[#051A24] text-[#F6FCFF] px-6 py-7 shadow-xl">
            <div className="flex items-center justify-between font-mono text-[10px] tracking-[0.24em] text-white/45 uppercase">
              <span>{config.siteName}</span>
              <span>CREW PASS</span>
            </div>
            <p className="mt-10 text-[32px] leading-[1.05] tracking-tight">
              加入我们
              <br />
              一起造点东西
            </p>
            <div className="mt-8 grid grid-cols-3 gap-3 border-t border-dashed border-white/20 pt-5 font-mono text-[10px] uppercase tracking-widest text-white/40">
              <div><span className="block text-white/30">From</span>CAMPUS</div>
              <div><span className="block text-white/30">To</span>XINGYU</div>
              <div><span className="block text-white/30">Gate</span>A1</div>
            </div>
            <p className="mt-5 text-[11px] leading-relaxed text-white/50">
              学生开发者社群 · 长期招新
              <br />
              前端 / 后端 / 设计 / 算法 / 产品
            </p>
            <Button variant="secondary" href="/join" className="w-full mt-6">
              {config.joinCtaButton}
            </Button>
          </div>
        </div>

        {/* Benefits */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-12 md:mt-14">
          {benefits.map((benefit) => {
            const Icon = benefit.icon
            return (
              <div key={benefit.title} className="rounded-[24px] bg-white/70 backdrop-blur-sm border border-[#051A24]/8 p-5">
                <div className="w-9 h-9 rounded-xl bg-[#051A24]/5 flex items-center justify-center mb-4">
                  <Icon className="w-4.5 h-4.5 text-[#051A24]" strokeWidth={1.5} />
                </div>
                <h3 className="text-sm font-medium text-[#051A24]">{benefit.title}</h3>
                <p className="text-xs text-[#273C46] leading-relaxed mt-1.5">{benefit.desc}</p>
              </div>
            )
          })}
        </div>

        {/* CTA */}
        <div className="text-center mt-10">
          <Button variant="primary" size="lg" href="/join">
            {config.joinCtaButton}
          </Button>
        </div>
      </div>
    </section>
  )
}
