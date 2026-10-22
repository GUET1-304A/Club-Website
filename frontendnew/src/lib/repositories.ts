import type { Project } from '../types'

export function githubRepository(value?: string) {
  if (!value) return null
  try {
    const url = new URL(value.trim())
    if (!['http:', 'https:'].includes(url.protocol) || url.hostname.toLowerCase() !== 'github.com' || url.port || url.username || url.password) return null
    const parts = url.pathname.replace(/^\/+|\/+$/g, '').split('/')
    if (parts.length !== 2) return null
    const [owner, rawName] = parts
    const name = rawName.replace(/\.git$/i, '')
    if (!/^[a-z\d](?:[a-z\d-]*[a-z\d])?$/i.test(owner) || !/^[\w.-]+$/.test(name) || /^\.+$/.test(name)) return null
    return { owner, name, label: `${owner}/${name}`, href: `https://github.com/${owner}/${name}` }
  } catch { return null }
}

export function publicRepositories(projects: readonly Project[]) {
  const seen = new Set<string>()
  return projects.flatMap(project => {
    const repository = githubRepository(project.githubUrl)
    if (!repository || seen.has(repository.href.toLowerCase())) return []
    seen.add(repository.href.toLowerCase())
    return [{ project, repository }]
  })
}
