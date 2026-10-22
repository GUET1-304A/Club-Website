import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveMetadata, plainDescription, renderDocumentMetadata } from '../src/lib/metadata.ts'

const config = { siteName: '星雨作坊', siteDescription: '一起学习、共创和开源。' }

test('public pages have unique titles and canonical URLs exclude query strings and fragments', () => {
  const projects = resolveMetadata('/projects/?filter=ai#items', config)
  assert.equal(projects.title, '作品画廊 · 星雨作坊')
  assert.equal(projects.canonical, 'https://304aistudio.cn/projects')
  assert.equal(projects.robots, 'index, follow')
  assert.equal(resolveMetadata('/members', config).title, '成员风采 · 星雨作坊')
  assert.match(resolveMetadata('/', config).title, /星雨作坊/)
})

test('matching detail metadata uses content title, excerpt, article type and safe cover URL', () => {
  const page = resolveMetadata('/blog/demo', config, { path: '/blog/demo', title: '学习笔记', description: '**一起**阅读 [文档](https://example.test)。', image: '/uploads/cover.webp', type: 'article' })
  assert.equal(page.title, '学习笔记 · 星雨作坊')
  assert.equal(page.description, '一起阅读 文档。')
  assert.equal(page.image, 'https://304aistudio.cn/uploads/cover.webp')
  assert.equal(page.type, 'article')
})

test('leaving a detail page cannot leak its title or noindex flag into a different route', () => {
  const page = resolveMetadata('/projects', config, { path: '/blog/missing', title: '文章未找到', noIndex: true })
  assert.equal(page.title, '作品画廊 · 星雨作坊')
  assert.equal(page.robots, 'index, follow')
  assert.equal(resolveMetadata('/blog/missing', config, { path: '/blog/missing', title: '文章未找到', noIndex: true }).robots, 'noindex, follow')
})

test('Chinese detail paths match browser-encoded paths when applying content metadata', () => {
  const page = resolveMetadata('/blog/%E5%AD%A6%E4%B9%A0', config,
    { path: '/blog/学习', title: '中文标题', type: 'article' })
  assert.equal(page.title, '中文标题 · 星雨作坊')
  assert.equal(page.canonical, 'https://304aistudio.cn/blog/%E5%AD%A6%E4%B9%A0')
})

test('private and unknown routes are not indexed and sensitive query parameters are omitted', () => {
  for (const path of ['/login?token=secret', '/member/profile', '/admin/projects/2']) {
    const page = resolveMetadata(path, config)
    assert.equal(page.robots, 'noindex, nofollow')
    assert.ok(!page.canonical.includes('token'))
  }
  assert.equal(resolveMetadata('/unknown', config).robots, 'noindex, follow')
  assert.equal(resolveMetadata('/members', config).robots, 'index, follow')
})

test('deployment origin and image URLs are validated and image credentials are never exposed', () => {
  assert.equal(resolveMetadata('/projects', config, null, 'https://studio.example/path').canonical, 'https://studio.example/projects')
  assert.equal(resolveMetadata('/projects', config, null, 'javascript:alert(1)').canonical, 'https://304aistudio.cn/projects')
  assert.equal(resolveMetadata('//evil.test', config).canonical, 'https://304aistudio.cn/')
  for (const image of ['javascript:alert(1)', 'data:image/png;base64,secret', 'https://user:secret@example.test/image']) {
    assert.equal(resolveMetadata('/project/demo', config, { path: '/project/demo', title: '项目', image }).image, 'https://304aistudio.cn/hero-poster.webp')
  }
})

test('descriptions collapse markup and whitespace, preserve C# and truncate by Unicode characters', () => {
  assert.equal(plainDescription('## C#\n\n**代码** <b>示例</b>'), 'C# 代码 示例')
  const description = plainDescription('🌧️'.repeat(300))
  assert.equal(Array.from(description).length, 160)
  assert.ok(description.endsWith('…'))
})

test('production HTML replaces old metadata, escapes content and preserves app assets and theme bootstrap', () => {
  const template = '<html><head><title>Old</title><meta name="description" content="old"><meta property="og:title" content="old"><link rel="canonical" href="https://old.test"><meta name="viewport" content="width=device-width"><script>themeBootstrap()</script><link rel="stylesheet" href="/assets/app.css"></head><body><script src="/assets/app.js"></script></body></html>'
  const data = resolveMetadata('/projects', config)
  data.title = 'A</title><script>alert(1)</script>&"'
  const html = renderDocumentMetadata(template, data)
  assert.equal((html.match(/<title>/g) || []).length, 1)
  assert.equal((html.match(/name="description"/g) || []).length, 1)
  assert.equal((html.match(/rel="canonical"/g) || []).length, 1)
  assert.ok(html.includes('&lt;/title&gt;&lt;script&gt;alert(1)&lt;/script&gt;&amp;&quot;'))
  assert.ok(html.includes('name="viewport"'))
  assert.ok(html.includes('themeBootstrap()'))
  assert.ok(html.includes('/assets/app.js') && html.includes('/assets/app.css'))
})
