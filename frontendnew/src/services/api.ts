const API_BASE = '/api'

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(err.message || `HTTP ${res.status}`)
  }
  return res.json()
}

// ─── Public: Config ───
export interface SiteConfigData {
  hero?: { eyebrow?: string; title?: string; description?: string; stats?: { label: string; value: string }[] }
  about?: { title?: string; description?: string; items?: { title: string; description: string }[] }
  members?: { description?: string; groups?: { name: string; tag: string; description: string }[] }
  footer?: { brand?: string; slogan?: string; logo?: string }
  sections?: Record<string, unknown>
}

export async function fetchSiteConfig(): Promise<SiteConfigData> {
  return request<SiteConfigData>('/config')
}

// ─── Public: Pages ───
export interface PageData {
  slug: string
  title: string
  content: Record<string, unknown>
  updated_at?: string
}

export async function fetchPages(): Promise<{ slug: string; title: string; updated_at?: string }[]> {
  return request('/pages')
}

export async function fetchPage(slug: string): Promise<PageData> {
  return request(`/pages/${slug}`)
}

// ─── Public: Applications ───
export interface ApplicationPayload {
  name: string
  student_id: string
  grade_major: string
  phone: string
  email: string
  group_id: string
  group_name: string
  motivation: string
  github_url?: string
  portfolio_url?: string
  experience?: string
  session?: string
}

export async function submitApplication(payload: ApplicationPayload): Promise<{ id: number }> {
  return request('/applications', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

// ─── Auth helpers (used by admin components) ───

export function getToken(): string | null {
  return localStorage.getItem('auth_token')
}

export function clearToken(): void {
  localStorage.removeItem('auth_token')
}

export function isLoggedIn(): boolean {
  return !!getToken()
}

// ─── Public: Contact ───
export interface ContactPayload {
  name: string
  email: string
  phone?: string
  subject: string
  message: string
  is_anonymous?: boolean
}

export async function submitContact(payload: ContactPayload): Promise<{ success: boolean; message: string }> {
  return request('/contact', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

// ─── Public: Members (rich format from new backend) ───
export interface MemberData {
  id: number
  name: string
  avatar?: string
  role?: string
  group?: string            // 'product' | 'design' | 'dev' | 'content'
  skills?: string[]
  github?: string
  blog?: string
  email?: string
  bio?: string
  grade?: string
  isAlumni?: boolean
}

export async function fetchMembers(): Promise<MemberData[]> {
  return request('/members')
}

export async function fetchMember(id: number): Promise<MemberData> {
  return request(`/members/${id}`)
}

// ─── Public: Projects (rich format from new backend) ───
export interface ProjectData {
  id: number
  slug: string
  name: string
  coverImage?: string
  category?: string         // 'web' | 'miniapp' | 'ai' | 'tools' | 'game'
  techStack?: string[]
  description?: string
  content?: string
  githubUrl?: string
  demoUrl?: string
  stars?: number
  forks?: number
  screenshots?: string[]
  team?: { name: string; avatar: string; role: string }[]
  status?: string           // 'active' | 'completed' | 'archived'
  startDate?: string
  endDate?: string
  ownerName?: string
  milestoneCount?: number
  taskCount?: number
  taskDoneCount?: number
}

export async function fetchProjects(): Promise<ProjectData[]> {
  return request('/projects')
}

export async function fetchProject(slug: string): Promise<ProjectData> {
  return request(`/projects/${slug}`)
}

export async function fetchProjectMilestones(projId: number): Promise<unknown[]> {
  return request(`/projects/${projId}/milestones`)
}

// ─── Public: Awards (rich format from new backend) ───
export interface AwardData {
  id: number
  slug: string
  name: string
  level: string            // 'national' | 'provincial' | 'school' | 'other'
  category?: string
  winner: string
  issuer?: string
  date?: string
  description?: string
  certificateImages?: string[]
  relatedProject?: string
}

export async function fetchAwards(): Promise<AwardData[]> {
  return request('/awards')
}

export async function fetchAward(slug: string): Promise<AwardData> {
  return request(`/awards/${slug}`)
}

// ─── Public: Blogs (new endpoints) ───
export interface BlogData {
  authorName?: string
  authorAvatar?: string
  id: number
  slug: string
  title: string
  excerpt?: string
  content?: string
  category: string         // 'tech' | 'event' | 'summary' | 'announcement'
  tags?: string[]
  author?: { name: string; avatar: string }
  authorId?: number
  date?: string
  coverImage?: string
}

export async function fetchBlogs(): Promise<BlogData[]> {
  return request('/blogs')
}

export async function fetchBlog(slug: string): Promise<BlogData> {
  return request(`/blogs/${slug}`)
}

// ─── Health Check ───
export async function healthCheck(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE.replace('/api', '')}/health`)
    return res.ok
  } catch {
    return false
  }
}
