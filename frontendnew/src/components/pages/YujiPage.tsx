import Card from '../ui/Card'

export default function YujiPage() {
  return (
    <div className="page-enter max-w-[900px] mx-auto px-6 py-24">
      <h1 className="text-[36px] md:text-[44px] font-medium text-[#051A24] text-center">
        <span className="font-mondwest">雨记</span>协作板
      </h1>
      <p className="text-center text-sm text-[#273C46] mt-4">共享笔记 · 实时协作 · 灵感捕捉</p>

      <Card className="p-8 md:p-12 mt-12 !rounded-[32px]">
        <div className="space-y-6 text-sm md:text-base text-[#0D212C] leading-relaxed">
          <h2 className="text-xl font-medium text-[#051A24]">📝 本周待办</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>完成 Campus Hub v2.0 的前端重构</li>
            <li>准备本周五的技术分享：React 19 新特性</li>
            <li>审核新成员的报名申请</li>
          </ul>

          <h2 className="text-xl font-medium text-[#051A24] mt-8">💡 灵感碎片</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { color: '#051A24', text: '用 WebSocket 实现协作编辑功能' },
              { color: '#0D212C', text: '会员积分系统——激励贡献' },
              { color: '#273C46', text: 'AI 驱动的代码审查机器人' },
            ].map((card) => (
              <div key={card.text} className="p-4 rounded-2xl text-white text-sm" style={{ background: card.color }}>
                {card.text}
              </div>
            ))}
          </div>

          <h2 className="text-xl font-medium text-[#051A24] mt-8">📅 近期活动</h2>
          <div className="space-y-3">
            {[
              { date: '7.10', title: '技术分享：LLM 微调实战' },
              { date: '7.15', title: '新成员见面会' },
              { date: '7.20', title: 'Hackathon 组队' },
            ].map((evt) => (
              <div key={evt.date} className="flex gap-4 items-center">
                <span className="text-xs font-mono text-[#273C46] w-12">{evt.date}</span>
                <span className="text-sm text-[#0D212C]">{evt.title}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  )
}
