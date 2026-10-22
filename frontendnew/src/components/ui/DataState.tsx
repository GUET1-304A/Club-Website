import type { ReactNode } from 'react'
import { useSiteData } from '../../store/useSiteData'
import type { SiteResource } from '../../lib/siteDataEvents'

const labels: Record<SiteResource, string> = { config: '站点配置', projects: '项目', members: '成员', awards: '奖项', blogPosts: '文章' }

export function SiteDataNotice({ resources }: { resources: readonly SiteResource[] }) {
  const { errors, status, loaded, retry } = useSiteData(resources)
  const failed = resources.filter(key => status[key] === 'error')
  if (!failed.length) return null
  return (
    <div role="alert" className="relative z-20 mx-auto my-4 max-w-[1152px] rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-surface)] px-5 py-4 text-sm text-[var(--theme-text-strong)]">
      <p>{failed.map(key => `${labels[key]}${loaded[key] ? '更新失败，暂时显示上次内容' : '加载失败'}`).join('；')}</p>
      <p className="mt-1 text-xs text-[var(--theme-text)]">{errors[failed[0]]}</p>
      <button type="button" onClick={() => void retry(failed)} className="btn-tertiary mt-2">重试</button>
    </div>
  )
}

export default function DataState({ resource, children }: { resource: Exclude<SiteResource, 'config'>; children: ReactNode }) {
  const { status, loaded } = useSiteData([resource])
  const waiting = status[resource] === 'idle' || status[resource] === 'loading'
  if (!loaded[resource]) {
    if (waiting) return <div role="status" className="py-16 text-center text-sm text-[var(--theme-text-strong)]">正在加载{labels[resource]}…</div>
    return <SiteDataNotice resources={[resource]} />
  }
  return <><SiteDataNotice resources={[resource]} />{children}</>
}
