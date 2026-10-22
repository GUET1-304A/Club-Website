export const SITE_RESOURCES = ['config', 'projects', 'members', 'awards', 'blogPosts'] as const
export type SiteResource = typeof SITE_RESOURCES[number]
export type ChangedPages = string[] | null
const CHANGE_EVENT = 'xingyu-public-data-change'
const STORAGE_KEY = 'xingyu-public-data-version'

export function affectedSiteResources(url: string, method = 'GET'): SiteResource[] {
  if (['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase())) return []
  if (/^\/admin\/import(?:\/|\?|$)/.test(url)) return [...SITE_RESOURCES]
  if (/^\/admin\/members(?:\/|\?|$)/.test(url)) return ['members', 'config']
  if (/^\/admin\/projects(?:\/|\?|$)/.test(url)) return ['projects', 'config']
  if (/^\/admin\/awards(?:\/|\?|$)/.test(url) || /^\/admin\/certificates\/\d+\/review$/.test(url)) return ['awards', 'config']
  if (/^\/admin\/blogs(?:\/|\?|$)/.test(url)) return ['blogPosts']
  if (/^\/admin\/(config|pages)(?:\/|\?|$)/.test(url)) return ['config']
  return []
}

export function notifySiteDataChange(url: string, method?: string) {
  const resources = affectedSiteResources(url, method)
  if (!resources.length) return
  const pages = affectedPages(url, method)
  const change = { resources, pages }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: change }))
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...change, version: `${Date.now()}-${Math.random()}` }))
  } catch { /* Same-tab refresh still works when storage is unavailable. */ }
}

export function affectedPages(url: string, method = 'GET'): ChangedPages {
  if (['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase())) return []
  if (/^\/admin\/import(?:\/|\?|$)/.test(url) || /^\/admin\/pages\/?(?:\?|$)/.test(url)) return null
  const match = url.match(/^\/admin\/pages\/([a-z\d_-]+)\/?(?:\?|$)/i)
  return match ? [match[1]] : []
}

export function subscribeSiteDataChanges(onChange: (resources: SiteResource[]) => void, onPages?: (pages: ChangedPages) => void) {
  const validate = (value: unknown) => {
    const change = value && typeof value === 'object' ? value as { resources?: unknown; pages?: unknown } : undefined
    const list = Array.isArray(value) ? value : change?.resources
    const resources = SITE_RESOURCES.filter(key => Array.isArray(list) && list.includes(key))
    if (resources.length) onChange(resources)
    if (change?.pages === null) onPages?.(null)
    else if (Array.isArray(change?.pages)) {
      const pages = change.pages.filter((slug): slug is string => typeof slug === 'string' && /^[a-z\d_-]+$/i.test(slug))
      if (pages.length) onPages?.(pages)
    }
  }
  const local = (event: Event) => validate((event as CustomEvent<unknown>).detail)
  const storage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY || !event.newValue) return
    try { validate(JSON.parse(event.newValue)) } catch { /* Ignore malformed or unrelated storage. */ }
  }
  window.addEventListener(CHANGE_EVENT, local)
  window.addEventListener('storage', storage)
  return () => { window.removeEventListener(CHANGE_EVENT, local); window.removeEventListener('storage', storage) }
}
