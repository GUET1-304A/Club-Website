import { Cpu, Server, Brain, PenTool, ArrowUpRight } from 'lucide-react'
import Card from '../ui/Card'
import TagPill from '../ui/TagPill'
import { usePageData } from '../../store/usePageData'
import PageDataNotice from '../ui/PageDataNotice'

interface Direction {
  name: string
  tagline: string
  techFields: string[]
  content: string
  scenarios: string[]
}

const FALLBACK: { intro: string; directions: Direction[] } = {
  intro: '星雨作坊围绕五大方向开展学习、研究与项目实践，成员按兴趣选择方向，并在真实项目中持续深耕。',
  directions: [
    {
      name: '前端工程',
      tagline: '构建流畅、美观、可访问的用户界面',
      techFields: ['React', 'TypeScript', 'Vue', 'Tailwind CSS', 'Web 性能优化'],
      content: '研究组件化架构、状态管理、微前端与 Web 动画，打磨复杂产品的前端体验。',
      scenarios: ['官网门户', '数据可视化大屏', '小程序 / H5'],
    },
    {
      name: '后端服务',
      tagline: '设计稳定、可扩展的服务端系统',
      techFields: ['Python', 'Flask', 'Go', 'Docker', 'MySQL / Redis'],
      content: '研究 REST API 设计、认证授权、消息推送、容器化部署与系统监控。',
      scenarios: ['内容管理平台', '智能项目管理', '自动化运维'],
    },
    {
      name: '算法与 AI',
      tagline: '让机器理解语言、图像与数据',
      techFields: ['Python', 'PyTorch', 'NLP', 'CV', '大模型应用'],
      content: '研究自然语言处理、计算机视觉与大模型应用（RAG、Agent、智能识别）。',
      scenarios: ['证书智能识别', '周报智能分析', '智能问答助手'],
    },
    {
      name: '产品设计',
      tagline: '把复杂问题翻译成清晰的产品方案',
      techFields: ['用户研究', '交互设计', 'Figma', '数据分析'],
      content: '研究需求分析、信息架构、界面设计原则与用户增长方法。',
      scenarios: ['产品原型', '设计系统', '用户反馈闭环'],
    },
  ],
}

const ICONS = [Cpu, Server, Brain, PenTool]

export default function ResearchPage() {
  const { page } = usePageData('research')
  const content = page?.content as { intro?: string; directions?: Direction[] } | undefined
  const data = { intro: content?.intro ?? FALLBACK.intro, directions: content?.directions ?? FALLBACK.directions }

  return (
    <div className="page-enter max-w-[1100px] mx-auto px-6 py-24">
      <h1 className="text-[36px] md:text-[44px] font-medium text-[#051A24] text-center">
        研究<span className="font-mondwest">方向</span>
      </h1>
      <PageDataNotice slug="research" />
      <p className="text-center text-sm text-[#273C46] mt-4 max-w-xl mx-auto leading-relaxed">{data.intro}</p>

      {!data.directions.length && <p className="mt-12 text-center text-sm text-[var(--theme-text)]">研究方向整理中，敬请期待。</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12">
        {data.directions.map((direction, index) => {
          const Icon = ICONS[index % ICONS.length]
          return (
            <Card key={direction.name} className="p-7 !rounded-[32px]">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-[#051A24] text-white flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5" strokeWidth={1.5} />
                </div>
                <div>
                  <h2 className="text-lg font-medium text-[#051A24]">{direction.name}</h2>
                  <p className="text-xs text-[#273C46]/50 mt-0.5">{direction.tagline}</p>
                </div>
              </div>

              <p className="text-sm text-[#0D212C] leading-relaxed">{direction.content}</p>

              <div className="mt-4">
                <p className="text-[10px] font-semibold text-[#273C46]/40 uppercase tracking-wider mb-2">技术领域</p>
                <div className="flex flex-wrap gap-1.5">
                  {direction.techFields.map(field => <TagPill key={field} label={field} />)}
                </div>
              </div>

              <div className="mt-4">
                <p className="text-[10px] font-semibold text-[#273C46]/40 uppercase tracking-wider mb-2">应用场景</p>
                <div className="space-y-1.5">
                  {direction.scenarios.map(scenario => (
                    <p key={scenario} className="flex items-center gap-2 text-xs text-[#273C46]/70">
                      <ArrowUpRight className="w-3 h-3 text-[#273C46]/30" /> {scenario}
                    </p>
                  ))}
                </div>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
