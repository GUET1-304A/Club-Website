import { useState, type FormEvent } from 'react'
import { Eye, EyeOff, AlertCircle, ArrowLeft } from 'lucide-react'
import Logo from '../ui/Logo'
import { setRole } from '../../services/api'

/**
 * Unified Login/Register Page.
 * Login:  admin username or member student_id/email + password → redirects accordingly.
 * Register: matches student_id/email + name against the members table → sets password → auto-login.
 */

async function unifiedLogin(account: string, password: string) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ account, password }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(err.message || `HTTP ${res.status}`)
  }
  const data = await res.json()
  if (data.role === 'admin' || data.role === 'teacher') {
    localStorage.setItem('auth_token', data.token)
    setRole(data.role)
  } else {
    localStorage.setItem('member_token', data.token)
  }
  return data as { success: boolean; token: string; role: 'admin' | 'teacher' | 'member'; user: Record<string, unknown> }
}

async function register(account: string, name: string, password: string) {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ account, name, password }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(err.message || `HTTP ${res.status}`)
  }
  const data = await res.json()
  localStorage.setItem('member_token', data.token)
  return data as { success: boolean; token: string; role: 'member'; user: Record<string, unknown> }
}

export default function UnifiedLogin() {
  const [tab, setTab] = useState<'login' | 'register'>('login')

  // ── Login state ──
  const [account, setAccount] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // ── Register state ──
  const [regAccount, setRegAccount] = useState('')
  const [regName, setRegName] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regConfirmPw, setRegConfirmPw] = useState('')

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const switchTab = (t: 'login' | 'register') => {
    setTab(t)
    setError('')
  }

  /* ── Login handler ── */
  const handleLogin = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (!account.trim()) { setError('请输入账号'); return }
    if (!password) { setError('请输入密码'); return }
    setLoading(true)
    try {
      const result = await unifiedLogin(account.trim(), password)
      window.location.href =
        result.role === 'teacher' ? '/admin/teacher'
          : result.role === 'admin' ? '/admin'
            : '/member/dashboard'
    } catch (err: unknown) {
      setError((err as Error).message || '登录失败，请重试')
    } finally { setLoading(false) }
  }

  /* ── Register handler ── */
  const handleRegister = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (!regAccount.trim()) { setError('请输入学号或邮箱'); return }
    if (!regName.trim()) { setError('请输入你的真实姓名'); return }
    if (!regPassword) { setError('请设置密码'); return }
    if (regPassword.length < 6) { setError('密码至少需要6个字符'); return }
    if (regPassword !== regConfirmPw) { setError('两次输入的密码不一致'); return }

    setLoading(true)
    try {
      await register(regAccount.trim(), regName.trim(), regPassword)
      window.location.href = '/member/dashboard'
    } catch (err: unknown) {
      setError((err as Error).message || '注册失败，请重试')
    } finally { setLoading(false) }
  }

  /* ═══════════════════════════════════════════════════════════════ */

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f7f5] px-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-[#051A24]/[0.02] blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-[#051A24]/[0.02] blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10 animate-fade-in-up">
        <a href="/" className="inline-flex items-center gap-1.5 text-xs text-[#273C46]/50 hover:text-[#051A24] transition-colors mb-6">
          <ArrowLeft className="w-3.5 h-3.5" /> 返回网站首页
        </a>

        <div className="bg-white rounded-[28px] p-8 shadow-xl shadow-[#051A24]/[0.04] border border-[rgba(0,0,0,0.04)]">
          {/* Brand */}
          <div className="flex flex-col items-center mb-6">
            <Logo size="lg" className="mb-4" />
            <h1 className="text-xl text-[#051A24] tracking-tight"
              style={{ fontFamily: "var(--font-sans)", fontWeight: 500 }}>
              星雨作坊
            </h1>
          </div>

          {/* Tab switcher */}
          <div className="flex items-center bg-[#f8f7f5] rounded-2xl p-1 mb-6">
            <button
              onClick={() => switchTab('login')}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${tab === 'login' ? 'bg-white text-[#051A24] shadow-sm' : 'text-[#273C46]/50 hover:text-[#051A24]'}`}
            >
              登录
            </button>
            <button
              onClick={() => switchTab('register')}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${tab === 'register' ? 'bg-white text-[#051A24] shadow-sm' : 'text-[#273C46]/50 hover:text-[#051A24]'}`}
            >
              注册
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2.5 mb-5 px-4 py-3 bg-red-50 border border-red-100 rounded-2xl text-sm text-red-700 animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* ═══ Login Form ═══ */}
          {tab === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <Field label="账号">
                <Input
                  value={account} onChange={e => setAccount(e.target.value)}
                  placeholder="管理员用户名 / 成员学号 / 邮箱"
                  autoComplete="username"
                />
              </Field>

              <Field label="密码">
                <PasswordInput
                  value={password} onChange={e => setPassword(e.target.value)}
                  show={showPassword} onToggle={() => setShowPassword(!showPassword)}
                  placeholder="请输入密码"
                  autoComplete="current-password"
                />
              </Field>

              <button type="submit" disabled={loading}
                className="btn-primary w-full py-3 text-sm font-medium flex items-center justify-center gap-2
                  shadow-lg shadow-[#051A24]/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all mt-2">
                {loading ? <><Spinner /> 处理中...</> : '登 录'}
              </button>
            </form>
          )}

          {/* ═══ Register Form ═══ */}
          {tab === 'register' && (
            <form onSubmit={handleRegister} className="space-y-4">
              <Field label="学号或邮箱 *">
                <Input
                  value={regAccount} onChange={e => setRegAccount(e.target.value)}
                  placeholder="请输入你的学号或邮箱（需与数据库记录匹配）"
                />
              </Field>

              <Field label="真实姓名 *">
                <Input
                  value={regName} onChange={e => setRegName(e.target.value)}
                  placeholder="用于身份验证，需与管理员录入的姓名一致"
                />
              </Field>

              <Field label="设置密码 *">
                <PasswordInput
                  value={regPassword} onChange={e => setRegPassword(e.target.value)}
                  show={showPassword} onToggle={() => setShowPassword(!showPassword)}
                  placeholder="至少6个字符"
                />
              </Field>

              <Field label="确认密码 *">
                <PasswordInput
                  value={regConfirmPw} onChange={e => setRegConfirmPw(e.target.value)}
                  show={showPassword} onToggle={() => setShowPassword(!showPassword)}
                  placeholder="再次输入密码"
                />
              </Field>

              <button type="submit" disabled={loading}
                className="btn-primary w-full py-3 text-sm font-medium flex items-center justify-center gap-2
                  shadow-lg shadow-[#051A24]/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all mt-2">
                {loading ? <><Spinner /> 注册中...</> : '注 册'}
              </button>
            </form>
          )}
        </div>

        {/* Footer hint */}
        <p className="text-center text-xs text-[#273C46]/30 mt-6">
          {tab === 'login'
            ? '管理员/教师使用用户名登录 · 成员使用学号或邮箱登录'
            : '仅社团成员可注册 · 需管理员预先录入信息'}
        </p>
      </div>
    </div>
  )
}

/* ─── Reusable mini components ─── */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-[#273C46]/60 mb-1.5 ml-1">{label}</label>
      {children}
    </div>
  )
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full px-4 py-3 rounded-2xl border border-[rgba(0,0,0,0.08)] bg-[#fcfbfa]
        text-sm text-[#051A24] placeholder:text-[#273C46]/25
        focus:outline-none focus:border-[#051A24]/30 focus:ring-2 focus:ring-[#051A24]/5
        transition-all ${props.className || ''}`}
    />
  )
}

function PasswordInput({ show, onToggle, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { show: boolean; onToggle: () => void }) {
  return (
    <div className="relative">
      <Input {...props} type={show ? 'text' : 'password'} className="pr-11" />
      <button type="button" onClick={onToggle}
        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#273C46]/25 hover:text-[#273C46]/60 transition-colors"
        tabIndex={-1}>
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  )
}

function Spinner() {
  return <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
}
