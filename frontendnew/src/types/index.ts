export interface Member {
  id: string
  name: string
  avatar: string
  role: string
  group: 'product' | 'design' | 'dev' | 'content'
  skills: string[]
  github?: string
  blog?: string
  email?: string
  bio?: string
  grade?: string
  isAlumni: boolean
}

export interface Project {
  id: string
  slug: string
  name: string
  coverImage: string
  category: 'web' | 'miniapp' | 'ai' | 'tools' | 'game'
  techStack: string[]
  description: string
  content: string
  githubUrl?: string
  demoUrl?: string
  stars: number
  forks: number
  screenshots: string[]
  team: { name: string; avatar: string; role: string }[]
  startDate: string
  endDate?: string
  status: 'active' | 'completed' | 'archived'
}

export interface Award {
  id: string
  slug: string
  name: string
  level: 'national' | 'provincial' | 'school' | 'other'
  category: string
  winner: string
  issuer: string
  date: string
  description?: string
  certificateImages: string[]
  relatedProject?: string
}

export interface BlogPost {
  id: string
  slug: string
  title: string
  excerpt: string
  content: string
  category: 'tech' | 'event' | 'summary' | 'announcement'
  tags: string[]
  author: { name: string; avatar: string }
  date: string
  coverImage?: string
  pinned?: boolean
}

export interface SiteConfig {
  siteName: string
  siteDescription: string
  heroTagline: string
  heroTitle: string
  heroSubtitle: string
  aboutTitle: string
  aboutDescription: string
  aboutImage: string
  stats: { label: string; value: number; suffix?: string }[]
  footerText: string
  icp?: {
    number?: string
    url?: string
    police_number?: string
    police_url?: string
  }
}
