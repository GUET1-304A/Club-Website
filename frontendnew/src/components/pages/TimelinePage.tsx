import { useInViewAnimation } from '../../hooks/useInViewAnimation'
import Card from '../ui/Card'

const events = [
  { date: '2020-09', title: '星雨作坊成立', desc: '由一群热爱技术的学生发起，最初只有 5 名成员。' },
  { date: '2021-03', title: '首个项目上线', desc: '校园二手书交易平台上线，服务全校师生。' },
  { date: '2022-06', title: '首次获得省级奖项', desc: '省高校创新大赛二等奖，标志着社团技术实力的突破。' },
  { date: '2023-01', title: '扩编为五大方向', desc: '正式成立前端、后端、设计、算法、产品五个小组。' },
  { date: '2024-05', title: '国家级竞赛获奖', desc: '全国大学生 Web 应用开发大赛一等奖。' },
  { date: '2024-09', title: '开源项目获 500+ Star', desc: 'AI 写作助手项目在 GitHub 上获得广泛关注。' },
  { date: '2025-06', title: '社团成员突破 40 人', desc: '累计完成项目 30+，获奖 20+ 项。' },
  { date: '2025-12', title: 'ICPC 亚洲区银奖', desc: '团队在国际程序设计竞赛中取得历史最好成绩。' },
]

export default function TimelinePage() {
  const { ref, isInView } = useInViewAnimation({ threshold: 0.05 })

  return (
    <div ref={ref} className="page-enter max-w-[700px] mx-auto px-6 py-24">
      <h1 className="text-[36px] md:text-[44px] font-medium text-[#051A24] text-center mb-16">
        社团<span className="font-mondwest">时间线</span>
      </h1>

      <div className="relative">
        {/* Center line */}
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-[rgba(0,0,0,0.08)]" />

        <div className="flex flex-col gap-12">
          {events.map((evt, i) => {
            const isLeft = i % 2 === 0
            return (
              <div key={i} className={`relative flex items-center ${isLeft ? 'flex-row' : 'flex-row-reverse'}`}>
                {/* Dot */}
                <div className="absolute left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-[#051A24] z-10" />
                {/* Card */}
                <div className={`w-[calc(50%-24px)] ${isInView ? `animate-slide-in-${isLeft ? 'left' : 'right'} delay-${(i + 1) * 100}` : 'opacity-0'}`}>
                  <Card className="p-5 !rounded-[24px]">
                    <span className="text-xs text-[#273C46]/60">{evt.date}</span>
                    <h3 className="font-medium text-[#051A24] mt-1">{evt.title}</h3>
                    <p className="text-sm text-[#273C46] mt-1">{evt.desc}</p>
                  </Card>
                </div>
                <div className="w-[calc(50%-24px)]" />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
