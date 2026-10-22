import { useEffect, useRef, useState } from 'react'

export default function BackgroundVideo({ src, enabled }: { src: string; enabled: boolean }) {
  const ref = useRef<HTMLVideoElement>(null)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!enabled) { setReady(false); return }
    let idle: number | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    let started = false
    const load = () => {
      idle = undefined
      timer = undefined
      if (document.hidden) return
      started = true
      setReady(true)
    }
    const schedule = () => {
      if (started || document.hidden || idle !== undefined || timer !== undefined) return
      if ('requestIdleCallback' in window) idle = window.requestIdleCallback(load, { timeout: 1000 })
      else timer = setTimeout(load, 150)
    }
    schedule()
    document.addEventListener('visibilitychange', schedule)
    return () => {
      document.removeEventListener('visibilitychange', schedule)
      if (idle !== undefined) window.cancelIdleCallback(idle)
      clearTimeout(timer)
    }
  }, [enabled])

  useEffect(() => {
    const update = () => {
      const video = ref.current
      if (!video) return
      if (document.hidden) video.pause()
      else void video.play().catch(() => { /* Poster remains visible if autoplay is unavailable. */ })
    }
    update()
    document.addEventListener('visibilitychange', update)
    return () => document.removeEventListener('visibilitychange', update)
  }, [ready, enabled])

  if (!enabled || !ready || failed) return null
  return <video ref={ref} src={src} autoPlay loop muted playsInline preload="metadata"
    poster="/hero-poster.webp" aria-hidden="true" tabIndex={-1} onError={() => setFailed(true)}
    className="fixed inset-0 w-full h-full object-cover z-0 pointer-events-none" />
}
