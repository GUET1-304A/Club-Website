import { useInViewAnimation } from '../../hooks/useInViewAnimation'
import CountUp from '../effects/CountUp'
import Card from '../ui/Card'
import { useSiteData } from '../../store/useSiteData'

const stats = [
  { label: '成立年份', value: 2020 },
  { label: '成员数', value: 42, suffix: '+' },
  { label: '获奖数', value: 28, suffix: '+' },
  { label: '项目数', value: 36, suffix: '+' },
]

export default function AboutSection() {
  const { ref, isInView } = useInViewAnimation({ threshold: 0.15 })
  const { config } = useSiteData()

  return (
    <section ref={ref} className="max-w-[1300px] mx-auto px-6 py-20 md:py-28">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        {/* Left - Text slides in from left */}
        <div className={isInView ? 'animate-slide-in-left' : 'opacity-0'}>
          <p className="font-mono text-sm text-[#051A24] tracking-widest uppercase mb-4">
            ABOUT US
          </p>
          <h2 className="text-[28px] md:text-[36px] leading-[1.15] text-[#051A24] tracking-tight">
            一个由<span className="font-mondwest">学生</span>打造的
            <br />
            <span className="font-mondwest">创造者</span>社群
          </h2>
          <p className="text-sm md:text-base text-[#0D212C] leading-relaxed mt-5">
            星雨作坊成立于 2020 年，从最初的几人小组发展为涵盖前端、后端、设计、算法、产品五大方向的综合性学生开发社团。我们承接真实项目、参与各类竞赛、举办技术分享，致力于让每一位成员在实践中成长。
          </p>
          <p className="text-sm md:text-base text-[#0D212C] leading-relaxed mt-3">
            在这里，没有严格的上下级，只有共同热爱技术的伙伴。每一个想法都值得被认真对待，每一行代码都在创造价值。
          </p>

          {/* Stats */}
          <div className="flex gap-10 mt-8">
            {stats.map((stat) => (
              <div key={stat.label}>
                <div className="text-[28px] font-medium text-[#051A24]">
                  {isInView && <CountUp end={stat.value} suffix={stat.suffix} />}
                  {!isInView && '0'}
                </div>
                <div className="text-xs text-[#273C46] mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right - Image slides in from right */}
        <div className={isInView ? 'animate-slide-in-right' : 'opacity-0'}>
          <Card hover={false} className="overflow-hidden p-2">
            <img
              src={config.aboutImage}
              alt="星雨作坊团队合影"
              className="w-full rounded-[24px] md:rounded-[32px] object-cover aspect-[4/3]"
              loading="lazy"
            />
          </Card>
        </div>
      </div>
    </section>
  )
}
