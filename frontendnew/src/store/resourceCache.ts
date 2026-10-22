export type ResourceStatus = 'idle' | 'loading' | 'success' | 'error'

export interface ResourceSnapshot<T> {
  data: T
  status: Record<keyof T, ResourceStatus>
  errors: Partial<Record<keyof T, string>>
  loaded: Record<keyof T, boolean>
}

export function createResourceCache<T extends object>(
  initial: T,
  loaders: { [K in keyof T]: () => Promise<T[K]> },
  { ttl = 60_000, now = Date.now }: { ttl?: number; now?: () => number } = {},
) {
  type Key = keyof T
  const keys = Object.keys(initial) as Key[]
  let state: ResourceSnapshot<T> = {
    data: initial,
    status: Object.fromEntries(keys.map(key => [key, 'idle'])) as Record<Key, ResourceStatus>,
    errors: {},
    loaded: Object.fromEntries(keys.map(key => [key, false])) as Record<Key, boolean>,
  }
  const listeners = new Set<() => void>()
  const pending = new Map<Key, Promise<void>>()
  const attemptedAt = new Map<Key, number>()
  const versions = new Map<Key, number>()
  const publish = () => listeners.forEach(listener => listener())

  function loadOne<K extends Key>(key: K, force: boolean): Promise<void> {
    const existing = pending.get(key)
    if (existing) return existing
    const attempted = attemptedAt.get(key)
    if (!force && attempted !== undefined && now() - attempted < ttl) return Promise.resolve()
    attemptedAt.set(key, now())
    const version = versions.get(key) || 0
    state = { ...state, status: { ...state.status, [key]: 'loading' }, errors: { ...state.errors, [key]: undefined } }
    const request = Promise.resolve().then(() => loaders[key]()).then(value => {
      if ((versions.get(key) || 0) !== version) return
      state = {
        ...state, data: { ...state.data, [key]: value },
        status: { ...state.status, [key]: 'success' }, loaded: { ...state.loaded, [key]: true },
      }
      publish()
    }).catch((error: unknown) => {
      if ((versions.get(key) || 0) !== version) return
      state = {
        ...state, status: { ...state.status, [key]: 'error' },
        errors: { ...state.errors, [key]: error instanceof Error ? error.message : '加载失败，请稍后重试' },
      }
      publish()
    }).finally(() => { if (pending.get(key) === request) pending.delete(key) })
    pending.set(key, request)
    publish()
    return request
  }

  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    load(resources: readonly Key[] = keys, force = false) {
      return Promise.all([...new Set(resources)].map(key => loadOne(key, force)))
    },
    invalidate(resources: readonly Key[] = keys) {
      for (const key of resources) {
        versions.set(key, (versions.get(key) || 0) + 1)
        pending.delete(key)
        attemptedAt.delete(key)
        state = { ...state, status: { ...state.status, [key]: 'idle' } }
      }
      publish()
    },
  }
}
