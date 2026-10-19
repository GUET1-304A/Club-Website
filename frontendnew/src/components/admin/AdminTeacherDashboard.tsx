import { useState, useEffect, useCallback } from 'react'
import {
  ClipboardCheck, BadgeCheck, Bell, ArrowRight, Clock, Calendar, Award,
} from 'lucide-react'
import AdminLayout from './AdminLayout'
import { adminTeacherOverview, type TeacherOverview } from '../../services/adminApi'

function StatCard({ icon: Icon, label, value, href, tone }: {
  icon: typeof ClipboardCheck
  label: string
  value: number
  href: string
  tone: string
}) {
  return (
    <a
      href={href}
      className="card p-5 flex items-center gap-4 hover:translate-y-[-3px] transition-all duration-300"
      style={{ borderRadius: 22 }}
    >
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${tone}`}>
        <Icon className="w-5 h-5 text-white" strokeWidth={1.5} />
      </div>
      <div className="flex-1">
        <p className="text-[28px] font-semibold text-[#051A24] leading-none tracking-tight"
          style={{ fontFamily: "var(--font-sans)" }}>
          {value}
        </p>
        <p className="text-xs text-[#273C46]/50 mt-1 font-medium">{label}</p>
      </div>
      <ArrowRight className="w-4 h-4 text-[#273C46]/20" />
    </a>
  )
}

export default function AdminTeacherDashboard() {
  const [overview, setOverview] = useState<TeacherOverview | null>(null)

  const load = useCallback(async () => {
    const data = await adminTeacherOverview().catch(() => null)
    setOverview(data)
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <AdminLayout>
      <div className="animate-fade-in-up">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-[28px] font-medium text-[#051A24] tracking-tight"
              style={{ fontFamily: "var(--font-sans)", fontWeight: 500 }}>
              教师工作台
            </h1>
            <p className="text-sm text-[#273C46]/50 mt-1">待审事项集中在这里，处理完就能去休息了</p>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs text-[#273C46]/40 bg-white rounded-2xl px-4 py-2 border border-[rgba(0,0,0,0.05)]">
            <Clock className="w-3.5 h-3.5" />
            {new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <StatCard
            icon={ClipboardCheck}
            label="待审周报"
            value={overview?.pendingWeeklyReports ?? 0}
            href="/admin/weekly-reports"
            tone="bg-[#051A24]"
          />
          <StatCard
            icon={BadgeCheck}
            label="待审证书"
            value={overview?.pendingCertificates ?? 0}
            href="/admin/certificates"
            tone="bg-[#0D212C]"
          />
          <StatCard
            icon={Bell}
            label="未读通知"
            value={overview?.unreadNotifications ?? 0}
            href="/admin/notifications"
            tone="bg-[#1a3a4a]"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card p-6" style={{ borderRadius: 24 }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-[#051A24]">最近提交的周报</h2>
              <a href="/admin/weekly-reports" className="text-xs text-[#273C46]/50 hover:text-[#051A24] inline-flex items-center gap-1">
                全部周报 <ArrowRight className="w-3 h-3" />
              </a>
            </div>
            {!overview ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-16 bg-[#f0ece6] rounded-2xl animate-pulse" />
                ))}
              </div>
            ) : overview.recentWeeklyReports.length === 0 ? (
              <p className="text-sm text-[#273C46]/40 py-10 text-center">暂时没有待审周报</p>
            ) : (
              <div className="space-y-2">
                {overview.recentWeeklyReports.map(report => (
                  <a
                    key={report.id}
                    href="/admin/weekly-reports"
                    className="block p-3 rounded-2xl bg-[#fcfbfa] border border-[rgba(0,0,0,0.04)] hover:bg-white hover:shadow-sm transition-all"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#051A24] truncate">
                          {report.memberName || '成员'}
                        </p>
                        <p className="text-[11px] text-[#273C46]/50 mt-1 line-clamp-1">
                          {report.content?.done || '（暂无内容）'}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[11px] text-[#273C46]/50 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {report.weekStart || '-'}
                        </p>
                        <p className="text-[10px] text-amber-600 mt-1">待审阅</p>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>

          <div className="card p-6" style={{ borderRadius: 24 }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-[#051A24]">待审证书</h2>
              <a href="/admin/certificates" className="text-xs text-[#273C46]/50 hover:text-[#051A24] inline-flex items-center gap-1">
                全部证书 <ArrowRight className="w-3 h-3" />
              </a>
            </div>
            {!overview ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-16 bg-[#f0ece6] rounded-2xl animate-pulse" />
                ))}
              </div>
            ) : overview.recentCertificates.length === 0 ? (
              <p className="text-sm text-[#273C46]/40 py-10 text-center">暂时没有待审证书</p>
            ) : (
              <div className="space-y-2">
                {overview.recentCertificates.map(cert => (
                  <a
                    key={cert.id}
                    href="/admin/certificates"
                    className="block p-3 rounded-2xl bg-[#fcfbfa] border border-[rgba(0,0,0,0.04)] hover:bg-white hover:shadow-sm transition-all"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#051A24] truncate">{cert.name}</p>
                        <p className="text-[11px] text-[#273C46]/50 mt-1 line-clamp-1">
                          {cert.memberName || '成员'} · {cert.issuer || '未填写颁发机构'}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[11px] text-[#273C46]/50 flex items-center gap-1">
                          <Award className="w-3 h-3" />
                          {cert.date || '-'}
                        </p>
                        <p className="text-[10px] text-amber-600 mt-1">待审核</p>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}
