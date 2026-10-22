import Card from '../ui/Card'
import Button from '../ui/Button'
import { usePageData } from '../../store/usePageData'
import PageDataNotice from '../ui/PageDataNotice'

interface RecruitmentContent {
  intro?: string
  requirements?: string[]
  process?: { step: string; description: string }[]
  faq?: { question: string; answer: string }[]
  cta_title?: string
  cta_note?: string
  cta_button?: string
}

const FALLBACK: RecruitmentContent = {
  intro: '',
  requirements: [
    '在校本科生或研究生，专业不限',
    '对技术有热情，愿意投入时间学习和实践',
    '有团队合作精神，善于沟通',
    '有相关项目经验者优先（非必需）',
  ],
  process: [
    { step: '在线填写报名表', description: '约 5 分钟' },
    { step: '简历筛选', description: '1 周内邮件通知' },
    { step: '线上面试', description: '技术基础 + 团队协作' },
    { step: '通知结果', description: '正式加入' },
  ],
  faq: [
    { question: '非计算机专业可以加入吗？', answer: '完全可以！我们欢迎任何专业的同学。很多优秀成员来自数学、物理、设计等专业。' },
    { question: '没有项目经验怎么办？', answer: '我们会提供入门指导和培训，只要你有学习的热情即可。' },
  ],
  cta_title: '准备好加入我们了吗？',
  cta_note: '招新安排以社团最新通知为准',
  cta_button: '立即报名',
}

export default function RecruitmentPage() {
  const { page } = usePageData('recruitment')
  const content: RecruitmentContent = { ...FALLBACK, ...page?.content }

  return (
    <div className="page-enter max-w-[800px] mx-auto px-6 py-24">
      <h1 className="text-[36px] md:text-[44px] font-medium text-[#051A24] text-center">
        招新<span className="font-mondwest">信息</span>
      </h1>
      <PageDataNotice slug="recruitment" />

      <div className="mt-8 space-y-6 text-sm md:text-base text-[#0D212C] leading-relaxed">
        {content.intro && <p>{content.intro}</p>}

        <h2 className="text-xl font-medium text-[#051A24] mt-10">招新要求</h2>
        <ul className="list-disc pl-5 space-y-2">
          {(content.requirements || []).map(item => <li key={item}>{item}</li>)}
        </ul>

        <h2 className="text-xl font-medium text-[#051A24] mt-10">招新流程</h2>
        <ol className="list-decimal pl-5 space-y-2">
          {(content.process || []).map(item => (
            <li key={item.step}>
              <span className="font-medium">{item.step}</span>
              {item.description && <span className="text-[#273C46]">：{item.description}</span>}
            </li>
          ))}
        </ol>

        {(content.faq || []).length > 0 && (
          <>
            <h2 className="text-xl font-medium text-[#051A24] mt-10">常见问题</h2>
            <div className="space-y-4">
              {(content.faq || []).map(item => (
                <div key={item.question}>
                  <p className="font-medium text-[#051A24]">Q: {item.question}</p>
                  <p className="text-[#273C46]">A: {item.answer}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="mt-16">
        <Card className="p-10 text-center !rounded-[32px]">
          <h3 className="text-2xl font-medium text-[#051A24]">{content.cta_title}</h3>
          <p className="text-sm text-[#273C46] mt-3">{content.cta_note}</p>
          <div className="mt-6">
            <Button variant="primary" size="lg" href="/join">{content.cta_button}</Button>
          </div>
        </Card>
      </div>
    </div>
  )
}
