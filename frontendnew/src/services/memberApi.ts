const API_BASE = '/api'

let _token: string | null = null
let _profile: MemberProfile | null = null

function getToken(): string | null {
  if (_token) return _token
  _token = localStorage.getItem('member_token')
  return _token
}

export function setMemberToken(token: string): void {
  _token = token
  localStorage.setItem('member_token', token)
}

export function clearMemberToken(): void {
  _token = null
  _profile = null
  localStorage.removeItem('member_token')
}

export function isMemberLoggedIn(): boolean {
  return !!getToken()
}

export function memberLogout(): void {
  clearMemberToken()
}

async function memberRequest<T>(url: string, options?: RequestInit): Promise<T> {
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

export interface MemberProfile {
  id: number
  name: string
  avatar?: string
  role?: string
  group?: string
  skills?: string[]
  github?: string
  blog?: string
  email?: string
  phone?: string
  studentId?: string
  bio?: string
  grade?: string
  isAlumni?: boolean
  notificationPrefs?: Record<string, boolean>
  lastLoginAt?: string
  created_at?: string
  updated_at?: string
}

export interface MemberLoginResponse {
  success: boolean
  token: string
  member: MemberProfile
}

// ─── Auth ───

export async function memberLogin(account: string, password: string): Promise<MemberLoginResponse> {
  const res = await fetch(`${API_BASE}/member/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ account, password }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(err.message || `HTTP ${res.status}`)
  }
  const data: MemberLoginResponse = await res.json()
  setMemberToken(data.token)
  _profile = data.member
  return data
}

export async function memberGetMe(): Promise<MemberProfile> {
  const profile = await memberRequest<MemberProfile>('/member/me')
  _profile = profile
  return profile
}

export async function memberUpdateMe(data: Partial<MemberProfile>): Promise<{ success: boolean; member: MemberProfile }> {
  const result = await memberRequest<{ success: boolean; member: MemberProfile }>('/member/me', {
    method: 'PUT',
    body: JSON.stringify(data),
  })
  _profile = result.member
  return result
}

export async function memberChangePassword(currentPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> {
  return memberRequest('/member/me/password', {
    method: 'PUT',
    body: JSON.stringify({ currentPassword, newPassword }),
  })
}

// ─── Dashboard Stats ───

export interface DashboardStats {
  totalMembers: number
  totalProjects: number
  activeProjects: number
  totalTasks: number
  doneTasks: number
}

export async function memberDashboardStats(): Promise<DashboardStats> {
  return memberRequest('/member/dashboard/stats')
}

// ─── Directory ───

export async function memberDirectory(params?: Record<string, string>): Promise<MemberProfile[]> {
  const qs = params ? '?' + new URLSearchParams(params).toString() : ''
  return memberRequest(`/member/directory${qs}`)
}

// ─── Projects ───

export interface ProjectData {
  id: number
  slug: string
  name: string
  coverImage?: string
  category?: string
  techStack?: string[]
  description?: string
  content?: string
  githubUrl?: string
  demoUrl?: string
  stars?: number
  forks?: number
  screenshots?: string[]
  team?: { name: string; avatar: string; role: string }[]
  status?: string
  startDate?: string
  endDate?: string
  ownerId?: number
  ownerName?: string
  milestoneCount?: number
  taskCount?: number
  taskDoneCount?: number
}

export interface TaskData {
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

export interface CreateTaskPayload {
  title: string
  description?: string
  milestoneId?: number
  assigneeId?: number
  status?: string
  priority?: string
  dueDate?: string
  sortOrder?: number
}

export interface MilestoneData {
  id: number
  project_id: number
  name: string
  description?: string
  dueDate?: string
  status: string
  sortOrder?: number
  taskCount?: number
  taskDoneCount?: number
}

export interface ProjectDetail {
  project: ProjectData
  milestones: MilestoneData[]
  tasks: TaskData[]
}

export async function memberListProjects(params?: Record<string, string>): Promise<ProjectData[]> {
  const qs = params ? '?' + new URLSearchParams(params).toString() : ''
  return memberRequest(`/member/projects${qs}`)
}

export async function memberGetProject(projectId: number): Promise<ProjectDetail> {
  return memberRequest(`/member/projects/${projectId}`)
}

// ─── Tasks ───

export async function memberListTasks(params?: Record<string, string>): Promise<TaskData[]> {
  const qs = params ? '?' + new URLSearchParams(params).toString() : ''
  return memberRequest(`/member/tasks${qs}`)
}

export async function memberCreateTask(projectId: number, data: CreateTaskPayload): Promise<{ success: boolean; task: TaskData }> {
  return memberRequest(`/member/projects/${projectId}/tasks`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function memberUpdateTask(taskId: number, data: Partial<TaskData>): Promise<{ success: boolean; task: TaskData }> {
  return memberRequest(`/member/tasks/${taskId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function memberUpdateTaskStatus(taskId: number, status: string, sortOrder?: number): Promise<{ success: boolean; task: TaskData }> {
  return memberRequest(`/member/tasks/${taskId}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status, sortOrder }),
  })
}

// ─── Resources ───

export interface ResourceFolderData {
  id: number
  name: string
  parentId?: number
  createdBy?: number
  fileCount?: number
  created_at?: string
}

export interface ResourceFileData {
  id: number
  folderId?: number
  name: string
  filePath: string
  fileType?: string
  fileSize?: number
  uploadedBy?: number
  uploaderName?: string
  isDeleted?: boolean
  created_at?: string
}

export async function memberListFolders(parentId?: number): Promise<ResourceFolderData[]> {
  const qs = parentId ? `?parentId=${parentId}` : ''
  return memberRequest(`/member/resources/folders${qs}`)
}

export async function memberCreateFolder(name: string, parentId?: number): Promise<{ success: boolean; folder: ResourceFolderData }> {
  return memberRequest('/member/resources/folders', {
    method: 'POST',
    body: JSON.stringify({ name, parentId }),
  })
}

export async function memberListFiles(params?: { folderId?: number; search?: string }): Promise<ResourceFileData[]> {
  const qs = new URLSearchParams()
  if (params?.folderId) qs.set('folderId', String(params.folderId))
  if (params?.search) qs.set('search', params.search)
  const q = qs.toString()
  return memberRequest(`/member/resources/files${q ? '?' + q : ''}`)
}

export async function memberUploadResource(file: File, folderId?: number): Promise<{ success: boolean; file: ResourceFileData }> {
  const token = getToken()
  if (!token) throw new Error('未登录')
  const formData = new FormData()
  formData.append('file', file)
  if (folderId) formData.append('folderId', String(folderId))
  const res = await fetch(`${API_BASE}/member/resources/upload`, {
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

export async function memberUpdateResource(fileId: number, data: { name?: string; folderId?: number }): Promise<{ success: boolean; file: ResourceFileData }> {
  return memberRequest(`/member/resources/${fileId}`, { method: 'PUT', body: JSON.stringify(data) })
}

export async function memberDeleteResource(fileId: number): Promise<{ success: boolean; message: string }> {
  return memberRequest(`/member/resources/${fileId}`, { method: 'DELETE' })
}

// ─── Certificates ───

export interface CertificateData {
  id: number
  memberId: number
  memberName?: string
  name: string
  level?: string
  category?: string
  winner?: string
  issuer?: string
  date?: string
  description?: string
  images?: string[]
  ocrText?: string
  relatedProject?: string
  status: string
  created_at?: string
  updated_at?: string
}

export async function memberListCertificates(): Promise<CertificateData[]> {
  return memberRequest('/member/certificates')
}

export async function memberCreateCertificate(data: Partial<CertificateData>): Promise<{ success: boolean; certificate: CertificateData }> {
  return memberRequest('/member/certificates', { method: 'POST', body: JSON.stringify(data) })
}

export async function memberUpdateCertificate(certId: number, data: Partial<CertificateData>): Promise<{ success: boolean; certificate: CertificateData }> {
  return memberRequest(`/member/certificates/${certId}`, { method: 'PUT', body: JSON.stringify(data) })
}

export async function memberDeleteCertificate(certId: number): Promise<{ success: boolean; message: string }> {
  return memberRequest(`/member/certificates/${certId}`, { method: 'DELETE' })
}

export async function memberUploadCertificateImage(file: File): Promise<{ success: boolean; url: string }> {
  const token = getToken()
  if (!token) throw new Error('未登录')
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch(`${API_BASE}/member/certificates/upload`, {
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

export interface CertificateOcrResponse {
  success: boolean
  ocrText: string
  certificate: CertificateData
}

export async function memberRunCertificateOcr(certId: number): Promise<CertificateOcrResponse> {
  return memberRequest(`/member/certificates/${certId}/ocr`, { method: 'POST' })
}

// ─── Notifications ───

export interface NotificationData {
  id: number
  memberId: number
  type: string
  title: string
  body?: string
  link?: string
  isRead: boolean
  created_at?: string
}

export async function memberListNotifications(unreadOnly?: boolean): Promise<NotificationData[]> {
  const qs = unreadOnly ? '?unread=true' : ''
  return memberRequest(`/member/notifications${qs}`)
}

export async function memberUnreadCount(): Promise<{ count: number }> {
  return memberRequest('/member/notifications/unread-count')
}

export async function memberMarkRead(notifId: number): Promise<{ success: boolean }> {
  return memberRequest(`/member/notifications/${notifId}/read`, { method: 'PUT' })
}

export async function memberMarkAllRead(): Promise<{ success: boolean }> {
  return memberRequest('/member/notifications/read-all', { method: 'PUT' })
}

// ─── Cached profile accessor ───

export function getCachedProfile(): MemberProfile | null {
  return _profile
}

export function getMemberToken(): string | null {
  return getToken()
}
