/**
 * 阿里云 OSS 图片处理参数工具。
 *
 * 数据里存的是详情页用的大图参数（`resize,l_1800/quality,q_90`，保证证书文字清晰）；
 * 列表 / 卡片这类小尺寸场景换成小图参数，避免首页一次拉十几张几百 KB 的大图。
 */

/** 卡片场景：长边 800、质量 82（证书缩略图约 100KB） */
const THUMB_PROCESS = 'x-oss-process=image/resize,l_800/quality,q_82'

export function thumbUrl(url: string | null | undefined): string {
  if (!url) return ''
  if (!url.includes('x-oss-process=')) return url
  return url.replace(/x-oss-process=[^&]*/, THUMB_PROCESS)
}
