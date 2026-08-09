import { useState, useEffect, useCallback } from 'react'
import { Bell } from 'lucide-react'
import { memberUnreadCount, memberListNotifications, memberMarkRead } from '../../services/memberApi'
import type { NotificationData } from '../../services/memberApi'

export default function NotificationBell() {
  const [count, setCount] = useState(0)
  const [open, setOpen] = useState(false)
  const [notifs, setNotifs] = useState<NotificationData[]>([])

  const refresh = useCallback(async () => {
    const { count: c } = await memberUnreadCount().catch(() => ({ count: 0 }))
    setCount(c)
    if (c > 0) {
      const list = await memberListNotifications(true).catch(() => [])
      setNotifs(list.slice(0, 5))
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  useEffect(() => {
    // Poll every 30s
    const iv = setInterval(refresh, 30000)
    return () => clearInterval(iv)
  }, [refresh])

  const handleMarkRead = async (id: number) => {
    await memberMarkRead(id).catch(() => {})
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n))
    setCount(c => Math.max(0, c - 1))
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-xl hover:bg-[rgba(0,0,0,0.04)] text-[#273C46]/50 hover:text-[#051A24] transition-all"
      >
        <Bell className="w-[18px] h-[18px]" strokeWidth={1.5} />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none shadow-sm">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-[rgba(0,0,0,0.06)] z-50 overflow-hidden animate-fade-in-up">
            <div className="p-3 border-b border-[rgba(0,0,0,0.04)] flex items-center justify-between">
              <span className="text-xs font-semibold text-[#051A24]">通知</span>
              {count > 0 && <span className="text-[10px] text-[#273C46]/50">{count} 条未读</span>}
            </div>

            {notifs.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#273C46]/40">暂无新通知</div>
            ) : (
              <div className="max-h-80 overflow-y-auto">
                {notifs.map(n => (
                  <a
                    key={n.id}
                    href={n.link || '#'}
                    onClick={() => handleMarkRead(n.id)}
                    className={`block px-4 py-3 hover:bg-[#fcfbfa] transition-colors border-b border-[rgba(0,0,0,0.02)] ${!n.isRead ? 'bg-[#051A24]/[0.01]' : ''}`}
                  >
                    <div className="flex items-start gap-2">
                      {!n.isRead && <div className="w-1.5 h-1.5 rounded-full bg-[#051A24] mt-1.5 shrink-0" />}
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-[#051A24] truncate">{n.title}</p>
                        {n.body && <p className="text-[11px] text-[#273C46]/50 line-clamp-2 mt-0.5">{n.body}</p>}
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            )}

            <a
              href="/member/notifications"
              className="block p-3 text-center text-xs font-medium text-[#273C46]/60 hover:text-[#051A24] hover:bg-[#fcfbfa] transition-colors border-t border-[rgba(0,0,0,0.04)]"
            >
              查看全部通知
            </a>
          </div>
        </>
      )}
    </div>
  )
}
