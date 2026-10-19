import { useState, type FormEvent } from 'react'
import { LogIn, Eye, EyeOff, AlertCircle, ArrowLeft } from 'lucide-react'
import Logo from '../ui/Logo'

interface Props {
  onLogin: (account: string, password: string) => Promise<void>
}

export default function MemberLogin({ onLogin }: Props) {
  const [account, setAccount] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    if (!account.trim()) { setError('请输入学号或邮箱'); return }
    if (!password) { setError('请输入密码'); return }

    setLoading(true)
    try {
      await onLogin(account.trim(), password)
    } catch (err: unknown) {
      setError((err as Error).message || '登录失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f7f5] px-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-[#051A24]/[0.02] blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-[#051A24]/[0.02] blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10 animate-fade-in-up">
        {/* Back to site */}
        <a
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-[#273C46]/50 hover:text-[#051A24] transition-colors mb-6"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          返回网站首页
        </a>

        {/* Card */}
        <div
          className="bg-white rounded-[28px] p-8 shadow-xl shadow-[#051A24]/[0.04] border border-[rgba(0,0,0,0.04)]"
        >
          {/* Brand */}
          <div className="flex flex-col items-center mb-8">
            <Logo size="lg" className="mb-4" />
            <h1
              className="text-xl text-[#051A24] tracking-tight"
              style={{ fontFamily: "var(--font-sans)", fontWeight: 500 }}
            >
              成员门户
            </h1>
            <p className="text-xs text-[#273C46]/40 mt-1.5">
              登录以访问社团内部资源
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2.5 mb-5 px-4 py-3 bg-red-50 border border-red-100 rounded-2xl text-sm text-red-700 animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#273C46]/60 mb-1.5 ml-1">
                学号 / 邮箱
              </label>
              <input
                type="text"
                value={account}
                onChange={e => setAccount(e.target.value)}
                placeholder="请输入学号或邮箱"
                autoComplete="username"
                className="w-full px-4 py-3 rounded-2xl border border-[rgba(0,0,0,0.08)] bg-[#fcfbfa]
                  text-sm text-[#051A24] placeholder:text-[#273C46]/25
                  focus:outline-none focus:border-[#051A24]/30 focus:ring-2 focus:ring-[#051A24]/5
                  transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#273C46]/60 mb-1.5 ml-1">
                密码
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="请输入密码"
                  autoComplete="current-password"
                  className="w-full px-4 py-3 pr-11 rounded-2xl border border-[rgba(0,0,0,0.08)] bg-[#fcfbfa]
                    text-sm text-[#051A24] placeholder:text-[#273C46]/25
                    focus:outline-none focus:border-[#051A24]/30 focus:ring-2 focus:ring-[#051A24]/5
                    transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#273C46]/25 hover:text-[#273C46]/60 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3 text-sm font-medium flex items-center justify-center gap-2
                shadow-lg shadow-[#051A24]/10 hover:shadow-xl hover:shadow-[#051A24]/15
                disabled:opacity-50 disabled:cursor-not-allowed transition-all mt-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  登录中...
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  登 录
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer hint */}
        <p className="text-center text-xs text-[#273C46]/30 mt-6">
          没有账号？请联系社团管理员获取登录权限
        </p>
      </div>
    </div>
  )
}
