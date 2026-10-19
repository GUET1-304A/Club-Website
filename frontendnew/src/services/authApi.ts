import { setRole } from './api'
import { setMemberToken, type MemberProfile } from './memberApi'

export interface AuthResponse {
  success: boolean
  token: string
  role: 'admin' | 'teacher' | 'member'
  user: Record<string, unknown>
}

interface QQBindResponse {
  success: boolean
  message: string
  token: string
  role: 'member'
  user: MemberProfile
}

async function readError(res: Response): Promise<string> {
  const payload = await res.json().catch(() => null) as { message?: string } | null
  return payload?.message || `HTTP ${res.status}`
}

export function storeAuth(data: AuthResponse): void {
  if (data.role === 'admin' || data.role === 'teacher') {
    localStorage.setItem('auth_token', data.token)
    setRole(data.role)
    return
  }
  setMemberToken(data.token)
}

export function destinationForRole(role: AuthResponse['role']): string {
  if (role === 'teacher') return '/admin/teacher'
  if (role === 'admin') return '/admin'
  return '/member/dashboard'
}

export function storeQQToken(token: string): void {
  setMemberToken(token)
}

export async function unifiedLogin(account: string, password: string): Promise<AuthResponse> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ account, password }),
  })
  if (!res.ok) throw new Error(await readError(res))
  const data = await res.json() as AuthResponse
  storeAuth(data)
  return data
}

export async function registerMember(account: string, name: string, password: string): Promise<AuthResponse> {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ account, name, password }),
  })
  if (!res.ok) throw new Error(await readError(res))
  const data = await res.json() as AuthResponse
  storeAuth(data)
  return data
}

export async function qqLoginStatus(): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/qq/status', { cache: 'no-store' })
    if (!res.ok) return false
    const data = await res.json() as { enabled?: boolean }
    return data.enabled === true
  } catch {
    return false
  }
}

export function startQQLogin(): void {
  window.location.href = '/api/auth/qq/start'
}

export async function bindQQMember(
  ticket: string,
  account: string,
  name: string,
  password: string,
): Promise<QQBindResponse> {
  const res = await fetch('/api/auth/qq/bind', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ticket, account, name, password }),
  })
  if (!res.ok) throw new Error(await readError(res))
  const data = await res.json() as QQBindResponse
  setMemberToken(data.token)
  return data
}

export interface QQCallbackState {
  token?: string
  bindTicket?: string
  nickname?: string
  error?: string
}

export function readQQCallbackState(): QQCallbackState {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const state: QQCallbackState = {
    token: params.get('qq_token') || undefined,
    bindTicket: params.get('qq_bind') || undefined,
    nickname: params.get('qq_nickname') || undefined,
    error: params.get('qq_error') || undefined,
  }
  if (state.token || state.bindTicket || state.error) {
    window.history.replaceState({}, '', window.location.pathname + window.location.search)
  }
  return state
}
