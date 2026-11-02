import { ArrowUpRight, BriefcaseBusiness, ChartNoAxesCombined, Layers3, ShieldCheck } from 'lucide-react'
import Button from './Button'

export default function InvestmentDemo() {
  return (
    <section aria-labelledby="investment-demo-title" className="relative mt-12 mb-12 overflow-hidden rounded-3xl border border-[var(--theme-border)] bg-[var(--theme-surface)] p-7 md:p-10">
      <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-[#3ba7a0]/10 blur-3xl" />
      <div className="relative flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
        <div className="max-w-2xl">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#143f46] text-white"><BriefcaseBusiness className="h-5 w-5" /></span>
            <span className="text-xs font-medium tracking-[0.18em] text-[#273C46]">应用演示 / INVESTMENT</span>
          </div>
          <h2 id="investment-demo-title" className="text-2xl font-medium text-[#051A24] md:text-3xl">投资管理系统</h2>
          <p className="mt-3 max-w-xl text-sm leading-7 text-[#273C46]">连接项目、基金与投后管理，将业务协作、经营分析和 AI 辅助汇聚到一个工作台。</p>
          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-3 text-xs text-[#273C46]">
            <span className="flex items-center gap-2"><Layers3 className="h-4 w-4" />投资业务管理</span>
            <span className="flex items-center gap-2"><ChartNoAxesCombined className="h-4 w-4" />经营分析</span>
            <span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" />账号权限管理</span>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-start gap-3 md:items-end">
          <Button href="/api/demos/investment/launch" target="_blank" rel="noopener noreferrer" className="gap-2">进入投资管理系统 <ArrowUpRight className="h-4 w-4" /></Button>
          <p className="text-xs text-[#273C46]">使用已授权账号登录</p>
        </div>
      </div>
    </section>
  )
}
