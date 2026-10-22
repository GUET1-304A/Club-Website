export interface DetailMetadata {
  title: string
  description?: string
  image?: string
  type?: 'website' | 'article'
  noIndex?: boolean
}
export interface MetadataOverride extends DetailMetadata { path: string }
export interface DocumentMetadata {
  title: string
  description: string
  image: string
  canonical: string
  type: 'website' | 'article'
  robots: string
  siteName: string
}

const DEFAULT_ORIGIN = 'https://304aistudio.cn'
const routes: Record<string, [string, string]> = {
  '/about': ['关于我们', '了解星雨作坊的理念、成员协作方式与成长故事。'],
  '/members': ['成员风采', '认识星雨作坊的成员，了解各小组与技术方向。'],
  '/projects': ['作品画廊', '浏览星雨作坊的真实项目、技术栈与作品展示。'],
  '/awards': ['比赛奖项', '记录星雨作坊成员的竞赛成果与团队荣誉。'],
  '/blog': ['博客动态', '阅读技术分享、活动记录、心得总结与社团公告。'],
  '/research': ['研究方向', '了解前端、后端、人工智能与产品设计的学习实践方向。'],
  '/cooperation': ['合作交流', '了解项目合作、学术分享与高校技术交流。'],
  '/contact': ['联系我们', '联系星雨作坊，交流问题、想法与合作机会。'],
  '/open-source': ['开源精神', '探索星雨作坊分享的项目源码，参与交流和贡献。'],
  '/join': ['加入我们', '了解星雨作坊并提交报名申请，一起学习、共创和开源。'],
  '/recruitment': ['招新信息', '查看招新要求、报名流程与常见问题。'],
  '/timeline': ['社团时间线', '回顾星雨作坊的成长历程与重要时刻。'],
  '/onboarding': ['新手指南', '从了解社团到正式加入，查看入门步骤。'],
  '/yuji': ['雨记协作板', '记录想法、分享灵感与协作动态。'],
}
export const PUBLIC_METADATA_PATHS = ['/', ...Object.keys(routes)]

export function plainDescription(value: string, limit = 160) {
  const text = value.replace(/<[^>]*>/g, ' ').replace(/!?(\[([^\]]*)\])\([^)]*\)/g, '$2')
    .replace(/\*\*([^*]+)\*\*/g, '$1').replace(/`+/g, '').replace(/^\s*#{1,6}\s+/gm, '')
    .replace(/\s+/g, ' ').trim()
  const chars = Array.from(text)
  return chars.length > limit ? `${chars.slice(0, limit - 1).join('')}…` : text
}

function publicOrigin(value?: string) {
  try {
    const url = new URL(value || DEFAULT_ORIGIN)
    if (['http:', 'https:'].includes(url.protocol) && !url.username && !url.password) return url.origin
  } catch { /* Use the existing production origin for malformed deployment values. */ }
  return DEFAULT_ORIGIN
}

export function resolveMetadata(path: string, config: { siteName: string; siteDescription: string }, override?: MetadataOverride | null, siteUrl?: string): DocumentMetadata {
  const origin = publicOrigin(siteUrl)
  const parsed = new URL(path.startsWith('/') && !path.startsWith('//') ? path : '/', origin)
  const pathname = parsed.pathname.replace(/\/+$/, '') || '/'
  const privatePage = /^\/(admin|member)(\/|$)/.test(pathname) || pathname === '/login'
  const detail = pathname.match(/^\/(project|award|blog)\/[^/]+$/)
  const route = routes[pathname]
  const known = pathname === '/' || privatePage || !!detail || !!route
  const overridePath = override ? new URL(override.path, origin).pathname.replace(/\/+$/, '') : undefined
  const active = overridePath === pathname && !privatePage ? override : undefined
  const siteName = plainDescription(config.siteName || '星雨作坊', 60)
  const label = active?.title || (privatePage ? (pathname.startsWith('/admin') ? '管理后台' : pathname === '/login' ? '登录' : '成员门户')
    : route?.[0] || (detail ? ({ project: '项目详情', award: '奖项详情', blog: '文章详情' }[detail[1]]) : '页面未找到'))
  const description = plainDescription(active?.description || (pathname === '/' ? config.siteDescription : route?.[1]) || config.siteDescription || '星雨作坊：学习、共创与开源。')
  let image = `${origin}/hero-poster.webp`
  if (active?.image) {
    try {
      const url = new URL(active.image, origin)
      if (['https:', 'http:'].includes(url.protocol) && !url.username && !url.password) image = url.href
    } catch { /* Keep the local poster if a content image URL is invalid. */ }
  }
  return {
    title: pathname === '/' ? `${siteName} — Xingyu Studio` : `${plainDescription(label || '页面未找到', 100)} · ${siteName}`,
    description, image, canonical: `${origin}${pathname}`, siteName,
    type: active?.type || 'website',
    robots: privatePage ? 'noindex, nofollow' : (!known || active?.noIndex) ? 'noindex, follow' : 'index, follow',
  }
}

export function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

export function renderDocumentMetadata(template: string, data: DocumentMetadata) {
  const tags = [
    `<title>${escapeHtml(data.title)}</title>`,
    `<link rel="canonical" href="${escapeHtml(data.canonical)}">`,
    ...Object.entries({ description: data.description, robots: data.robots, 'twitter:card': 'summary_large_image', 'twitter:title': data.title, 'twitter:description': data.description, 'twitter:image': data.image })
      .map(([name, value]) => `<meta name="${name}" content="${escapeHtml(value)}">`),
    ...Object.entries({ title: data.title, description: data.description, url: data.canonical, image: data.image, type: data.type, site_name: data.siteName, 'image:alt': data.title })
      .map(([name, value]) => `<meta property="og:${name}" content="${escapeHtml(value)}">`),
  ]
  const cleaned = template.replace(/<title\b[^>]*>[\s\S]*?<\/title>/gi, '')
    .replace(/<meta\b[^>]*>/gi, tag => /(?:name|property)\s*=\s*["'](?:description|robots|og:[^"']+|twitter:[^"']+)["']/i.test(tag) ? '' : tag)
    .replace(/<link\b[^>]*>/gi, tag => /rel\s*=\s*["']canonical["']/i.test(tag) ? '' : tag)
  return cleaned.replace(/<head\b[^>]*>/i, tag => `${tag}\n${tags.join('\n')}`)
}

export function applyDocumentMetadata(data: DocumentMetadata) {
  document.title = data.title
  const meta = (name: string, value: string, property = false) => {
    const attribute = property ? 'property' : 'name'
    let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${name}"]`)
    if (!element) {
      element = document.createElement('meta')
      element.setAttribute(attribute, name)
      document.head.appendChild(element)
    }
    element.content = value
  }
  meta('description', data.description)
  meta('robots', data.robots)
  for (const [key, value] of Object.entries({ title: data.title, description: data.description, url: data.canonical, image: data.image, type: data.type, site_name: data.siteName, 'image:alt': data.title })) meta(`og:${key}`, value, true)
  for (const [key, value] of Object.entries({ card: 'summary_large_image', title: data.title, description: data.description, image: data.image })) meta(`twitter:${key}`, value)
  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (!canonical) { canonical = document.createElement('link'); canonical.rel = 'canonical'; document.head.appendChild(canonical) }
  canonical.href = data.canonical
}
