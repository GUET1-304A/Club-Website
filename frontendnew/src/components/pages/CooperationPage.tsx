import { useState, useEffect } from 'react'
import { Handshake, GraduationCap, BookOpen, Award, ArrowUpRight } from 'lucide-react'
import Card from '../ui/Card'
import { fetchPage } from '../../services/api'

interface CooperationItem {
  type: string
  title: string
  description: string
  details: string[]
}

const FALLBACK: { intro: string; items: CooperationItem[] } = {
  intro: '星雨作坊积极链接企业、高校与社区，通过合作项目、学术分享与竞赛交流，让成员在真实场景中成长。',
  items: [
    {
      type: '校企合作',
      title: '企业联合项目',
      description: '与科技公司共建真实项目，企业导师参与评审与指导。',
      details: ['企业命题实训', '技术沙龙', '实习内推'],
    },
    {
      type: '校际交流',
      title: '高校技术交流',
      description: '与其他高校学生组织互访，联合开展黑客松与分享会。',
      details: ['联合 Hackathon', '跨校技术分享', '社团互访'],
    },
    {
      type: '学术活动',
      title: '学术讲座与工作坊',
      description: '邀请老师、校友与行业专家开展讲座与动手工作坊。',
      details: ['技术讲座', '论文共读', '动手工作坊'],
    },
    {
      type: '参会参展',
      title: '竞赛与展会',
      description: '组织参加程序设计、AI 创新等竞赛，并参与创新创业展会。',
      details: ['学科竞赛', '创新创业展', '开源大会'],
    },
  ],
}

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string; strokeWidth?: number }>> = {
  校企合作: Handshake,
  校际交流: GraduationCap,
  学术活动: BookOpen,
  参会参展: Award,
}

const TYPE_COLORS: Record<string, string> = {
  校企合作: 'bg-[#051A24]',
  校际交流: 'bg-[#0D212C]',
  学术活动: 'bg-[#273C46]',
  参会参展: 'bg-[#4a6a7a]',
}

export default function CooperationPage() {
  const [data, setData] = useState(FALLBACK)

  useEffect(() => {
    fetchPage('cooperation')
      .then(page => {
        const content = page.content as unknown as { intro?: string; items?: CooperationItem[] }
        if (content?.items?.length) {
          setData({
            intro: content.intro || FALLBACK.intro,
            items: content.items,
          })
        }
      })
      .catch(() => {})
  }, [])

  return (
    <div className="page-enter max-w-[1000px] mx-auto px-6 py-24">
      <h1 className="text-[36px] md:text-[44px] font-medium text-[#051A24] text-center">
        合作<span className="font-mondwest">交流</span>
      </h1>
      <p className="text-center text-sm text-[#273C46] mt-4 max-w-xl mx-auto leading-relaxed">{data.intro}</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12">
        {data.items.map(item => {
          const Icon = TYPE_ICONS[item.type] || Handshake
          const color = TYPE_COLORS[item.type] || 'bg-[#051A24]'
          return (
            <Card key={item.title} className="p-7 !rounded-[32px]">
              <div className="flex items-center gap-4 mb-4">
                <div className={`w-12 h-12 rounded-2xl ${color} text-white flex items-center justify-center shrink-0`}>
                  <Icon className="w-5 h-5" strokeWidth={1.5} />
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-[#273C46]/40 uppercase tracking-wider">{item.type}</p>
                  <h2 className="text-lg font-medium text-[#051A24]">{item.title}</h2>
                </div>
              </div>

              <p className="text-sm text-[#0D212C] leading-relaxed">{item.description}</p>

              <div className="mt-4 space-y-1.5">
                {item.details.map(detail => (
                  <p key={detail} className="flex items-center gap-2 text-xs text-[#273C46]/70">
                    <ArrowUpRight className="w-3 h-3 text-[#273C46]/30" /> {detail}
                  </p>
                ))}
              </div>
            </Card>
          )
        })}
      </div>

      <Card className="p-8 text-center !rounded-[32px] mt-10">
        <h3 className="text-xl font-medium text-[#051A24]">想与我们合作？</h3>
        <p className="text-sm text-[#273C46]/60 mt-2">企业合作、高校交流、活动邀约，欢迎随时联系我们</p>
        <a href="/contact" className="btn-primary inline-flex text-sm px-7 py-3 mt-6">联系我们</a>
      </Card>
    </div>
  )
}
