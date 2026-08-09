import { useState, useEffect, type ReactNode } from 'react'
import { useLocation } from './router'
import { isLoggedIn, clearToken } from '../../services/api'
import {
  LayoutDashboard, Users, FolderGit2, Trophy, PenTool,
  FileText, Settings, UserPlus, MessageSquare, Database, BadgeCheck, LogOut, Menu, X,
  ChevronLeft, ChevronRight, Sparkles, ExternalLink,
} from 'lucide-react'
import Logo from '../ui/Logo'

const navGroups = [
  {
    label: '概览',
    items: [
      { label: '仪表盘', href: '/admin', icon: LayoutDashboard },
    ],
  },
  {
    label: '内容管理',
    items: [
      { label: '成员管理', href: '/admin/members', icon: Users },
      { label: '证书审核', href: '/admin/certificates', icon: BadgeCheck },
      { label: '项目管理', href: '/admin/projects', icon: FolderGit2 },
      { label: '奖项管理', href: '/admin/awards', icon: Trophy },
      { label: '博客管理', href: '/admin/blogs', icon: PenTool },
      { label: '页面管理', href: '/admin/pages', icon: FileText },
    ],
  },
  {
    label: '运营',
    items: [
      { label: '站点配置', href: '/admin/config', icon: Settings },
      { label: '入社申请', href: '/admin/applications', icon: UserPlus },
      { label: '留言管理', href: '/admin/contacts', icon: MessageSquare },
      { label: '数据管理', href: '/admin/data', icon: Database },
    ],
  },
]

export default function AdminLayout({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [authed, setAuthed] = useState<boolean | null>(null)

  useEffect(() => {
    setAuthed(isLoggedIn())
  }, [])

  if (authed === false) return <LoginRedirect />
  if (authed === null) return <LoadingScreen />

  return (
    <div className="min-h-screen flex bg-[#f8f7f5]">
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
                fontFamily: "'PP Neue Montreal', 'Noto Sans SC', sans-serif",
                fontWeight: 500,
                opacity: sidebarOpen ? 1 : 0,
                width: sidebarOpen ? 'auto' : 0,
                overflow: 'hidden',
              }}
            >
              管理后台
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
            onClick={() => { clearToken(); window.location.href = '/admin/login' }}
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
            <span className="text-sm font-medium text-[#051A24] tracking-tight">管理后台</span>
          </div>
          <div className="w-8" />
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
  const isActive = location === href || (href !== '/admin' && location.startsWith(href))

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

/* ─── States ─── */
function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f7f5]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-2xl bg-[#051A24] flex items-center justify-center shadow-lg animate-float">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div className="flex gap-1">
          {[0, 1, 2].map(i => (
            <div key={i} className="w-2 h-2 rounded-full bg-[#051A24]/20 animate-bounce" style={{ animationDelay: `${i * 0.1}s` }} />
          ))}
        </div>
      </div>
    </div>
  )
}

function LoginRedirect() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f7f5]">
      <div className="text-center animate-fade-in-up">
        <div className="mx-auto"><Logo size="lg" /></div>
        <h1 className="text-2xl font-medium text-[#051A24] mt-6 tracking-tight">管理后台</h1>
        <p className="text-sm text-[#273C46]/60 mt-2">请先登录以访问管理功能</p>
        <a href="/admin/login" className="btn-primary inline-flex mt-8">前往登录</a>
      </div>
    </div>
  )
}
