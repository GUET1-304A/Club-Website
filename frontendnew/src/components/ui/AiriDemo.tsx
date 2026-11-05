import { ArrowUpRight, AudioLines, Bot, MessagesSquare, ScanFace } from 'lucide-react'
import Button from './Button'

export default function AiriDemo() {
  return (
    <section aria-labelledby="airi-demo-title" className="relative mb-12 overflow-hidden rounded-3xl border border-[var(--theme-border)] bg-[var(--theme-surface)] p-7 md:p-10">
      <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-[#9275b5]/10 blur-3xl" />
      <div className="relative flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
        <div className="max-w-2xl">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#57416e] text-white"><Bot className="h-5 w-5" /></span>
            <span className="text-xs font-medium tracking-[0.18em] text-[#273C46]">应用演示 / AIRI</span>
          </div>
          <h2 id="airi-demo-title" className="text-2xl font-medium text-[#051A24] md:text-3xl">数字生命 AIRI</h2>
          <p className="mt-3 max-w-xl text-sm leading-7 text-[#273C46]">与虚拟角色面对面交流，探索实时语音、视觉感知与持续陪伴的数字生命体验。</p>
          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-3 text-xs text-[#273C46]">
            <span className="flex items-center gap-2"><MessagesSquare className="h-4 w-4" />角色互动</span>
            <span className="flex items-center gap-2"><AudioLines className="h-4 w-4" />实时语音</span>
            <span className="flex items-center gap-2"><ScanFace className="h-4 w-4" />视觉感知</span>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-start gap-3 md:items-end">
          <Button href="/api/demos/airi/launch" target="_blank" rel="noopener noreferrer" className="gap-2">体验数字生命 AIRI <ArrowUpRight className="h-4 w-4" /></Button>
          <p className="text-xs text-[#273C46]">在新标签页打开演示</p>
        </div>
      </div>
    </section>
  )
}
