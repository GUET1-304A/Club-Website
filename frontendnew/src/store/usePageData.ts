import { useEffect, useSyncExternalStore } from 'react'
import { ApiError, fetchPage, type PageData } from '../services/api'
import { PAGE_SLUGS, validatePageContent, type PageSlug } from '../lib/pageContent'
import { subscribeSiteDataChanges } from '../lib/siteDataEvents'
import { createResourceCache } from './resourceCache'

type Pages = Record<PageSlug, PageData | null>
const initial = Object.fromEntries(PAGE_SLUGS.map(slug => [slug, null])) as Pages
const loaders = Object.fromEntries(PAGE_SLUGS.map(slug => [slug, async () => {
  try {
    const page = await fetchPage(slug)
    return { ...page, content: validatePageContent(slug, page?.content) }
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null
    throw error
  }
}])) as { [K in PageSlug]: () => Promise<PageData | null> }
const cache = createResourceCache<Pages>(initial, loaders)
const active = new Map<PageSlug, number>()
let stopEvents: (() => void) | undefined
const activeSlugs = () => PAGE_SLUGS.filter(slug => (active.get(slug) || 0) > 0)

function startEvents() {
  if (stopEvents) return
  const refresh = () => { if (!document.hidden) void cache.load(activeSlugs()) }
  const unsubscribe = subscribeSiteDataChanges(() => {}, pages => {
    const slugs = pages === null ? [...PAGE_SLUGS] : PAGE_SLUGS.filter(slug => pages.includes(slug))
    cache.invalidate(slugs)
    void cache.load(slugs.filter(slug => (active.get(slug) || 0) > 0))
  })
  window.addEventListener('focus', refresh)
  document.addEventListener('visibilitychange', refresh)
  stopEvents = () => {
    unsubscribe()
    window.removeEventListener('focus', refresh)
    document.removeEventListener('visibilitychange', refresh)
    stopEvents = undefined
  }
}

// Keep invalidation alive when the public page is unmounted (for example while
// editing it in the admin SPA). Otherwise a quick return can reuse stale data
// until the TTL expires. Focus handlers only load currently active pages.
if (import.meta.hot) import.meta.hot.dispose(() => stopEvents?.())

export function usePageData(slug: PageSlug) {
  const state = useSyncExternalStore(cache.subscribe, cache.getSnapshot, cache.getSnapshot)
  useEffect(() => {
    active.set(slug, (active.get(slug) || 0) + 1)
    startEvents()
    void cache.load([slug])
    return () => {
      active.set(slug, Math.max(0, (active.get(slug) || 0) - 1))
    }
  }, [slug])
  return {
    page: state.data[slug], status: state.status[slug], error: state.errors[slug], loaded: state.loaded[slug],
    retry: () => void cache.load([slug], true),
  }
}
