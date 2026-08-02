import { useInViewAnimation } from '../../hooks/useInViewAnimation'
import Divider from '../ui/Divider'

const stats = [
  { label: '成立年份', value: 2020 },
  { label: '成员数', value: 42, suffix: '+' },
  { label: '获奖数', value: 28, suffix: '+' },
  { label: '项目数', value: 36, suffix: '+' },
]

export default function AboutPage() {
  const { ref, isInView } = useInViewAnimation({ threshold: 0.1 })

  return (
    <div ref={ref} className="page-enter max-w-[900px] mx-auto px-6 py-24">
      <h1 className="text-[36px] md:text-[44px] font-medium text-[#051A24]">
        关于<span className="font-mondwest">星雨作坊</span>
      </h1>

      <div className="mt-8 space-y-6 text-sm md:text-base text-[#0D212C] leading-relaxed">
        <p>星雨作坊成立于 2020 年，从最初的几人小组发展为涵盖前端、后端、设计、算法、产品五大方向的综合性学生开发社团。</p>
        <p>我们承接真实项目、参与各类竞赛、举办技术分享，致力于让每一位成员在实践中成长。在这里，没有严格的上下级，只有共同热爱技术的伙伴。</p>
        <p>每一个想法都值得被认真对待，每一行代码都在创造价值。我们相信开源的力量，所有项目代码在 GitHub 上公开。</p>
      </div>

      <Divider />

      {/* Stats */}
      <div className="flex gap-10 justify-center">
        {stats.map((stat, i) => (
          <div
            key={stat.label}
            className={`text-center ${isInView ? `animate-fade-in-up delay-${(i + 1) * 100}` : 'opacity-0'}`}
          >
            <div className="text-[28px] font-medium text-[#051A24] font-mondwest">
              {stat.value}
              {stat.suffix || ''}
            </div>
            <div className="text-xs text-[#273C46] mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      <Divider />

      {/* Photo wall */}
      <h2 className="text-2xl font-medium text-[#051A24] mb-6">
        <span className="font-mondwest">活动</span>剪影
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {['1522071820081-009f0129c71c', '1517245386807-bb43f82c33c4', '1552664730-d307ca884978', '1523240795612-9a054b0db460', '1531482611025-2d93d9bc2900', '1543269865-cbf427effbad'].map((id) => (
          <img
            key={id}
            src={`https://images.unsplash.com/photo-${id}?w=400&q=80`}
            alt="活动照片"
            className="rounded-2xl object-cover aspect-square hover:scale-[1.02] transition-transform"
            loading="lazy"
          />
        ))}
      </div>
    </div>
  )
}
