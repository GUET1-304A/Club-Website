import { useEffect, useState } from 'react'
import { clientLinkUrl, historyKey, navigate, NAVIGATION_EVENT, restorePageScroll, scrollPositions } from '../lib/navigation'

export function useClientNavigation() {
  const [location, setLocation] = useState(() => ({ href: window.location.href, position: undefined as { x: number; y: number } | undefined }))
  useEffect(() => {
    let currentKey = historyKey()
    let currentHref = window.location.href
    const previousRestoration = window.history.scrollRestoration
    window.history.scrollRestoration = 'manual'
    const pushed = () => {
      currentKey = historyKey()
      currentHref = window.location.href
      setLocation({ href: window.location.href, position: undefined })
    }
    const popped = () => {
      scrollPositions.set(currentKey, { x: window.scrollX, y: window.scrollY })
      currentKey = historyKey()
      currentHref = window.location.href
      setLocation({ href: window.location.href, position: scrollPositions.get(currentKey) || { x: 0, y: 0 } })
    }
    const hashChanged = () => { if (window.location.href !== currentHref) pushed() }
    const clicked = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : (event.target as Node | null)?.parentElement
      const anchor = target?.closest('a')
      if (!anchor) return
      const url = clientLinkUrl(event, { href: anchor.href, target: anchor.target, download: anchor.hasAttribute('download') }, window.location.href)
      if (!url) return
      event.preventDefault()
      navigate(url.href)
    }
    document.addEventListener('click', clicked)
    window.addEventListener(NAVIGATION_EVENT, pushed)
    window.addEventListener('popstate', popped)
    window.addEventListener('hashchange', hashChanged)
    return () => {
      document.removeEventListener('click', clicked)
      window.removeEventListener(NAVIGATION_EVENT, pushed)
      window.removeEventListener('popstate', popped)
      window.removeEventListener('hashchange', hashChanged)
      window.history.scrollRestoration = previousRestoration
    }
  }, [])
  useEffect(() => {
    // History restoration takes precedence over a fragment after Back/Forward.
    return restorePageScroll(location.position ? '' : new URL(location.href).hash, location.position)
  }, [location])
  return new URL(location.href)
}
