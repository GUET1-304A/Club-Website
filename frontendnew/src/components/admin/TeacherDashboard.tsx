import { useState, useEffect } from 'react'
import {
  ClipboardCheck, BadgeCheck, FolderGit2, Bell, ArrowRight, User, Calendar,
} from 'lucide-react'
import AdminLayout from './AdminLayout'
import {
  adminListWeeklyReports, adminListCertificates, adminListProjects, adminListNotifications,
  type AdminWeeklyReport, type AdminCertificate, type AdminProject, type AdminNotificationData,
} from '../../services/adminApi'

interface StatItem {
  icon: typeof ClipboardCheck
  label: string
  value: number
  href: string
  gradient: string
}

export default function TeacherDashboard() {
  const [reports, setReports] = useState<AdminWeeklyReport[]>([])
  const [certificates, setCertificates] = useState<AdminCertificate[]>([])
  const [projects, setProjects] = useState<AdminProject[]>([])
  const [notifications, setNotifications] = useState<AdminNotificationData[]>([])
  const [loading, setLoading] = useState(true)
  const [greeting, setGreeting] = useState('')

  useEffect(() => {
    const hour = new Date().getHours()
    setGreeting(hour < 12 ? '早上好' : hour < 18 ? '下午好' : '晚上好')

    Promise.all([
      adminListWeeklyReports().catch(() => []),
      adminListCertificates().catch(() => []),
      adminListProjects().catch(() => []),
      adminListNotifications().catch(() => []),
    ]).then(([reportList, certList, projectList, notifList]) => {
      setReports(reportList)
      setCertificates(certList)
      setProjects(projectList)
      setNotifications(notifList)
      setLoading(false)
    })
  }, [])

  const pendingReports = reports.filter(report => report.status === 'submitted')
  const pendingCertificates = certificates.filter(cert => cert.status === 'pending')
  const activeProjects = projects.filter(project => project.status === 'active')
  const unreadCount = notifications.filter(item => !item.isRead).length

  const stats: StatItem[] = [
    { icon: ClipboardCheck, label: '待审周报', value: pendingReports.length, href: '/admin/weekly-reports', gradient: 'from-[#051A24] to-[#0D212C]' },
    { icon: BadgeCheck, label: '待审证书', value: pendingCertificates.length, href: '/admin/certificates', gradient: 'from-[#0D212C] to-[#1a3a4a]' },
    { icon: FolderGit2, label: '进行中项目', value: activeProjects.length, href: '/admin/projects', gradient: 'from-[#1a3a4a] to-[#2a4a5a]' },
    { icon: Bell, label: '未读通知', value: unreadCount, href: '/admin/notifications', gradient: 'from-[#2a4a5a] to-[#3a5a6a]' },
  ]

  const quickActions = [
    { icon: ClipboardCheck, label: '审阅周报', href: '/admin/weekly-reports' },
    { icon: BadgeCheck, label: '审核证书', href: '/admin/certificates' },
    { icon: FolderGit2, label: '查看项目', href: '/admin/projects' },
    { icon: Bell, label: '教师通知', href: '/admin/notifications' },
  ]

  return (
    <AdminLayout>
      <div className="animate-fade-in-up">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-[28px] font-medium text-[#051A24] tracking-tight"
              style={{ fontFamily: "var(--font-sans)", fontWeight: 500 }}>
              {greeting}，老师
            </h1>
            <p className="text-sm text-[#273C46]/50 mt-1">这是你的教学审阅工作台，先处理最重要的待办</p>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs text-[#273C46]/40 bg-white rounded-2xl px-4 py-2 border border-[rgba(0,0,0,0.05)]">
            {new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="card p-5 flex items-center gap-4 animate-pulse" style={{ borderRadius: 22 }}>
                <div className="w-12 h-12 rounded-2xl bg-[#f0ece6]" />
                <div className="space-y-2">
                  <div className="h-7 w-12 bg-[#f0ece6] rounded-lg" />
                  <div className="h-3 w-16 bg-[#f0ece6] rounded-md" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map(item => (
              <a key={item.label} href={item.href}
                className="group card p-5 flex items-center gap-4 hover:translate-y-[-3px] transition-all duration-300"
                style={{ borderRadius: 22 }}>
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center bg-gradient-to-br ${item.gradient} shadow-lg shadow-[#051A24]/5 group-hover:shadow-xl transition-shadow`}>
                  <item.icon className="w-5 h-5 text-white" strokeWidth={1.5} />
                </div>
                <div>
                  <p className="text-[28px] font-semibold text-[#051A24] leading-none tracking-tight"
                    style={{ fontFamily: "var(--font-sans)" }}>
                    {item.value}
                  </p>
                  <p className="text-xs text-[#273C46]/50 mt-1 font-medium">{item.label}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-[#273C46]/20 group-hover:text-[#051A24]/40 group-hover:translate-x-0.5 transition-all ml-auto" />
              </a>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <div className="card p-6" style={{ borderRadius: 24 }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-[#051A24]">最近提交的周报</h2>
              <a href="/admin/weekly-reports" className="text-xs text-[#273C46]/50 hover:text-[#051A24] inline-flex items-center gap-1">
                全部周报 <ArrowRight className="w-3 h-3" />
              </a>
            </div>
            {pendingReports.length === 0 ? (
              <p className="text-sm text-[#273C46]/40 py-8 text-center">暂时没有待审周报</p>
            ) : (
              <div className="space-y-2">
                {pendingReports.slice(0, 5).map(report => (
                  <a key={report.id} href={`/admin/weekly-reports?report=${report.id}`}
                    className="block p-3 rounded-2xl bg-[#fcfbfa] border border-[rgba(0,0,0,0.04)] hover:bg-white hover:shadow-sm transition-all">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-[#051A24] truncate">{report.memberName || '未知成员'}</span>
                      <span className="text-[10px] text-amber-700 bg-amber-50 rounded-full px-2 py-0.5">待审阅</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 text-[11px] text-[#273C46]/50">
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {report.weekStart || '未指定周'}</span>
                      {report.projectName && (
                        <span className="flex items-center gap-1"><FolderGit2 className="w-3 h-3" /> {report.projectName}</span>
                      )}
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>

          <div className="card p-6" style={{ borderRadius: 24 }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-[#051A24]">待审核证书</h2>
              <a href="/admin/certificates" className="text-xs text-[#273C46]/50 hover:text-[#051A24] inline-flex items-center gap-1">
                全部证书 <ArrowRight className="w-3 h-3" />
              </a>
            </div>
            {pendingCertificates.length === 0 ? (
              <p className="text-sm text-[#273C46]/40 py-8 text-center">暂时没有待审核证书</p>
            ) : (
              <div className="space-y-2">
                {pendingCertificates.slice(0, 5).map(cert => (
                  <a key={cert.id} href="/admin/certificates"
                    className="block p-3 rounded-2xl bg-[#fcfbfa] border border-[rgba(0,0,0,0.04)] hover:bg-white hover:shadow-sm transition-all">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-[#051A24] truncate">{cert.name}</span>
                      <span className="text-[10px] text-amber-700 bg-amber-50 rounded-full px-2 py-0.5">待审核</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 text-[11px] text-[#273C46]/50">
                      <span className="flex items-center gap-1"><User className="w-3 h-3" /> {cert.memberName || '未知成员'}</span>
                      {cert.date && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {cert.date}</span>}
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="card p-6 mt-6" style={{ borderRadius: 24 }}>
          <h2 className="text-sm font-semibold text-[#051A24] mb-4">快捷入口</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {quickActions.map(action => (
              <a key={action.label} href={action.href}
                className="flex items-center gap-3 p-3.5 rounded-2xl bg-[#fcfbfa] border border-[rgba(0,0,0,0.04)] hover:bg-white hover:border-[rgba(0,0,0,0.08)] hover:shadow-sm transition-all">
                <div className="w-9 h-9 rounded-xl bg-[#051A24] flex items-center justify-center">
                  <action.icon className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm font-medium text-[#051A24]">{action.label}</span>
                <ArrowRight className="w-3.5 h-3.5 text-[#273C46]/20 ml-auto" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
