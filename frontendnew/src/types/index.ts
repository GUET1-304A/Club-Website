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
  heroPrimaryLabel: string
  heroPrimaryHref: string
  heroSecondaryLabel: string
  heroSecondaryHref: string
  aboutTitle: string
  aboutDescription: string
  aboutExtra: string
  aboutImage: string
  stats: { label: string; value: number; suffix?: string }[]
  membersEyebrow: string
  membersTitle: string
  membersCta: string
  projectsEyebrow: string
  projectsTitle: string
  projectsCta: string
  awardsEyebrow: string
  awardsTitle: string
  awardsCta: string
  joinEyebrow: string
  joinTitle: string
  joinCtaEyebrow: string
  joinCtaTitle: string
  joinCtaDescription: string
  joinCtaButton: string
  footerText: string
  footerDescription: string
  footerGithub: string
  footerEmail: string
  sections: Record<string, boolean>
  icp?: {
    number?: string
    url?: string
    police_number?: string
    police_url?: string
  }
}
