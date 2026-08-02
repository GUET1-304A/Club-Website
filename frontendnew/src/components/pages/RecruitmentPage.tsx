import Card from '../ui/Card'
import Button from '../ui/Button'

export default function RecruitmentPage() {
  return (
    <div className="page-enter max-w-[800px] mx-auto px-6 py-24">
      <h1 className="text-[36px] md:text-[44px] font-medium text-[#051A24] text-center">
        招新<span className="font-mondwest">信息</span>
      </h1>

      <div className="mt-8 space-y-6 text-sm md:text-base text-[#0D212C] leading-relaxed">
        <h2 className="text-xl font-medium text-[#051A24] mt-10">招新要求</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li>在校本科生或研究生，专业不限</li>
          <li>对技术有热情，愿意投入时间学习和实践</li>
          <li>有团队合作精神，善于沟通</li>
          <li>有相关项目经验者优先（非必需）</li>
        </ul>

        <h2 className="text-xl font-medium text-[#051A24] mt-10">招新流程</h2>
        <ol className="list-decimal pl-5 space-y-2">
          <li>在线填写报名表（约 5 分钟）</li>
          <li>简历筛选（1 周内邮件通知）</li>
          <li>线上面试（技术基础 + 团队协作）</li>
          <li>通知结果，正式加入</li>
        </ol>

        <h2 className="text-xl font-medium text-[#051A24] mt-10">常见问题</h2>
        <div className="space-y-4">
          <div>
            <p className="font-medium text-[#051A24]">Q: 非计算机专业可以加入吗？</p>
            <p className="text-[#273C46]">A: 完全可以！我们欢迎任何专业的同学。很多优秀成员来自数学、物理、设计等专业。</p>
          </div>
          <div>
            <p className="font-medium text-[#051A24]">Q: 没有项目经验怎么办？</p>
            <p className="text-[#273C46]">A: 我们会提供入门指导和培训，只要你有学习的热情即可。</p>
          </div>
        </div>
      </div>

      <div className="mt-16">
        <Card className="p-10 text-center !rounded-[32px]">
          <h3 className="text-2xl font-medium text-[#051A24]">准备好加入我们了吗？</h3>
          <p className="text-sm text-[#273C46] mt-3">2026 春季招新进行中</p>
          <div className="mt-6">
            <Button variant="primary" size="lg" href="/join">立即报名</Button>
          </div>
        </Card>
      </div>
    </div>
  )
}
