import { useState, useEffect } from 'react'
import {
  Clock, FolderGit2, CheckSquare, Trophy, Users, ArrowRight,
  Sparkles, Activity,
} from 'lucide-react'
import MemberLayout from './MemberLayout'
import { memberDashboardStats, type MemberProfile, type DashboardStats } from '../../services/memberApi'

export default function MemberDashboard({ member: initialMember }: { member: MemberProfile }) {
  const [greeting, setGreeting] = useState('')
  const [stats, setStats] = useState<DashboardStats | null>(null)

  useEffect(() => {
    const hour = new Date().getHours()
    setGreeting(hour < 12 ? '早上好' : hour < 18 ? '下午好' : '晚上好')

    memberDashboardStats()
      .then(setStats)
      .catch(() => setStats(null))
  }, [])

  const quickLinks = [
    { icon: FolderGit2, label: '我的项目', href: '/member/projects', gradient: 'from-[#051A24] to-[#0D212C]' },
    { icon: CheckSquare, label: '我的任务', href: '/member/tasks', gradient: 'from-[#0D212C] to-[#1a3a4a]' },
    { icon: Trophy, label: '证书管理', href: '/member/certificates', gradient: 'from-[#1a3a4a] to-[#2a4a5a]' },
    { icon: Users, label: '通讯录', href: '/member/directory', gradient: 'from-[#2a4a5a] to-[#3a5a6a]' },
  ]

  const statCards = stats ? [
    { icon: Users, label: '社团成员', value: stats.totalMembers, href: '/member/directory', gradient: 'from-[#051A24] to-[#0D212C]' },
    { icon: FolderGit2, label: '项目总数', value: stats.totalProjects, sub: `${stats.activeProjects} 个进行中`, href: '/member/projects', gradient: 'from-[#0D212C] to-[#1a3a4a]' },
    { icon: CheckSquare, label: '任务完成', value: stats.doneTasks, sub: `共 ${stats.totalTasks} 个任务`, gradient: 'from-[#1a3a4a] to-[#2a4a5a]' },
  ] : []

  return (
    <MemberLayout member={initialMember}>
      <div className="animate-fade-in-up">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-[28px] font-medium text-[#051A24] tracking-tight"
              style={{ fontFamily: "var(--font-sans)", fontWeight: 500 }}>
              {greeting}，{initialMember.name}
            </h1>
            <p className="text-sm text-[#273C46]/50 mt-1">
              欢迎回到星雨作坊成员门户
              {stats && <span> · {stats.activeProjects} 个项目进行中</span>}
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs text-[#273C46]/40 bg-white rounded-2xl px-4 py-2 border border-[rgba(0,0,0,0.05)]">
            <Clock className="w-3.5 h-3.5" />
            {new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
          </div>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {stats
            ? statCards.map(item => (
                <a
                  key={item.label}
                  href={item.href}
                  className="group card p-5 flex items-center gap-4 hover:translate-y-[-3px] transition-all duration-300"
                  style={{ borderRadius: 22 }}
                >
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center bg-gradient-to-br ${item.gradient} shadow-lg shadow-[#051A24]/5 group-hover:shadow-xl group-hover:shadow-[#051A24]/10 transition-shadow`}
                  >
                    <item.icon className="w-5 h-5 text-white" strokeWidth={1.5} />
                  </div>
                  <div>
                    <p className="text-[28px] font-semibold text-[#051A24] leading-none tracking-tight"
                      style={{ fontFamily: "var(--font-sans)" }}>
                      {item.value}
                    </p>
                    <p className="text-xs text-[#273C46]/50 mt-1 font-medium">{item.label}</p>
                    {item.sub && <p className="text-[10px] text-[#273C46]/30 mt-0.5">{item.sub}</p>}
                  </div>
                  <ArrowRight className="w-4 h-4 text-[#273C46]/20 group-hover:text-[#051A24]/40 group-hover:translate-x-0.5 transition-all ml-auto" />
                </a>
              ))
            : Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="card p-5 flex items-center gap-4 animate-pulse" style={{ borderRadius: 22 }}>
                  <div className="w-12 h-12 rounded-2xl bg-[#f0ece6]" />
                  <div className="space-y-2">
                    <div className="h-7 w-12 bg-[#f0ece6] rounded-lg" />
                    <div className="h-3 w-16 bg-[#f0ece6] rounded-md" />
                  </div>
                </div>
              ))
          }
        </div>

        {/* Quick links + Profile card */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Quick actions */}
          <div className="lg:col-span-2">
            <div className="card p-6" style={{ borderRadius: 24 }}>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-xl bg-[#051A24] flex items-center justify-center">
                  <Activity className="w-4 h-4 text-white" />
                </div>
                <h2 className="text-sm font-semibold text-[#051A24]">快捷入口</h2>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {quickLinks.map(item => (
                  <a
                    key={item.label}
                    href={item.href}
                    className="group flex items-center gap-3 p-3.5 rounded-2xl bg-[#fcfbfa] border border-[rgba(0,0,0,0.04)]
                      hover:bg-white hover:border-[rgba(0,0,0,0.08)] hover:shadow-sm transition-all"
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center bg-gradient-to-br ${item.gradient} shadow-sm`}>
                      <item.icon className="w-4 h-4 text-white" strokeWidth={1.5} />
                    </div>
                    <span className="text-sm font-medium text-[#051A24]">{item.label}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-[#273C46]/20 group-hover:text-[#051A24]/40 group-hover:translate-x-0.5 transition-all ml-auto" />
                  </a>
                ))}
              </div>
            </div>
          </div>

          {/* Profile card */}
          <div className="card p-6 flex flex-col items-center text-center" style={{ borderRadius: 24 }}>
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#f0ece6] to-[#e8e4dc] overflow-hidden ring-2 ring-white shadow-md mb-4">
              {initialMember.avatar
                ? <img src={initialMember.avatar} alt="" className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center text-xl font-semibold text-[#273C46]/30">{initialMember.name?.[0] || '?'}</div>
              }
            </div>
            <h3 className="text-base font-medium text-[#051A24]"
              style={{ fontFamily: "var(--font-sans)", fontWeight: 500 }}>
              {initialMember.name}
            </h3>
            <p className="text-xs text-[#273C46]/50 mt-1">{initialMember.role || initialMember.group || '成员'}</p>
            {initialMember.skills && initialMember.skills.length > 0 && (
              <div className="flex flex-wrap justify-center gap-1.5 mt-3">
                {initialMember.skills.slice(0, 4).map(s => (
                  <span key={s} className="text-[10px] bg-[#f0ece6] text-[#273C46] rounded-full px-2 py-0.5 font-medium">{s}</span>
                ))}
              </div>
            )}
            <a href="/member/profile" className="btn-secondary text-xs px-4 py-2 mt-5 inline-flex items-center gap-1.5">
              <Sparkles className="w-3 h-3" /> 编辑资料
            </a>
          </div>
        </div>
      </div>
    </MemberLayout>
  )
}
