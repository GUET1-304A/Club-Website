import { useState, useEffect } from 'react'
import { fetchSiteConfig, fetchProjects, fetchMembers, fetchAwards, fetchBlogs } from '../services/api'
import type { BlogData, MemberData, ProjectData, AwardData } from '../services/api'
import { members as localMembers, awards as localAwards, blogPosts as localBlogs, siteConfig as localConfig } from '../data/siteData'
import type { Member, Project, Award, BlogPost, SiteConfig } from '../types'

interface SiteData {
  config: SiteConfig
  members: Member[]
  projects: Project[]
  awards: Award[]
  blogPosts: BlogPost[]
  loading: boolean
  fromApi: boolean
}

let cachedData: SiteData | null = null

function mapApiProject(p: ProjectData): Project {
  return {
    id: String(p.id),
    slug: p.slug || `project-${p.id}`,
    name: p.name,
    coverImage: p.coverImage || '',
    category: (p.category as Project['category']) || 'web',
    techStack: p.techStack || [],
    description: p.description || '',
    content: p.content || '',
    githubUrl: p.githubUrl,
    demoUrl: p.demoUrl,
    stars: p.stars || 0,
    forks: p.forks || 0,
    screenshots: p.screenshots || [],
    team: p.team || [],
    startDate: p.startDate || '',
    endDate: p.endDate,
    status: (p.status as Project['status']) || 'active',
  }
}

function mapApiMember(m: MemberData): Member {
  return {
    id: String(m.id),
    name: m.name,
    avatar: m.avatar || '',
    role: m.role || '',
    group: (m.group as Member['group']) || 'dev',
    skills: m.skills || [],
    github: m.github,
    blog: m.blog,
    email: m.email,
    bio: m.bio,
    grade: m.grade || '',
    isAlumni: m.isAlumni || false,
  }
}

function mapApiAward(a: AwardData): Award {
  return {
    id: String(a.id),
    slug: a.slug || `award-${a.id}`,
    name: a.name,
    level: (a.level as Award['level']) || 'other',
    category: a.category || '',
    winner: a.winner || '',
    issuer: a.issuer || '',
    date: a.date || '',
    description: a.description,
    certificateImages: a.certificateImages || [],
    relatedProject: a.relatedProject,
  }
}

function mapApiBlog(b: BlogData): BlogPost {
  return {
    id: String(b.id),
    slug: b.slug || `post-${b.id}`,
    title: b.title,
    excerpt: b.excerpt || '',
    content: b.content || '',
    category: (b.category as BlogPost['category']) || 'tech',
    tags: b.tags || [],
    author: b.author || { name: '', avatar: '' },
    date: b.date || '',
    coverImage: b.coverImage,
  }
}

export function useSiteData(): SiteData {
  const [data, setData] = useState<SiteData>(() =>
    cachedData || {
      config: localConfig,
      members: localMembers,
      projects: [],
      awards: localAwards,
      blogPosts: localBlogs,
      loading: !cachedData,
      fromApi: false,
    }
  )

  useEffect(() => {
    if (cachedData) return

    let cancelled = false

    async function load() {
      try {
        const [apiConfig, apiProjects, apiMembers, apiAwards, apiBlogs] = await Promise.all([
          fetchSiteConfig().catch(() => null),
          fetchProjects().catch(() => []),
          fetchMembers().catch(() => []),
          fetchAwards().catch(() => []),
          fetchBlogs().catch(() => []),
        ])
        if (cancelled) return

        // Merge config from API into local defaults
        const merged: SiteConfig = {
          ...localConfig,
          siteName: apiConfig?.footer?.brand || localConfig.siteName,
          siteDescription: apiConfig?.hero?.description || localConfig.siteDescription,
          heroTagline: apiConfig?.hero?.eyebrow || localConfig.heroTagline,
          heroTitle: apiConfig?.hero?.title || localConfig.heroTitle,
          heroSubtitle: apiConfig?.hero?.description || localConfig.heroSubtitle,
          aboutTitle: apiConfig?.about?.title || localConfig.aboutTitle,
          aboutDescription: apiConfig?.about?.description || localConfig.aboutDescription,
          aboutImage: localConfig.aboutImage,
          stats: apiConfig?.hero?.stats
            ? apiConfig.hero.stats.map(s => ({
                label: s.label,
                value: parseInt(s.value) || 0,
                suffix: s.value.includes('+') ? '+' : undefined,
              }))
            : localConfig.stats,
          footerText: apiConfig?.footer?.slogan || localConfig.footerText,
        }

        const result: SiteData = {
          config: merged,
          members: apiMembers.length > 0 ? apiMembers.map(mapApiMember) : localMembers,
          projects: apiProjects.length > 0 ? apiProjects.map(mapApiProject) : [],
          awards: apiAwards.length > 0 ? apiAwards.map(mapApiAward) : localAwards,
          blogPosts: apiBlogs.length > 0 ? apiBlogs.map(mapApiBlog) : localBlogs,
          loading: false,
          fromApi: true,
        }
        cachedData = result
        if (!cancelled) setData(result)
      } catch {
        const result: SiteData = {
          config: localConfig,
          members: localMembers,
          projects: [],
          awards: localAwards,
          blogPosts: localBlogs,
          loading: false,
          fromApi: false,
        }
        cachedData = result
        if (!cancelled) setData(result)
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  return data
}

// Re-export for convenience
export { mapApiProject, mapApiMember, mapApiAward, mapApiBlog }
