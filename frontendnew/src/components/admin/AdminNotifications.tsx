import { useState, useEffect, useCallback } from 'react'
import { Bell, CheckCheck, ArrowRight, Clock, FileText, Sparkles } from 'lucide-react'
import AdminLayout from './AdminLayout'
import {
  adminListNotifications, adminMarkNotificationRead, adminMarkAllNotificationsRead,
  type AdminNotificationData,
} from '../../services/adminApi'
import { useToast } from './Toast'
import TagPill from '../ui/TagPill'

const TYPE_ICON: Record<string, typeof Bell> = {
  weekly_report_submitted: FileText,
  weekly_report_analyzed: Sparkles,
}

const FILTERS = [
  { value: '', label: '全部' },
  { value: 'unread', label: '未读' },
]

export default function AdminNotifications() {
  const { toast } = useToast()
  const [notifs, setNotifs] = useState<AdminNotificationData[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const data = await adminListNotifications(filter === 'unread').catch(() => [])
    setNotifs(data)
    setLoading(false)
  }, [filter])

  useEffect(() => { load() }, [load])

  const handleMarkRead = async (n: AdminNotificationData) => {
    if (n.isRead) return
    try {
      await adminMarkNotificationRead(n.id)
      setNotifs(prev => prev.map(x => x.id === n.id ? { ...x, isRead: true } : x))
    } catch { /* silent */ }
  }

  const handleMarkAllRead = async () => {
    try {
      await adminMarkAllNotificationsRead()
      setNotifs(prev => prev.map(x => ({ ...x, isRead: true })))
      toast('success', '已全部标为已读')
    } catch (e: unknown) { toast('error', (e as Error).message) }
  }

  const unreadCount = notifs.filter(n => !n.isRead).length

  return (
    <AdminLayout>
      <div className="animate-fade-in-up">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-[28px] font-medium text-[#051A24] tracking-tight"
              style={{ fontFamily: "'PP Neue Montreal', 'Noto Sans SC', sans-serif", fontWeight: 500 }}>
              教师通知
            </h1>
            <p className="text-sm text-[#273C46]/50 mt-1">
              {notifs.length} 条通知 · {unreadCount} 条未读
            </p>
          </div>
          {unreadCount > 0 && (
            <button onClick={handleMarkAllRead}
              className="btn-secondary text-xs px-4 py-2.5 flex items-center gap-1.5">
              <CheckCheck className="w-3.5 h-3.5" /> 全部标为已读
            </button>
          )}
        </div>

        <div className="flex gap-1.5 mb-6">
          {FILTERS.map(f => (
            <TagPill key={f.value} label={f.label} active={filter === f.value} onClick={() => setFilter(f.value)} />
          ))}
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="card p-4 animate-pulse flex items-center gap-4" style={{ borderRadius: 20 }}>
                <div className="w-9 h-9 rounded-xl bg-[#f0ece6]" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-48 bg-[#f0ece6] rounded-lg" />
                  <div className="h-3 w-64 bg-[#f0ece6] rounded-md" />
                </div>
              </div>
            ))}
          </div>
        ) : notifs.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#f0ece6] flex items-center justify-center mb-4">
              <Bell className="w-7 h-7 text-[#273C46]/20" />
            </div>
            <p className="text-sm text-[#273C46]/50">暂无教师通知</p>
            <p className="text-xs text-[#273C46]/30 mt-1">新周报提交、AI 审核报告生成后会在这里提醒你</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifs.map(n => {
              const Icon = TYPE_ICON[n.type] || Bell
              return (
                <a
                  key={n.id}
                  href={n.link || '/admin/weekly-reports'}
                  onClick={(e) => { if (!n.link) e.preventDefault(); handleMarkRead(n) }}
                  className={`card p-4 flex items-start gap-4 group transition-all hover:translate-x-0.5 ${!n.isRead ? 'border-l-[3px] border-l-[#051A24]' : ''}`}
                  style={{ borderRadius: 20 }}
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${n.isRead ? 'bg-[#f0ece6]' : 'bg-[#051A24]'}`}>
                    <Icon className={`w-4 h-4 ${n.isRead ? 'text-[#273C46]/30' : 'text-white'}`} strokeWidth={1.5} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {!n.isRead && <div className="w-2 h-2 rounded-full bg-[#051A24] shrink-0" />}
                      <p className={`text-sm ${n.isRead ? 'text-[#273C46]/60 font-normal' : 'text-[#051A24] font-semibold'}`}>
                        {n.title}
                      </p>
                    </div>
                    {n.body && (
                      <p className="text-xs text-[#273C46]/50 mt-1 line-clamp-2">{n.body}</p>
                    )}
                    <div className="flex items-center gap-1 mt-2 text-[10px] text-[#273C46]/30">
                      <Clock className="w-3 h-3" />
                      {n.created_at ? new Date(n.created_at).toLocaleString('zh-CN') : ''}
                    </div>
                  </div>

                  <ArrowRight className="w-4 h-4 text-[#273C46]/15 group-hover:text-[#051A24]/30 transition-all shrink-0 mt-1" />
                </a>
              )
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
