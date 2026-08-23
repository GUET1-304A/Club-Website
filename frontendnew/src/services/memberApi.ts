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

export interface CertificateOcrFields {
  name?: string
  level?: string
  category?: string
  winner?: string
  issuer?: string
  advisor?: string
  date?: string
  description?: string
}

export interface CertificateData {
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
  ocrFields?: CertificateOcrFields | null
  relatedProject?: string
  status: string
  reviewNote?: string
  reviewedBy?: number
  reviewedAt?: string
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
  ocrFields?: CertificateOcrFields | null
  certificate: CertificateData
}

export async function memberRunCertificateOcr(certId: number): Promise<CertificateOcrResponse> {
  return memberRequest(`/member/certificates/${certId}/ocr`, { method: 'POST' })
}

export async function memberRunCertificateOcrImages(images: string[]): Promise<{
  success: boolean
  ocrText: string
  ocrFields: CertificateOcrFields
}> {
  return memberRequest('/member/certificates/ocr', {
    method: 'POST',
    body: JSON.stringify({ images }),
  })
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

// ─── Blog read tracking ───

export async function memberMarkBlogRead(blogId: number): Promise<{ success: boolean }> {
  return memberRequest(`/member/blogs/${blogId}/read`, { method: 'POST' })
}

export async function memberBlogReadIds(): Promise<{ readIds: number[] }> {
  return memberRequest('/member/blogs/read-ids')
}

// ─── Weekly Reports ───

export interface WeeklyReportContent {
  done?: string
  plan?: string
  issues?: string
  summary?: string
  [key: string]: string | undefined
}

export interface WeeklyReportAnalysis {
  score?: number
  completion?: string
  risks?: string[]
  suggestions?: string[]
  report?: string
}

export interface WeeklyReportData {
  id: number
  memberId: number
  memberName?: string
  projectId?: number
  projectName?: string
  weekStart?: string
  weekEnd?: string
  content: WeeklyReportContent
  completionRate?: number
  aiAnalysis?: WeeklyReportAnalysis | null
  status: string
  reviewNote?: string
  reviewedBy?: number
  submittedAt?: string
  reviewedAt?: string
  created_at?: string
  updated_at?: string
}

export async function memberListWeeklyReports(status?: string): Promise<WeeklyReportData[]> {
  const qs = status ? `?status=${status}` : ''
  return memberRequest(`/member/weekly-reports${qs}`)
}

export async function memberCreateWeeklyReport(data: {
  weekStart?: string
  weekEnd?: string
  content?: WeeklyReportContent
  done?: string
  plan?: string
  issues?: string
  summary?: string
  projectId?: number
}): Promise<{ success: boolean; report: WeeklyReportData }> {
  return memberRequest('/member/weekly-reports', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function memberGetWeeklyReport(reportId: number): Promise<WeeklyReportData> {
  return memberRequest(`/member/weekly-reports/${reportId}`)
}

export async function memberUpdateWeeklyReport(
  reportId: number,
  data: Partial<WeeklyReportData>,
): Promise<{ success: boolean; report: WeeklyReportData }> {
  return memberRequest(`/member/weekly-reports/${reportId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function memberSubmitWeeklyReport(reportId: number): Promise<{ success: boolean; report: WeeklyReportData }> {
  return memberRequest(`/member/weekly-reports/${reportId}/submit`, { method: 'POST' })
}

export async function memberDeleteWeeklyReport(reportId: number): Promise<{ success: boolean; message: string }> {
  return memberRequest(`/member/weekly-reports/${reportId}`, { method: 'DELETE' })
}

export async function memberAnalyzeWeeklyReport(reportId: number): Promise<{ success: boolean; report: WeeklyReportData }> {
  return memberRequest(`/member/weekly-reports/${reportId}/analyze`, { method: 'POST' })
}

// ─── Reminders ───

export interface ReminderData {
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

export async function memberListReminders(status?: string): Promise<ReminderData[]> {
  const qs = status ? `?status=${status}` : ''
  return memberRequest(`/member/reminders${qs}`)
}

export async function memberCreateReminder(data: {
  title: string
  message?: string
  scheduledAt?: string
  projectId?: number
  type?: string
}): Promise<{ success: boolean; reminder: ReminderData; sentImmediately: boolean }> {
  return memberRequest('/member/reminders', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function memberUpdateReminder(
  reminderId: number,
  data: Partial<ReminderData>,
): Promise<{ success: boolean; reminder: ReminderData }> {
  return memberRequest(`/member/reminders/${reminderId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function memberCompleteReminder(reminderId: number): Promise<{ success: boolean; reminder: ReminderData }> {
  return memberRequest(`/member/reminders/${reminderId}/complete`, { method: 'POST' })
}

export async function memberDeleteReminder(reminderId: number): Promise<{ success: boolean; message: string }> {
  return memberRequest(`/member/reminders/${reminderId}`, { method: 'DELETE' })
}

// ─── AI Assistant ───

export interface AssistantToolCall {
  name: string
  arguments: Record<string, unknown>
  ok: boolean
  result: unknown
}

export interface ConversationData {
  id: number
  memberId: number
  title: string
  messageCount: number
  lastMessage?: string
  created_at?: string
  updated_at?: string
}

export interface ConversationMessageData {
  id: number
  conversationId: number
  role: string
  content: string
  toolCalls?: AssistantToolCall[] | null
  created_at?: string
}

export interface AssistantChatResponse {
  success: boolean
  reply: string
  toolCalls: AssistantToolCall[]
  conversation?: ConversationData
}

export interface AssistantStatus {
  enabled: boolean
  configured: boolean
  provider?: string
}

export interface RequirementPlan {
  project: {
    name: string
    description?: string
    category?: string
    startDate?: string
    endDate?: string
  }
  milestones: {
    name: string
    description?: string
    dueDate?: string
  }[]
  tasks: {
    milestoneIndex?: number
    title: string
    description?: string
    priority?: string
    dueDate?: string
    assigneeName?: string
  }[]
}

export interface ApplyPlanSummary {
  project: ProjectData
  milestoneCount: number
  taskCount: number
}

export async function assistantStatus(): Promise<AssistantStatus> {
  return memberRequest('/assistant/status')
}

export interface AssistantChatOptions {
  history?: { role: 'user' | 'assistant'; content: string }[]
  conversationId?: number
}

export async function assistantChat(message: string, options?: AssistantChatOptions): Promise<AssistantChatResponse> {
  return memberRequest('/assistant/chat', {
    method: 'POST',
    body: JSON.stringify({ message, ...options }),
  })
}

export interface AssistantStreamHandlers {
  onConversation?: (conversation: { id: number; title: string }) => void
  onDelta: (text: string) => void
  onToolStart: (name: string, args: Record<string, unknown>) => void
  onToolDone: (name: string, ok: boolean) => void
  onDone: (reply: string, toolCalls: AssistantToolCall[]) => void
  onError: (message: string) => void
}

export async function assistantChatStream(
  message: string,
  history: { role: 'user' | 'assistant'; content: string }[],
  conversationId: number | undefined,
  handlers: AssistantStreamHandlers,
): Promise<void> {
  const token = getToken()
  if (!token) throw new Error('未登录')

  const res = await fetch(`${API_BASE}/assistant/chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ message, history, conversationId }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(err.message || `HTTP ${res.status}`)
  }
  await consumeSse(res, ({ event, payload }) => {
    switch (event) {
      case 'conversation':
        handlers.onConversation?.(payload as { id: number; title: string })
        break
      case 'delta':
        if (typeof payload.text === 'string') handlers.onDelta(payload.text)
        break
      case 'tool_start':
        handlers.onToolStart(
          String(payload.name ?? ''),
          (payload.arguments as Record<string, unknown>) ?? {},
        )
        break
      case 'tool_done':
        handlers.onToolDone(String(payload.name ?? ''), payload.ok === true)
        break
      case 'done':
        handlers.onDone(
          String(payload.reply ?? ''),
          (payload.toolCalls as AssistantToolCall[]) ?? [],
        )
        break
      case 'error':
        handlers.onError(String(payload.message ?? '智能体执行出错'))
        break
    }
  })
}

interface SseFrame {
  event: string
  payload: Record<string, unknown>
}

async function consumeSse(res: Response, onEvent: (frame: SseFrame) => void): Promise<void> {
  if (!res.body) throw new Error('当前浏览器不支持流式输出')
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let separatorIndex: number
    while ((separatorIndex = buffer.indexOf('\n\n')) !== -1) {
      const frame = buffer.slice(0, separatorIndex)
      buffer = buffer.slice(separatorIndex + 2)
      onEvent(parseSseFrame(frame))
    }
  }
}

function parseSseFrame(frame: string): SseFrame {
  let event = 'message'
  let data = ''
  for (const line of frame.split('\n')) {
    if (line.startsWith('event:')) {
      event = line.slice('event:'.length).trim()
    } else if (line.startsWith('data:')) {
      data += line.slice('data:'.length).trim()
    }
  }
  let payload: Record<string, unknown> = {}
  if (data) {
    try {
      payload = JSON.parse(data) as Record<string, unknown>
    } catch {
      payload = {}
    }
  }
  return { event, payload }
}

// ─── AI Conversations (会话隔离与历史持久化) ───

export async function listConversations(): Promise<ConversationData[]> {
  return memberRequest('/assistant/conversations')
}

export async function createConversation(title?: string): Promise<{ success: boolean; conversation: ConversationData }> {
  return memberRequest('/assistant/conversations', {
    method: 'POST',
    body: JSON.stringify({ title }),
  })
}

export async function getConversation(conversationId: number): Promise<{
  conversation: ConversationData
  messages: ConversationMessageData[]
}> {
  return memberRequest(`/assistant/conversations/${conversationId}`)
}

export async function renameConversation(conversationId: number, title: string): Promise<{ success: boolean; conversation: ConversationData }> {
  return memberRequest(`/assistant/conversations/${conversationId}`, {
    method: 'PUT',
    body: JSON.stringify({ title }),
  })
}

export async function deleteConversation(conversationId: number): Promise<{ success: boolean; message: string }> {
  return memberRequest(`/assistant/conversations/${conversationId}`, { method: 'DELETE' })
}

export async function assistantParseRequirement(message: string): Promise<{ success: boolean; plan: RequirementPlan }> {
  return memberRequest('/assistant/parse-requirement', {
    method: 'POST',
    body: JSON.stringify({ message }),
  })
}

export interface RequirementStreamHandlers {
  onDelta: (text: string) => void
  onPlan: (plan: RequirementPlan) => void
  onError: (message: string) => void
}

export async function assistantParseRequirementStream(
  message: string,
  handlers: RequirementStreamHandlers,
): Promise<void> {
  const token = getToken()
  if (!token) throw new Error('未登录')

  const res = await fetch(`${API_BASE}/assistant/parse-requirement/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ message }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(err.message || `HTTP ${res.status}`)
  }
  await consumeSse(res, ({ event, payload }) => {
    switch (event) {
      case 'delta':
        if (typeof payload.text === 'string') handlers.onDelta(payload.text)
        break
      case 'plan':
        handlers.onPlan(payload.plan as RequirementPlan)
        break
      case 'error':
        handlers.onError(String(payload.message ?? '生成失败'))
        break
    }
  })
}

export async function assistantApplyPlan(plan: RequirementPlan): Promise<{ success: boolean; summary: ApplyPlanSummary }> {
  return memberRequest('/assistant/apply-plan', {
    method: 'POST',
    body: JSON.stringify({ plan }),
  })
}

// ─── Cached profile accessor ───

export function getCachedProfile(): MemberProfile | null {
  return _profile
}

export function getMemberToken(): string | null {
  return getToken()
}
