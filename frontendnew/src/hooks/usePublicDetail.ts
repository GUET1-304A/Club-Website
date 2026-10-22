import { useEffect, useState } from 'react'
import { ApiError } from '../services/api'

export function usePublicDetail<T>(slug: string, cached: T | undefined, load: (slug: string) => Promise<T>) {
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<{ slug: string; data: T | null; loading: boolean; error: string | null }>({
    slug, data: cached ?? null, loading: !cached, error: null,
  })
  useEffect(() => {
    if (cached) { setState({ slug, data: cached, loading: false, error: null }); return }
    let cancelled = false
    setState({ slug, data: null, loading: true, error: null })
    load(slug).then(data => {
      if (!cancelled) setState({ slug, data, loading: false, error: null })
    }).catch((error: unknown) => {
      if (cancelled) return
      const missing = error instanceof ApiError && error.status === 404
      setState({ slug, data: null, loading: false, error: missing ? null : (error instanceof Error ? error.message : '加载失败') })
    })
    return () => { cancelled = true }
  }, [slug, cached, load, attempt])
  return {
    ...(state.slug === slug ? state : { slug, data: null, loading: true, error: null }),
    retry: () => setAttempt(value => value + 1),
  }
}
