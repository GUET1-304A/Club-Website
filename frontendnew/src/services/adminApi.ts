import { getToken } from './api'

const API_BASE = '/api'

async function authRequest<T>(url: string, options?: RequestInit): Promise<T> {
  const token = getToken()
  if (!token) throw new Error('未登录')

  const res = await fetch(`${API_BASE}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(err.message || `HTTP ${res.status}`)
  }
  return res.json()
}

// ─── Types ───

export interface AdminMember {
  id: number; name: string; avatar?: string; role?: string; group?: string
  skills?: string[]; github?: string; blog?: string; email?: string
  bio?: string; grade?: string; isAlumni?: boolean; status?: string
  sortOrder?: number
}

export interface AdminProject {
  id: number; slug: string; name: string; coverImage?: string
  category?: string; techStack?: string[]; description?: string; content?: string
  githubUrl?: string; demoUrl?: string; stars?: number; forks?: number
  screenshots?: string[]; team?: { name: string; avatar: string; role: string }[]
  status?: string; startDate?: string; endDate?: string; ownerId?: number; ownerName?: string
}

export interface AdminAward {
  id: number; slug: string; name: string; level: string; category?: string
  winner: string; issuer?: string; advisor?: string; date?: string; description?: string
  certificateImages?: string[]; relatedProject?: string; sortOrder?: number
}

export interface AdminBlog {
  id: number; slug: string; title: string; excerpt?: string; content?: string
  category: string; tags?: string[]; author?: { name: string; avatar: string }
  authorName?: string; authorAvatar?: string; authorId?: number
  date?: string; coverImage?: string; isPublished?: boolean
  pinned?: boolean
}

export interface AdminPage {
  id: number; slug: string; title: string; content: Record<string, unknown>
  updated_at?: string
}

export interface AdminApplication {
  id: number; name: string; student_id: string; grade_major: string
  phone: string; email: string; group_id: string; group_name: string
  github_url?: string; portfolio_url?: string; experience?: string; motivation: string
  session?: string; status: string; admin_note?: string; created_at?: string
}

export interface AdminContact {
  id: number; name: string; email: string; phone?: string; subject: string
  message: string; is_anonymous?: boolean; status: string; reply?: string
  admin_note?: string; created_at?: string
}

export interface AdminCertificate {
  id: number
  memberId: number
  memberName?: string
  name: string
  level?: string
  category?: string
  winner?: string
  issuer?: string
  advisor?: string
  date?: string
  description?: string
  images?: string[]
  ocrText?: string
  ocrFields?: Record<string, string>
  relatedProject?: string
  status: string
  reviewNote?: string
  reviewedBy?: number
  reviewedAt?: string
  created_at?: string
  updated_at?: string
}

// ─── Auth ───

export interface AdminUserData {
  id: number
  username: string
  role: 'admin' | 'teacher'
  email?: string | null
  mustChangePassword?: boolean
  securityWarnings?: string[]
  created_at?: string
}

export async function adminGetMe(): Promise<AdminUserData> {
  return authRequest('/admin/me')
}

export async function adminListUsers(): Promise<AdminUserData[]> {
  return authRequest('/admin/users')
}

export async function adminCreateUser(data: { username: string; password: string; role: 'admin' | 'teacher'; email?: string }): Promise<{ success: boolean; user: AdminUserData }> {
  return authRequest('/admin/users', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function adminUpdateUser(userId: number, data: { password?: string; role?: 'admin' | 'teacher'; email?: string }): Promise<{ success: boolean; user: AdminUserData }> {
  return authRequest(`/admin/users/${userId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

// ─── Members ───

export async function adminListMembers(params?: Record<string, string>): Promise<AdminMember[]> {
  const qs = params ? '?' + new URLSearchParams(params).toString() : ''
  return authRequest(`/admin/members${qs}`)
}

export async function adminGetMember(id: number): Promise<AdminMember> {
  return authRequest(`/admin/members/${id}`)
}

export async function adminCreateMember(data: Partial<AdminMember>): Promise<{ success: boolean; member: AdminMember }> {
  return authRequest('/admin/members', { method: 'POST', body: JSON.stringify(data) })
}

export async function adminUpdateMember(id: number, data: Partial<AdminMember>): Promise<{ success: boolean; member: AdminMember }> {
  return authRequest(`/admin/members/${id}`, { method: 'PUT', body: JSON.stringify(data) })
}

export async function adminDeleteMember(id: number): Promise<{ success: boolean }> {
  return authRequest(`/admin/members/${id}`, { method: 'DELETE' })
}

// ─── Projects ───

export async function adminListProjects(params?: Record<string, string>): Promise<AdminProject[]> {
  const qs = params ? '?' + new URLSearchParams(params).toString() : ''
  return authRequest(`/admin/projects${qs}`)
}

export async function adminGetProject(id: number): Promise<AdminProject> {
  return authRequest(`/admin/projects/${id}`)
}

export async function adminCreateProject(data: Partial<AdminProject>): Promise<{ success: boolean; project: AdminProject }> {
  return authRequest('/admin/projects', { method: 'POST', body: JSON.stringify(data) })
}

export async function adminUpdateProject(id: number, data: Partial<AdminProject>): Promise<{ success: boolean; project: AdminProject }> {
  return authRequest(`/admin/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) })
}

export async function adminDeleteProject(id: number): Promise<{ success: boolean }> {
  return authRequest(`/admin/projects/${id}`, { method: 'DELETE' })
}

// ─── Awards ───

export async function adminListAwards(params?: Record<string, string>): Promise<AdminAward[]> {
  const qs = params ? '?' + new URLSearchParams(params).toString() : ''
  return authRequest(`/admin/awards${qs}`)
}

export async function adminGetAward(id: number): Promise<AdminAward> {
  return authRequest(`/admin/awards/${id}`)
}

export async function adminCreateAward(data: Partial<AdminAward>): Promise<{ success: boolean; award: AdminAward }> {
  return authRequest('/admin/awards', { method: 'POST', body: JSON.stringify(data) })
}

export async function adminUpdateAward(id: number, data: Partial<AdminAward>): Promise<{ success: boolean; award: AdminAward }> {
  return authRequest(`/admin/awards/${id}`, { method: 'PUT', body: JSON.stringify(data) })
}

export async function adminDeleteAward(id: number): Promise<{ success: boolean }> {
  return authRequest(`/admin/awards/${id}`, { method: 'DELETE' })
}

// ─── Blogs ───

export async function adminListBlogs(params?: Record<string, string>): Promise<AdminBlog[]> {
  const qs = params ? '?' + new URLSearchParams(params).toString() : ''
  return authRequest(`/admin/blogs${qs}`)
}

export async function adminGetBlog(id: number): Promise<AdminBlog> {
  return authRequest(`/admin/blogs/${id}`)
}

export async function adminCreateBlog(data: Partial<AdminBlog>): Promise<{ success: boolean; blog: AdminBlog }> {
  return authRequest('/admin/blogs', { method: 'POST', body: JSON.stringify(data) })
}

export async function adminUpdateBlog(id: number, data: Partial<AdminBlog>): Promise<{ success: boolean; blog: AdminBlog }> {
  return authRequest(`/admin/blogs/${id}`, { method: 'PUT', body: JSON.stringify(data) })
}

export async function adminDeleteBlog(id: number): Promise<{ success: boolean }> {
  return authRequest(`/admin/blogs/${id}`, { method: 'DELETE' })
}

// ─── Pages ───

export async function adminListPages(): Promise<AdminPage[]> {
  return authRequest('/admin/pages')
}

export async function adminGetPage(slug: string): Promise<AdminPage> {
  return authRequest(`/admin/pages/${slug}`)
}

export async function adminSavePage(slug: string, data: { title: string; content: Record<string, unknown> }): Promise<{ success: boolean; page: AdminPage }> {
  return authRequest(`/admin/pages/${slug}`, { method: 'PUT', body: JSON.stringify(data) })
}

export async function adminCreatePage(data: { slug: string; title: string; content?: Record<string, unknown> }): Promise<{ success: boolean; page: AdminPage }> {
  return authRequest('/admin/pages', { method: 'POST', body: JSON.stringify(data) })
}

export async function adminDeletePage(slug: string): Promise<{ success: boolean }> {
  return authRequest(`/admin/pages/${slug}`, { method: 'DELETE' })
}

// ─── Config ───

export async function adminGetConfig(): Promise<Record<string, unknown>> {
  return authRequest('/admin/config')
}

export async function adminUpdateConfig(data: Record<string, unknown>): Promise<{ success: boolean }> {
  return authRequest('/admin/config', { method: 'PUT', body: JSON.stringify(data) })
}

// ─── Applications ───

export async function adminListApplications(params?: Record<string, string>): Promise<AdminApplication[]> {
  const qs = params ? '?' + new URLSearchParams(params).toString() : ''
  return authRequest(`/admin/applications${qs}`)
}

export async function adminUpdateApplication(id: number, data: { status?: string; admin_note?: string }): Promise<{ success: boolean; application: AdminApplication }> {
  return authRequest(`/admin/applications/${id}`, { method: 'PATCH', body: JSON.stringify(data) })
}

// ─── Contacts ───

export async function adminListContacts(params?: Record<string, string>): Promise<AdminContact[]> {
  const qs = params ? '?' + new URLSearchParams(params).toString() : ''
  return authRequest(`/admin/contact-messages${qs}`)
}

export async function adminUpdateContact(id: number, data: { status?: string; reply?: string; admin_note?: string }): Promise<{ success: boolean; message: AdminContact }> {
  return authRequest(`/admin/contact-messages/${id}`, { method: 'PATCH', body: JSON.stringify(data) })
}

// ─── Certificates ───

export async function adminListCertificates(params?: Record<string, string>): Promise<AdminCertificate[]> {
  const qs = params ? '?' + new URLSearchParams(params).toString() : ''
  return authRequest(`/admin/certificates${qs}`)
}

export async function adminGetCertificate(id: number): Promise<AdminCertificate> {
  return authRequest(`/admin/certificates/${id}`)
}

export async function adminReviewCertificate(
  id: number,
  data: { status: 'verified' | 'rejected'; reviewNote?: string },
): Promise<{ success: boolean; certificate: AdminCertificate; award: AdminAward | null }> {
  return authRequest(`/admin/certificates/${id}/review`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

// ─── Weekly Reports ───

export interface AdminWeeklyReportContent {
  done?: string
  plan?: string
  issues?: string
  summary?: string
}

export interface AdminWeeklyReportAnalysis {
  score?: number
  completion?: string
  risks?: string[]
  suggestions?: string[]
  report?: string
}

export interface AdminWeeklyReport {
  id: number
  memberId: number
  memberName?: string
  projectId?: number
  projectName?: string
  weekStart?: string
  weekEnd?: string
  content: AdminWeeklyReportContent
  completionRate?: number
  aiAnalysis?: AdminWeeklyReportAnalysis | null
  status: string
  reviewNote?: string
  reviewedBy?: number
  submittedAt?: string
  reviewedAt?: string
  created_at?: string
  updated_at?: string
}

export async function adminListWeeklyReports(params?: Record<string, string>): Promise<AdminWeeklyReport[]> {
  const qs = params ? '?' + new URLSearchParams(params).toString() : ''
  return authRequest(`/admin/weekly-reports${qs}`)
}

export async function adminGetWeeklyReport(id: number): Promise<AdminWeeklyReport> {
  return authRequest(`/admin/weekly-reports/${id}`)
}

export async function adminReviewWeeklyReport(
  id: number,
  data: { reviewNote?: string; completionRate?: number },
): Promise<{ success: boolean; report: AdminWeeklyReport }> {
  return authRequest(`/admin/weekly-reports/${id}/review`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function adminAnalyzeWeeklyReport(id: number): Promise<{ success: boolean; report: AdminWeeklyReport }> {
  return authRequest(`/admin/weekly-reports/${id}/analyze`, { method: 'POST' })
}

// ─── Project Detail: Milestones / Tasks / Health / Reminders ───

export interface AdminMilestone {
  id: number
  project_id: number
  name: string
  description?: string
  dueDate?: string
  status: string
  sortOrder?: number
  taskCount?: number
  taskDoneCount?: number
  created_at?: string
}

export interface AdminTask {
  id: number
  project_id: number
  projectName?: string
  milestone_id?: number
  milestoneName?: string
  assignee_id?: number
  assigneeName?: string
  title: string
  description?: string
  status: string
  priority: string
  dueDate?: string
  sortOrder?: number
  created_at?: string
  updated_at?: string
}

export interface AdminReminder {
  id: number
  memberId: number
  memberName?: string
  projectId?: number
  projectName?: string
  type: string
  title: string
  message?: string
  link?: string
  scheduledAt?: string
  sentAt?: string
  status: string
  createdBy?: number
  created_at?: string
}

export interface AdminProjectHealth {
  project: { id: number; name: string; status: string }
  taskTotal: number
  taskDone: number
  completionRate: number
  byStatus: Record<string, number>
  milestoneCount: number
  milestonesDone: number
  overdueTaskCount: number
  overdueTasks: { id: number; title: string; dueDate?: string; assigneeName?: string }[]
  nextDeadline?: string
  memberWorkload: { memberId: number; name?: string; pendingTasks: number }[]
}

export async function adminListProjectMilestones(projectId: number): Promise<AdminMilestone[]> {
  return authRequest(`/admin/projects/${projectId}/milestones`)
}

export async function adminCreateMilestone(
  projectId: number,
  data: { name: string; description?: string; dueDate?: string; status?: string; sortOrder?: number },
): Promise<{ success: boolean; milestone: AdminMilestone }> {
  return authRequest(`/admin/projects/${projectId}/milestones`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function adminListProjectTasks(projectId: number, params?: Record<string, string>): Promise<AdminTask[]> {
  const qs = params ? '?' + new URLSearchParams(params).toString() : ''
  return authRequest(`/admin/projects/${projectId}/tasks${qs}`)
}

export async function adminCreateTask(
  projectId: number,
  data: {
    title: string
    description?: string
    milestoneId?: number
    assigneeId?: number
    status?: string
    priority?: string
    dueDate?: string
    sortOrder?: number
  },
): Promise<{ success: boolean; task: AdminTask }> {
  return authRequest(`/admin/projects/${projectId}/tasks`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function adminUpdateTask(
  taskId: number,
  data: Partial<AdminTask>,
): Promise<{ success: boolean; task: AdminTask }> {
  return authRequest(`/admin/tasks/${taskId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function adminUpdateTaskStatus(
  taskId: number,
  status: string,
  sortOrder?: number,
): Promise<{ success: boolean; task: AdminTask }> {
  return authRequest(`/admin/tasks/${taskId}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status, sortOrder }),
  })
}

export async function adminProjectHealth(projectId: number): Promise<AdminProjectHealth> {
  return authRequest(`/admin/projects/${projectId}/health`)
}

export async function adminListReminders(params?: Record<string, string>): Promise<AdminReminder[]> {
  const qs = params ? '?' + new URLSearchParams(params).toString() : ''
  return authRequest(`/admin/reminders${qs}`)
}

export async function adminCreateReminder(
  data: {
    memberId: number
    projectId?: number
    title: string
    message?: string
    scheduledAt?: string
    type?: string
  },
): Promise<{ success: boolean; reminder: AdminReminder; sentImmediately: boolean }> {
  return authRequest('/admin/reminders', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

// ─── Import / Export ───

export interface ExportData {
  version: number
  exported_at: string
  config: Record<string, unknown>
  pages: { slug: string; title: string; content: Record<string, unknown> }[]
  members: Record<string, unknown>[]
  projects: Record<string, unknown>[]
  awards: Record<string, unknown>[]
  blogs: Record<string, unknown>[]
}

export async function adminExport(): Promise<ExportData> {
  return authRequest('/admin/export')
}

export interface ImportResult {
  success: boolean
  message: string
  stats: Record<string, number>
  mode: string
}

export async function adminImport(data: ExportData, mode: 'replace' | 'merge' = 'replace'): Promise<ImportResult> {
  return authRequest(`/admin/import?mode=${mode}`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

// ─── Upload ───

export async function adminUpload(file: File): Promise<{ success: boolean; url: string }> {
  const token = getToken()
  if (!token) throw new Error('未登录')

  const formData = new FormData()
  formData.append('file', file)

  const res = await fetch(`${API_BASE}/admin/upload`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(err.message || `HTTP ${res.status}`)
  }
  return res.json()
}

// ─── Admin / Teacher notifications ───

export interface AdminNotificationData {
  id: number
  adminId: number
  type: string
  title: string
  body?: string
  link?: string
  isRead: boolean
  created_at?: string
}

export async function adminListNotifications(unreadOnly?: boolean): Promise<AdminNotificationData[]> {
  const qs = unreadOnly ? '?unread=true' : ''
  return authRequest(`/admin/notifications${qs}`)
}

export async function adminUnreadNotificationCount(): Promise<{ count: number }> {
  return authRequest('/admin/notifications/unread-count')
}

export async function adminMarkNotificationRead(notifId: number): Promise<{ success: boolean; notification: AdminNotificationData }> {
  return authRequest(`/admin/notifications/${notifId}/read`, { method: 'PUT' })
}

export async function adminMarkAllNotificationsRead(): Promise<{ success: boolean }> {
  return authRequest('/admin/notifications/read-all', { method: 'PUT' })
}
