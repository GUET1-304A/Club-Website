import { useEffect, useRef } from 'react'
import { memberListNotifications, type NotificationData } from '../../services/memberApi'
import { useToast } from '../admin/Toast'

/**
 * 新通知监听器：登录成员在线时轮询通知列表，
 * 发现比上次更新的通知（新到达）立即弹出 Toast 提醒。
 * 只在页面处于前台（visible）时弹窗，避免打扰后台标签页。
 */
const POLL_INTERVAL = 15000

export default function NotificationWatcher() {
  const { toast } = useToast()
  const lastMaxIdRef = useRef<number | null>(null)
  const initializedRef = useRef(false)

  useEffect(() => {
    let cancelled = false

    const check = async () => {
      if (cancelled || document.visibilityState !== 'visible') return
      const notifications = await memberListNotifications().catch(
        () => [] as NotificationData[],
      )
      if (cancelled || notifications.length === 0) return

      const maxId = Math.max(...notifications.map(n => n.id))

      // 首次加载只建立基线，不弹窗
      if (!initializedRef.current) {
        initializedRef.current = true
        lastMaxIdRef.current = maxId
        return
      }

      if (lastMaxIdRef.current !== null && maxId > lastMaxIdRef.current) {
        const fresh = notifications
          .filter(n => n.id > (lastMaxIdRef.current ?? 0))
          .slice(0, 3)
        lastMaxIdRef.current = maxId
        fresh.forEach(n => {
          const detail = n.body
            ? ` — ${n.body.slice(0, 60)}${n.body.length > 60 ? '…' : ''}`
            : ''
          toast('info', `${n.title}${detail}`)
        })
      } else {
        lastMaxIdRef.current = maxId
      }
    }

    check()
    const interval = setInterval(check, POLL_INTERVAL)
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') check()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      cancelled = true
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [toast])

  return null
}
