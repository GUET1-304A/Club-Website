export const NAVIGATION_EVENT = 'xingyu-navigation'
export const HISTORY_KEY = 'xingyuHistoryKey'
export const scrollPositions = new Map<string, { x: number; y: number }>()

export function clientLinkUrl(
  event: { defaultPrevented: boolean; button: number; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean },
  anchor: { href: string; target: string; download: boolean },
  currentHref: string,
): URL | null {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null
  if (!anchor.href || anchor.download || (anchor.target && anchor.target.toLowerCase() !== '_self')) return null
  try {
    const current = new URL(currentHref)
    const url = new URL(anchor.href, current)
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== current.origin) return null
    if (/^\/(api|uploads)(\/|$)/.test(url.pathname)) return null
    return url
  } catch { return null }
}

export function historyKey() {
  let key = window.history.state?.[HISTORY_KEY] as string | undefined
  if (!key) {
    key = `${Date.now()}-${Math.random()}`
    window.history.replaceState({ ...window.history.state, [HISTORY_KEY]: key }, '')
  }
  return key
}

export function navigate(href: string) {
  const url = new URL(href, window.location.href)
  if (url.origin !== window.location.origin || /^\/(api|uploads)(\/|$)/.test(url.pathname)) {
    window.location.assign(url.href)
    return
  }
  scrollPositions.set(historyKey(), { x: window.scrollX, y: window.scrollY })
  if (url.href !== window.location.href) {
    window.history.pushState({ [HISTORY_KEY]: `${Date.now()}-${Math.random()}` }, '', url.pathname + url.search + url.hash)
  }
  window.dispatchEvent(new Event(NAVIGATION_EVENT))
}

export function restorePageScroll(hash: string, position = { x: 0, y: 0 }) {
  let frame = 0
  let stopped = false
  const cleanup = () => {
    stopped = true
    cancelAnimationFrame(frame)
    clearTimeout(timer)
    observer.disconnect()
    resize.disconnect()
  }
  const attempt = () => {
    frame = 0
    if (stopped) return
    if (hash) {
      let id = hash.slice(1)
      try { id = decodeURIComponent(id) } catch { /* Keep malformed fragments literal. */ }
      const target = document.getElementById(id) || document.getElementsByName(id)[0]
      if (!target?.getClientRects().length) return
      const navHeight = document.querySelector('nav')?.getBoundingClientRect().height || 0
      window.scrollTo({ top: Math.max(0, target.getBoundingClientRect().top + window.scrollY - navHeight - 12), behavior: 'instant' })
    } else {
      if (document.documentElement.scrollHeight - window.innerHeight < position.y) return
      window.scrollTo({ left: position.x, top: position.y, behavior: 'instant' })
    }
    cleanup()
  }
  const schedule = () => { if (!stopped && !frame) frame = requestAnimationFrame(attempt) }
  const observer = new MutationObserver(schedule)
  const resize = new ResizeObserver(schedule)
  observer.observe(document.body, { childList: true, subtree: true })
  resize.observe(document.body)
  const timer = setTimeout(() => {
    if (!hash) window.scrollTo({ left: position.x, top: position.y, behavior: 'instant' })
    cleanup()
  }, 5000)
  schedule()
  return cleanup
}
