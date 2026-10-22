import { usePageData } from '../../store/usePageData'
import type { PageSlug } from '../../lib/pageContent'

export default function PageDataNotice({ slug }: { slug: PageSlug }) {
  const { page, status, error, loaded, retry } = usePageData(slug)
  if (status === 'idle' || status === 'loading') {
    return loaded ? null : <p role="status" className="mt-6 text-sm text-[var(--theme-text)]">正在加载页面内容…</p>
  }
  if (status !== 'error' && page) return null
  const failed = status === 'error'
  return <div role={failed ? 'alert' : 'status'} className="mt-6 rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-surface)] p-4 text-sm text-[var(--theme-text-strong)]">
    <p>{failed ? (loaded && page ? '页面更新失败，暂时显示上次内容。' : '页面内容加载失败，暂时显示默认说明。') : '页面内容尚未配置，暂时显示默认说明。'}</p>
    {error && <p className="mt-1 text-xs text-[var(--theme-text)]">{error}</p>}
    <button type="button" onClick={retry} className="btn-tertiary mt-2">重试</button>
  </div>
}
