import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import Card from '../ui/Card'
import { usePageData } from '../../store/usePageData'
import PageDataNotice from '../ui/PageDataNotice'

interface OnboardingStep {
  title: string
  content: string
}

const FALLBACK_STEPS: OnboardingStep[] = [
  { title: '第一步：了解社团', content: '浏览官网，了解各组别方向，找到你感兴趣的方向。阅读博客和项目展示，感受社团的技术氛围。' },
  { title: '第二步：提交报名', content: '在加入页面填写报名表，包括基本信息、意向组别和申请动机。我们会认真阅读每一份申请。' },
  { title: '第三步：等待通知', content: '提交后 1 周内，我们会通过邮件通知筛选结果和面试安排。请留意你的邮箱。' },
  { title: '第四步：参加面试', content: '面试包括技术基础和团队协作两部分。不用紧张，我们更看重你的学习能力和热情。' },
  { title: '第五步：正式加入', content: '面试通过后，你将收到正式加入邀请。我们会为你分配导师，帮你快速融入团队。' },
]

export default function OnboardingPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)
  const { page } = usePageData('onboarding')
  const steps = (page?.content as { steps?: OnboardingStep[] } | undefined)?.steps ?? FALLBACK_STEPS

  return (
    <div className="page-enter max-w-[800px] mx-auto px-6 py-24">
      <h1 className="text-[36px] md:text-[44px] font-medium text-[#051A24] text-center">
        新手<span className="font-mondwest">指南</span>
      </h1>
      <PageDataNotice slug="onboarding" />
      <p className="text-center text-sm text-[#273C46] mt-4">从这里开始，一步步加入星雨作坊</p>

      {!steps.length && <p className="mt-12 text-center text-sm text-[var(--theme-text)]">入门指南整理中，敬请期待。</p>}
      <div className="space-y-4 mt-12">
        {steps.map((step, i) => (
          <Card key={i} className="p-6 !rounded-[32px] relative overflow-hidden">
            <div aria-hidden="true" className="absolute top-0 right-0 text-6xl font-mondwest text-[#051A24]/5 leading-none pt-2 pr-4 select-none pointer-events-none">
              {i + 1}
            </div>
            <h3 className="relative z-10">
              <button type="button" className="flex min-h-11 w-full items-center justify-between gap-4 text-left text-lg font-medium text-[var(--theme-text-strong)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#3457ff]"
                aria-expanded={openIndex === i} aria-controls={`onboarding-step-${i}`}
                onClick={() => setOpenIndex(openIndex === i ? null : i)}>
                {step.title}<ChevronDown className={`h-5 w-5 shrink-0 transition-transform ${openIndex === i ? 'rotate-180' : ''}`} />
              </button>
            </h3>
            <p id={`onboarding-step-${i}`} hidden={openIndex !== i} className="text-sm text-[#0D212C] leading-relaxed mt-4 relative z-10">{step.content}</p>
          </Card>
        ))}
      </div>
    </div>
  )
}
