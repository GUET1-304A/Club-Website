import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { loadEnv } from 'vite'
import { PUBLIC_METADATA_PATHS, resolveMetadata, renderDocumentMetadata, escapeHtml } from '../src/lib/metadata.ts'
import { siteConfig } from '../src/data/siteData.ts'

const env = loadEnv('production', process.cwd(), 'VITE_')
const origin = process.env.VITE_PUBLIC_SITE_URL || env.VITE_PUBLIC_SITE_URL
const template = await readFile('dist/index.html', 'utf8')
const paths = [...PUBLIC_METADATA_PATHS, '/login', '/admin', '/member']
await Promise.all(paths.map(async path => {
  const output = resolve('dist', path === '/' ? 'index.html' : `${path.slice(1)}/index.html`)
  await mkdir(dirname(output), { recursive: true })
  await writeFile(output, renderDocumentMetadata(template, resolveMetadata(path, siteConfig, null, origin)))
}))
const urls = PUBLIC_METADATA_PATHS.map(path => resolveMetadata(path, siteConfig, null, origin).canonical)
await writeFile('dist/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(url => `<url><loc>${escapeHtml(url)}</loc></url>`).join('\n')}\n</urlset>\n`)
await writeFile('dist/robots.txt', `User-agent: *\nDisallow: /admin/\nDisallow: /member/\nDisallow: /login\nDisallow: /api/\n\nSitemap: ${new URL('/sitemap.xml', urls[0]).href}\n`)
// One atomic file lets Flask use the exact HTML/assets and route catalogue from
// this frontend build. This is a delivery artifact, not a public API.
await writeFile('dist/metadata.json', JSON.stringify({
  version: 1,
  revision: process.env.RELEASE_REVISION || 'development',
  template,
  origin: new URL(urls[0]).origin,
  defaults: { siteName: siteConfig.siteName, siteDescription: siteConfig.siteDescription },
  routes: Object.fromEntries(paths.map(path => [path, resolveMetadata(path, siteConfig, null, origin)])),
  publicPaths: PUBLIC_METADATA_PATHS,
  notFound: resolveMetadata('/404', siteConfig, null, origin),
}))
console.log(`Generated metadata HTML for ${paths.length} routes, sitemap.xml and robots.txt.`)
