import { useState, useEffect } from 'react'
import {
  Users, FolderGit2, Trophy, PenTool, MessageSquare, UserPlus,
  Clock, ArrowRight, Sparkles, Plus,
} from 'lucide-react'
import AdminLayout from './AdminLayout'
import {
  adminListMembers, adminListProjects, adminListAwards,
  adminListBlogs, adminListApplications, adminListContacts,
} from '../../services/adminApi'

interface StatItem {
  icon: typeof Users
  label: string
  value: number
  href: string
  gradient: string
}

function StatCard({ icon: Icon, label, value, href, gradient }: StatItem) {
  return (
    <a
      href={href}
      className="group card p-5 flex items-center gap-4 hover:translate-y-[-3px] transition-all duration-300"
      style={{ borderRadius: 22 }}
    >
      <div
        className={`w-12 h-12 rounded-2xl flex items-center justify-center bg-gradient-to-br ${gradient} shadow-lg shadow-[#051A24]/5 group-hover:shadow-xl group-hover:shadow-[#051A24]/10 transition-shadow`}
      >
        <Icon className="w-5 h-5 text-white" strokeWidth={1.5} />
      </div>
      <div>
        <p className="text-[28px] font-semibold text-[#051A24] leading-none tracking-tight"
          style={{ fontFamily: "'PP Neue Montreal', 'Noto Sans SC', sans-serif" }}>
          {value}
        </p>
        <p className="text-xs text-[#273C46]/50 mt-1 font-medium">{label}</p>
      </div>
      <ArrowRight className="w-4 h-4 text-[#273C46]/20 group-hover:text-[#051A24]/40 group-hover:translate-x-0.5 transition-all ml-auto" />
    </a>
  )
}

function SkeletonCard() {
  return (
    <div className="card p-5 flex items-center gap-4 animate-pulse" style={{ borderRadius: 22 }}>
      <div className="w-12 h-12 rounded-2xl bg-[#f0ece6]" />
      <div className="space-y-2">
        <div className="h-7 w-12 bg-[#f0ece6] rounded-lg" />
        <div className="h-3 w-16 bg-[#f0ece6] rounded-md" />
      </div>
    </div>
  )
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Record<string, number> | null>(null)
  const [greeting, setGreeting] = useState('')

  useEffect(() => {
    const hour = new Date().getHours()
    setGreeting(hour < 12 ? '早上好' : hour < 18 ? '下午好' : '晚上好')

    Promise.all([
      adminListMembers().catch(() => []),
      adminListProjects().catch(() => []),
      adminListAwards().catch(() => []),
      adminListBlogs().catch(() => []),
      adminListApplications().catch(() => []),
      adminListContacts().catch(() => []),
    ]).then(([m, p, a, b, apps, c]) => {
      const pending = apps.filter((x: { status: string }) => x.status === 'pending').length
      const unread = c.filter((x: { status: string }) => x.status === 'unread').length
      setStats({
        members: m.length, projects: p.length, awards: a.length,
        blogs: b.length, applications: apps.length, contacts: c.length,
        pendingApps: pending, unreadMsgs: unread,
      })
    })
  }, [])

  const statItems: StatItem[] = [
    { icon: Users, label: '成员', value: stats?.members ?? 0, href: '/admin/members', gradient: 'from-[#051A24] to-[#0D212C]' },
    { icon: FolderGit2, label: '项目', value: stats?.projects ?? 0, href: '/admin/projects', gradient: 'from-[#0D212C] to-[#1a3a4a]' },
    { icon: Trophy, label: '奖项', value: stats?.awards ?? 0, href: '/admin/awards', gradient: 'from-[#1a3a4a] to-[#2a4a5a]' },
    { icon: PenTool, label: '博客', value: stats?.blogs ?? 0, href: '/admin/blogs', gradient: 'from-[#2a4a5a] to-[#3a5a6a]' },
    { icon: UserPlus, label: '入社申请', value: stats?.applications ?? 0, href: '/admin/applications', gradient: 'from-[#3a5a6a] to-[#4a6a7a]' },
    { icon: MessageSquare, label: '留言', value: stats?.contacts ?? 0, href: '/admin/contacts', gradient: 'from-[#4a6a7a] to-[#5a7a8a]' },
  ]

  return (
    <AdminLayout>
      <div className="animate-fade-in-up">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-[28px] font-medium text-[#051A24] tracking-tight"
              style={{ fontFamily: "'PP Neue Montreal', 'Noto Sans SC', sans-serif", fontWeight: 500 }}>
              {greeting}，管理员
            </h1>
            <p className="text-sm text-[#273C46]/50 mt-1">欢迎回到星雨作坊管理后台</p>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs text-[#273C46]/40 bg-white rounded-2xl px-4 py-2 border border-[rgba(0,0,0,0.05)]">
            <Clock className="w-3.5 h-3.5" />
            {new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
          </div>
        </div>

        {/* Alert banners */}
        {stats && (stats.pendingApps > 0 || stats.unreadMsgs > 0) && (
          <div className="flex flex-wrap gap-3 mb-6">
            {stats.pendingApps > 0 && (
              <a href="/admin/applications?status=pending"
                className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-2xl text-sm text-amber-800
                  hover:bg-amber-100 transition-colors">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                <span className="font-medium">{stats.pendingApps}</span> 条待处理申请
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </a>
            )}
            {stats.unreadMsgs > 0 && (
              <a href="/admin/contacts?status=unread"
                className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-2xl text-sm text-blue-800
                  hover:bg-blue-100 transition-colors">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                <span className="font-medium">{stats.unreadMsgs}</span> 条未读留言
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </a>
            )}
          </div>
        )}

        {/* Stats grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {stats
            ? statItems.map(item => <StatCard key={item.label} {...item} />)
            : Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
          }
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-8">
          {/* Quick create */}
          <div className="card p-6" style={{ borderRadius: 24 }}>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-xl bg-[#051A24] flex items-center justify-center">
                <Plus className="w-4 h-4 text-white" />
              </div>
              <h2 className="text-sm font-semibold text-[#051A24]">快速创建</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { label: '添加成员', href: '/admin/members' },
                { label: '新建项目', href: '/admin/projects' },
                { label: '添加奖项', href: '/admin/awards' },
                { label: '写博客', href: '/admin/blogs' },
                { label: '新建页面', href: '/admin/pages' },
              ].map(item => (
                <a key={item.label} href={item.href}
                  className="btn-secondary text-xs px-4 py-2">{item.label}</a>
              ))}
            </div>
          </div>

          {/* Site preview */}
          <div className="card p-6 flex flex-col justify-between" style={{ borderRadius: 24 }}>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#051A24] to-[#0D212C] flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <h2 className="text-sm font-semibold text-[#051A24]">网站预览</h2>
              </div>
              <p className="text-xs text-[#273C46]/50">所有修改保存后立即生效，访问网站查看效果</p>
            </div>
            <div className="flex gap-2 mt-4">
              <a href="/" target="_blank" rel="noreferrer" className="btn-primary text-xs px-5 py-2.5 inline-flex items-center gap-2">
                打开网站 <ArrowRight className="w-3.5 h-3.5" />
              </a>
              <a href="/admin/config" className="btn-secondary text-xs px-5 py-2.5">站点配置</a>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
