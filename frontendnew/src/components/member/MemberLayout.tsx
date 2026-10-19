import { useState, type ReactNode } from 'react'
import { useLocation } from '../admin/router'
import {
  LayoutDashboard, FolderGit2, CheckSquare, FolderOpen,
  Trophy, Users, Bell, Settings, LogOut, Menu, X,
  ChevronLeft, ChevronRight, ExternalLink, Sparkles,
} from 'lucide-react'
import Logo from '../ui/Logo'
import { memberLogout } from '../../services/memberApi'
import type { MemberProfile } from '../../services/memberApi'
import NotificationBell from './NotificationBell'
import NotificationWatcher from './NotificationWatcher'

const navGroups = [
  {
    label: '概览',
    items: [
      { label: '工作台', href: '/member/dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: '项目',
    items: [
      { label: '我的项目', href: '/member/projects', icon: FolderGit2 },
      { label: '我的任务', href: '/member/tasks', icon: CheckSquare },
    ],
  },
  {
    label: '资源',
    items: [
      { label: '资源中心', href: '/member/resources', icon: FolderOpen },
      { label: '证书管理', href: '/member/certificates', icon: Trophy },
    ],
  },
  {
    label: '成员',
    items: [
      { label: '通讯录', href: '/member/directory', icon: Users },
    ],
  },
  {
    label: '智能',
    items: [
      { label: 'AI 助手', href: '/member/assistant', icon: Sparkles },
    ],
  },
  {
    label: '通知',
    items: [
      { label: '通知中心', href: '/member/notifications', icon: Bell },
    ],
  },
  {
    label: '设置',
    items: [
      { label: '个人资料', href: '/member/profile', icon: Settings },
    ],
  },
]

interface Props {
  children: ReactNode
  member: MemberProfile
}

export default function MemberLayout({ children, member }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleLogout = () => {
    memberLogout()
    window.location.href = '/member/login'
  }

  return (
    <div className="min-h-screen flex bg-[#f8f7f5]">
      {/* 新通知到达时弹窗提醒（仅在成员门户内生效） */}
      <NotificationWatcher />
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 lg:hidden transition-opacity"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ─── Sidebar ─── */}
      <aside
        className={`fixed lg:sticky top-0 left-0 h-screen z-50
          bg-white/90 backdrop-blur-xl border-r border-[rgba(0,0,0,0.05)]
          transition-all duration-300 overflow-hidden flex flex-col
          ${sidebarOpen ? 'w-[250px]' : 'w-0 lg:w-[68px]'}
          ${mobileOpen ? 'translate-x-0 w-[250px]' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Brand */}
        <div className="flex items-center h-14 px-4 border-b border-[rgba(0,0,0,0.05)] shrink-0">
          <a href="/" className="flex items-center gap-2.5 group" title="返回网站首页">
            <Logo size="md" className="group-hover:scale-105 transition-transform" />
            <span
              className="text-sm font-medium text-[#051A24] whitespace-nowrap tracking-tight transition-opacity duration-200"
              style={{
                fontFamily: "var(--font-sans)",
                fontWeight: 500,
                opacity: sidebarOpen ? 1 : 0,
                width: sidebarOpen ? 'auto' : 0,
                overflow: 'hidden',
              }}
            >
              成员门户
            </span>
          </a>
          <button
            onClick={() => { setSidebarOpen(!sidebarOpen); setMobileOpen(false) }}
            className="hidden lg:flex items-center justify-center w-7 h-7 ml-auto rounded-lg
              hover:bg-[rgba(0,0,0,0.04)] text-[#273C46]/50 hover:text-[#051A24] transition-all"
            title={sidebarOpen ? '收起侧栏' : '展开侧栏'}
          >
            {sidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
          <button onClick={() => setMobileOpen(false)} className="lg:hidden p-1.5 text-[#273C46] ml-auto">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-5 scrollbar-thin">
          {navGroups.map((group) => (
            <div key={group.label}>
              <p
                className="px-3 mb-1.5 text-[10px] font-semibold text-[#273C46]/40 uppercase tracking-[0.08em]
                  transition-opacity duration-200"
                style={{ opacity: sidebarOpen ? 1 : 0, height: sidebarOpen ? 'auto' : 0, overflow: 'hidden' }}
              >
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <SidebarLink
                    key={item.href}
                    href={item.href}
                    icon={item.icon}
                    label={item.label}
                    collapsed={!sidebarOpen}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="shrink-0 border-t border-[rgba(0,0,0,0.05)]">
          {/* Member info */}
          <div
            className={`flex items-center w-full px-4 py-2.5 gap-2.5 border-b border-[rgba(0,0,0,0.03)]
              ${sidebarOpen ? 'justify-start' : 'justify-center'}`}
          >
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#f0ece6] to-[#e8e4dc] overflow-hidden shrink-0 ring-1 ring-white">
              {member.avatar
                ? <img src={member.avatar} alt="" className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center text-[10px] font-semibold text-[#273C46]/40">{member.name?.[0] || '?'}</div>
              }
            </div>
            {sidebarOpen && (
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-[#051A24] truncate">{member.name}</p>
                <p className="text-[10px] text-[#273C46]/40 truncate">{member.role || member.group || ''}</p>
              </div>
            )}
          </div>

          {/* View site link */}
          <a
            href="/"
            target="_blank"
            rel="noreferrer"
            className={`flex items-center w-full px-4 py-2.5 text-xs text-[#273C46]/60 hover:text-[#051A24] hover:bg-[rgba(0,0,0,0.02)] transition-all
              ${sidebarOpen ? 'justify-start gap-2' : 'justify-center'}`}
          >
            <ExternalLink className="w-3.5 h-3.5 shrink-0" />
            {sidebarOpen && <span>查看网站</span>}
          </a>
          {/* Logout */}
          <button
            onClick={handleLogout}
            className={`flex items-center w-full px-4 py-2.5 text-xs text-[#273C46]/60 hover:text-red-500 hover:bg-red-50/50 transition-all
              ${sidebarOpen ? 'justify-start gap-2' : 'justify-center'}`}
          >
            <LogOut className="w-3.5 h-3.5 shrink-0" />
            {sidebarOpen && <span>退出登录</span>}
          </button>
        </div>
      </aside>

      {/* ─── Main ─── */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile top bar */}
        <div className="lg:hidden sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-[rgba(0,0,0,0.05)] px-4 h-14 flex items-center justify-between">
          <button onClick={() => setMobileOpen(true)} className="p-1.5 -ml-1 rounded-lg text-[#051A24]">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Logo size="sm" />
            <span className="text-sm font-medium text-[#051A24] tracking-tight">成员门户</span>
          </div>
          <NotificationBell />
        </div>

        <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-[1400px] w-full">
          {children}
        </main>
      </div>
    </div>
  )
}

/* ─── Sidebar Link ─── */
function SidebarLink({ href, icon: Icon, label, collapsed }: {
  href: string; icon: typeof LayoutDashboard; label: string; collapsed: boolean
}) {
  const location = useLocation()
  const isActive = location === href || (href !== '/member' && href !== '/member/dashboard' && location.startsWith(href))

  return (
    <a
      href={href}
      className={`relative flex items-center rounded-xl text-sm font-medium transition-all duration-200 group
        ${isActive
          ? 'bg-[#051A24] text-white shadow-sm shadow-[#051A24]/10'
          : 'text-[#273C46] hover:bg-[rgba(0,0,0,0.03)] hover:text-[#051A24]'
        }
        ${collapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2.5'}
      `}
    >
      <Icon className={`w-[18px] h-[18px] shrink-0 transition-transform duration-200 ${isActive ? 'scale-105' : ''}`} strokeWidth={1.5} />
      {!collapsed && <span className="ml-3">{label}</span>}
      {/* Tooltip when collapsed */}
      {collapsed && (
        <span className="absolute left-full ml-3 px-2.5 py-1.5 bg-[#051A24] text-white text-xs font-medium rounded-lg
          opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 shadow-lg
          translate-x-1 group-hover:translate-x-0">
          {label}
        </span>
      )}
      {/* Active indicator dot */}
      {isActive && collapsed && (
        <span className="absolute right-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-white" />
      )}
    </a>
  )
}
