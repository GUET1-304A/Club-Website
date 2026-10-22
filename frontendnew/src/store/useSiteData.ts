import { useEffect, useSyncExternalStore } from 'react'
import { fetchSiteConfig, fetchProjects, fetchMembers, fetchAwards, fetchBlogs } from '../services/api'
import type { BlogData, MemberData, ProjectData, AwardData, SiteConfigData } from '../services/api'
import { siteConfig as localConfig } from '../data/siteData'
import type { Member, Project, Award, BlogPost, SiteConfig } from '../types'
import { createResourceCache } from './resourceCache'
import { SITE_RESOURCES, subscribeSiteDataChanges, type SiteResource } from '../lib/siteDataEvents'

interface SiteCollections {
  config: SiteConfig
  members: Member[]
  projects: Project[]
  awards: Award[]
  blogPosts: BlogPost[]
}

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
    pinned: b.pinned,
  }
}

function mergeConfig(apiConfig: SiteConfigData): SiteConfig {
  return {
    ...localConfig,
    contact: apiConfig.contact || {},
    heroVideoUrl: apiConfig.hero?.video_url || '/hero-bg.mp4',
    siteName: apiConfig?.footer?.brand || localConfig.siteName,
    siteDescription: apiConfig?.hero?.description || localConfig.siteDescription,
    heroTagline: apiConfig?.hero?.eyebrow || localConfig.heroTagline,
    heroTitle: apiConfig?.hero?.title || localConfig.heroTitle,
    heroSubtitle: apiConfig?.hero?.description || localConfig.heroSubtitle,
    heroPrimaryLabel: apiConfig?.hero?.primary_label || localConfig.heroPrimaryLabel,
    heroPrimaryHref: apiConfig?.hero?.primary_href || localConfig.heroPrimaryHref,
    heroSecondaryLabel: apiConfig?.hero?.secondary_label || localConfig.heroSecondaryLabel,
    heroSecondaryHref: apiConfig?.hero?.secondary_href || localConfig.heroSecondaryHref,
    aboutTitle: apiConfig?.about?.title || localConfig.aboutTitle,
    aboutDescription: apiConfig?.about?.description || localConfig.aboutDescription,
    aboutExtra: apiConfig?.about?.extra || localConfig.aboutExtra,
    aboutImage: String(apiConfig?.about?.image || localConfig.aboutImage),
    stats: apiConfig?.hero?.stats
      ? apiConfig.hero.stats.map(s => ({
          label: s.label,
          value: parseInt(s.value) || 0,
          suffix: s.value.includes('+') ? '+' : undefined,
        }))
      : [],
    membersEyebrow: apiConfig?.members?.eyebrow || localConfig.membersEyebrow,
    membersTitle: apiConfig?.members?.title || localConfig.membersTitle,
    membersCta: apiConfig?.members?.cta || localConfig.membersCta,
    projectsEyebrow: apiConfig?.projects?.eyebrow || localConfig.projectsEyebrow,
    projectsTitle: apiConfig?.projects?.title || localConfig.projectsTitle,
    projectsCta: apiConfig?.projects?.cta || localConfig.projectsCta,
    awardsEyebrow: apiConfig?.awards?.eyebrow || localConfig.awardsEyebrow,
    awardsTitle: apiConfig?.awards?.title || localConfig.awardsTitle,
    awardsCta: apiConfig?.awards?.cta || localConfig.awardsCta,
    joinEyebrow: apiConfig?.join?.eyebrow || localConfig.joinEyebrow,
    joinTitle: apiConfig?.join?.title || localConfig.joinTitle,
    joinCtaEyebrow: apiConfig?.join?.cta_eyebrow || localConfig.joinCtaEyebrow,
    joinCtaTitle: apiConfig?.join?.cta_title || localConfig.joinCtaTitle,
    joinCtaDescription: apiConfig?.join?.cta_description || localConfig.joinCtaDescription,
    joinCtaButton: apiConfig?.join?.cta_button || localConfig.joinCtaButton,
    timelineTitle: apiConfig?.timeline?.title || localConfig.timelineTitle,
    timelineIntro: apiConfig?.timeline?.intro || localConfig.timelineIntro,
    timelineEvents: apiConfig?.timeline?.events
      ? apiConfig.timeline.events.map(event => ({
          date: event.date || '',
          title: event.title || '',
          description: event.description || '',
        }))
      : localConfig.timelineEvents,
    footerText: apiConfig?.footer?.slogan || localConfig.footerText,
    footerDescription: apiConfig?.footer?.description || localConfig.footerDescription,
    footerGithub: apiConfig?.footer?.github_url || localConfig.footerGithub,
    footerEmail: apiConfig?.footer?.email || localConfig.footerEmail,
    sections: (apiConfig?.sections as Record<string, boolean>) || localConfig.sections,
    icp: apiConfig?.icp || localConfig.icp,
  }
}

const cache = createResourceCache<SiteCollections>({
  config: { ...localConfig, stats: [] }, members: [], projects: [], awards: [], blogPosts: [],
}, {
  config: async () => mergeConfig(await fetchSiteConfig()),
  projects: async () => (await fetchProjects()).map(mapApiProject),
  members: async () => (await fetchMembers()).map(mapApiMember),
  awards: async () => (await fetchAwards()).map(mapApiAward),
  blogPosts: async () => (await fetchBlogs()).map(mapApiBlog),
})

const active = new Map<SiteResource, number>()
let stopEvents: (() => void) | undefined
function activeResources() { return SITE_RESOURCES.filter(key => (active.get(key) || 0) > 0) }
function refreshActive() { void cache.load(activeResources()) }

function startEvents() {
  if (stopEvents) return
  const unsubscribe = subscribeSiteDataChanges(resources => {
    cache.invalidate(resources)
    void cache.load(resources.filter(key => (active.get(key) || 0) > 0))
  })
  const visible = () => { if (!document.hidden) refreshActive() }
  window.addEventListener('focus', refreshActive)
  document.addEventListener('visibilitychange', visible)
  stopEvents = () => {
    unsubscribe()
    window.removeEventListener('focus', refreshActive)
    document.removeEventListener('visibilitychange', visible)
    stopEvents = undefined
  }
}

export function useSiteData(resources: readonly SiteResource[] = SITE_RESOURCES) {
  const state = useSyncExternalStore(cache.subscribe, cache.getSnapshot, cache.getSnapshot)
  const resourceKey = [...new Set(resources)].sort().join('|')
  useEffect(() => {
    const keys = resourceKey.split('|').filter(Boolean) as SiteResource[]
    keys.forEach(key => active.set(key, (active.get(key) || 0) + 1))
    startEvents()
    void cache.load(keys)
    return () => {
      keys.forEach(key => active.set(key, Math.max(0, (active.get(key) || 0) - 1)))
      if (!activeResources().length) stopEvents?.()
    }
  }, [resourceKey])
  return {
    ...state.data, status: state.status, errors: state.errors, loaded: state.loaded,
    loading: resources.some(key => state.status[key] === 'idle' || state.status[key] === 'loading'),
    fromApi: state.status.config === 'success',
    retry: (keys: readonly SiteResource[] = resources) => cache.load(keys, true),
  }
}

export { mapApiProject, mapApiMember, mapApiAward, mapApiBlog }
