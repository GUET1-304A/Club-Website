import type { SyntheticEvent } from 'react'

/** 封面缺失或外链加载失败时的占位图（本地资源，不依赖任何外网） */
export const COVER_PLACEHOLDER = '/img/cover-placeholder.svg'

/**
 * `<img onError>` 兜底：封面多来自 OSS / Unsplash 外链，国内网络下可能加载失败，
 * 这里统一换成占位图，避免出现破图。加标记位防止占位图自身失败时无限重试。
 */
export function handleImageError(event: SyntheticEvent<HTMLImageElement>) {
  const img = event.currentTarget
  if (img.dataset.fallbackApplied === '1') return
  img.dataset.fallbackApplied = '1'
  img.src = COVER_PLACEHOLDER
}
