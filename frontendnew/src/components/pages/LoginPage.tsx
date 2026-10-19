import {
  useEffect,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type FormEvent,
  type InputHTMLAttributes,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  PartyPopper,
  ShieldCheck,
  Sparkles,
  User,
} from 'lucide-react'
import Logo from '../ui/Logo'
import {
  bindQQMember,
  destinationForRole,
  qqLoginStatus,
  readQQCallbackState,
  registerMember,
  startQQLogin,
  storeQQToken,
  unifiedLogin,
} from '../../services/authApi'

type Mode = 'login' | 'register' | 'bind'
type RegisterStep = 0 | 1 | 2

const stepCopy = [
  {
    title: '开始加入星雨作坊',
    subtitle: '仅限管理员已录入的成员激活账号',
  },
  {
    title: '创建你的密码',
    subtitle: '密码至少需要 6 个字符',
  },
  {
    title: '最后一步',
    subtitle: '再次确认密码，完成成员激活',
  },
] as const

const confettiColors = ['#8ea6ff', '#e7c56b', '#66d4bc', '#f08aa0', '#f6fcff', '#3457ff']

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>('login')
  const [registerStep, setRegisterStep] = useState<RegisterStep>(0)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [successTitle, setSuccessTitle] = useState('欢迎加入')

  const [account, setAccount] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const [regAccount, setRegAccount] = useState('')
  const [regName, setRegName] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regConfirm, setRegConfirm] = useState('')

  const [qqEnabled, setQQEnabled] = useState(false)
  const [qqChecking, setQQChecking] = useState(true)
  const [bindTicket, setBindTicket] = useState('')
  const [qqNickname, setQQNickname] = useState('')
  const [bindAccount, setBindAccount] = useState('')
  const [bindName, setBindName] = useState('')
  const [bindPassword, setBindPassword] = useState('')
  const [showBindPassword, setShowBindPassword] = useState(false)

  useEffect(() => {
    let cancelled = false

    qqLoginStatus()
      .then(enabled => {
        if (!cancelled) setQQEnabled(enabled)
      })
      .finally(() => {
        if (!cancelled) setQQChecking(false)
      })

    const callback = readQQCallbackState()
    if (callback.token) {
      storeQQToken(callback.token)
      window.location.href = '/member/dashboard'
    } else if (callback.bindTicket) {
      setBindTicket(callback.bindTicket)
      setQQNickname(callback.nickname || 'QQ 用户')
      setMode('bind')
    } else if (callback.error) {
      setError(callback.error)
    }

    return () => {
      cancelled = true
    }
  }, [])

  const clearError = () => {
    if (error) setError('')
  }

  const switchMode = (next: Mode) => {
    setMode(next)
    setRegisterStep(0)
    setError('')
  }

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    if (!account.trim()) {
      setError('请输入账号')
      return
    }
    if (!password) {
      setError('请输入密码')
      return
    }

    setLoading(true)
    try {
      const result = await unifiedLogin(account.trim(), password)
      window.location.href = destinationForRole(result.role)
    } catch (err: unknown) {
      setError((err as Error).message || '登录失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const advanceRegister = () => {
    setError('')
    if (registerStep === 0) {
      if (!regAccount.trim()) {
        setError('请输入学号或邮箱')
        return
      }
      if (!regName.trim()) {
        setError('请输入真实姓名')
        return
      }
      setRegisterStep(1)
      return
    }
    if (registerStep === 1) {
      if (regPassword.length < 6) {
        setError('密码至少需要 6 个字符')
        return
      }
      setRegisterStep(2)
    }
  }

  const handleRegister = async (event: FormEvent) => {
    event.preventDefault()
    if (registerStep < 2) {
      advanceRegister()
      return
    }
    setError('')
    if (regPassword !== regConfirm) {
      setError('两次输入的密码不一致')
      return
    }

    setLoading(true)
    try {
      const result = await registerMember(regAccount.trim(), regName.trim(), regPassword)
      setSuccessTitle('账号已激活')
      setSuccessMessage('账号已激活，正在进入成员门户')
      window.setTimeout(() => {
        window.location.href = destinationForRole(result.role)
      }, 1200)
    } catch (err: unknown) {
      setError((err as Error).message || '注册失败，请重试')
      setRegisterStep(regPassword ? 2 : 0)
    } finally {
      setLoading(false)
    }
  }

  const handleQQBind = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    if (!bindAccount.trim() || !bindName.trim() || !bindPassword) {
      setError('请填写学号/邮箱、真实姓名和账号密码')
      return
    }

    setLoading(true)
    try {
      await bindQQMember(bindTicket, bindAccount.trim(), bindName.trim(), bindPassword)
      setSuccessTitle('QQ 绑定成功')
      setSuccessMessage('QQ 绑定成功，正在进入成员门户')
      window.setTimeout(() => {
        window.location.href = '/member/dashboard'
      }, 1200)
    } catch (err: unknown) {
      setError((err as Error).message || 'QQ 绑定失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const handleQQLogin = () => {
    setError('')
    if (qqChecking) return
    if (!qqEnabled) {
      setError('QQ 登录尚未配置，请联系站点管理员完成 QQ 互联设置')
      return
    }
    startQQLogin()
  }

  const title = mode === 'login'
    ? '欢迎回来'
    : mode === 'bind'
      ? '绑定 QQ 登录'
      : stepCopy[registerStep].title

  const subtitle = mode === 'login'
    ? '继续你的创作旅程'
    : mode === 'bind'
      ? `验证成员身份后即可使用 QQ 登录${qqNickname ? `（${qqNickname}）` : ''}`
      : stepCopy[registerStep].subtitle

  return (
    <div className="auth-shell relative min-h-screen overflow-hidden text-[#051A24]">
      <header className="relative z-20 flex items-center justify-between px-5 py-5 sm:px-8">
        <a href="/" className="flex items-center gap-3">
          <Logo size="md" />
          <span className="font-ticket-cn text-lg tracking-[0.06em]">星雨作坊</span>
        </a>
        <a
          href="/"
          className="inline-flex items-center gap-1.5 rounded-full border border-[#0D212C]/10 bg-white/55 px-3 py-1.5 text-xs text-[#273C46]/65 transition-colors hover:border-[#0D212C]/20 hover:bg-white/80 hover:text-[#051A24]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          返回首页
        </a>
      </header>

      <main className="relative z-10 flex min-h-[calc(100vh-84px)] items-center justify-center px-4 pb-12 pt-4">
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.55, ease: [0.2, 0.75, 0.25, 1] }}
          className="w-full max-w-[430px]"
        >
          <div className="auth-glass-card rounded-[34px] p-6 sm:p-8">
            <div className="mb-7 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Logo size="lg" />
                <div>
                  <p className="font-ticket-cn text-lg leading-none tracking-[0.06em]">星雨作坊</p>
                  <p className="mt-1.5 font-mono text-[8px] uppercase tracking-[0.24em] text-[#273C46]/38">
                    XINGYU STUDIO
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full border border-[#0D212C]/10 bg-white/45 px-2.5 py-1 font-mono text-[8px] uppercase tracking-[0.14em] text-[#273C46]/50">
                <ShieldCheck className="h-3 w-3" />
                Secure
              </span>
            </div>

            {mode !== 'bind' && (
              <div className="mb-7 flex rounded-full border border-[#0D212C]/9 bg-[#0D212C]/[0.045] p-1">
                {(['login', 'register'] as const).map(item => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => switchMode(item)}
                    className={`flex-1 rounded-full py-2 text-xs transition-all ${
                      mode === item
                        ? 'bg-white text-[#051A24] shadow-md'
                        : 'text-[#273C46]/55 hover:text-[#051A24]'
                    }`}
                  >
                    {item === 'login' ? '登录' : '注册'}
                  </button>
                ))}
              </div>
            )}

            <AnimatePresence mode="wait">
              <motion.div
                key={`${mode}-${mode === 'register' ? registerStep : 0}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="text-center"
              >
                <h1 className="font-ticket-cn text-[34px] leading-tight tracking-[0.035em] sm:text-[40px]">
                  {title}
                </h1>
                <p className="mx-auto mt-3 max-w-[320px] text-sm leading-relaxed text-[#273C46]/58">
                  {subtitle}
                </p>
              </motion.div>
            </AnimatePresence>

            {mode === 'register' && (
              <div className="mt-5 flex justify-center gap-2">
                {[0, 1, 2].map(step => (
                  <span
                    key={step}
                    className={`h-1 rounded-full transition-all duration-300 ${
                      step === registerStep ? 'w-8 bg-[#3457ff]' : 'w-4 bg-[#0D212C]/15'
                    }`}
                  />
                ))}
              </div>
            )}

            {mode !== 'bind' && (
              <div className="mt-7">
                <LiquidGlassButton
                  type="button"
                  onClick={handleQQLogin}
                  disabled={loading || qqChecking}
                  size="sm"
                  fullWidth
                  contentClassName="flex w-full items-center gap-3 px-4 py-2 text-left text-sm font-medium"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#12B7F5] text-white shadow-lg shadow-[#12B7F5]/20">
                    {qqChecking
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <span className="text-[11px] font-black tracking-[-0.08em]">QQ</span>}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">QQ 登录</span>
                    <span className="mt-0.5 block text-[10px] text-[#273C46]/45">
                      {qqChecking ? '正在检查配置' : qqEnabled ? '使用 QQ 互联安全登录' : '等待管理员配置 QQ 互联'}
                    </span>
                  </span>
                  <ArrowRight className="h-4 w-4 text-[#273C46]/35" />
                </LiquidGlassButton>

                <div className="my-5 flex items-center gap-3">
                  <span className="h-px flex-1 bg-[#0D212C]/10" />
                  <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#273C46]/32">
                    or account
                  </span>
                  <span className="h-px flex-1 bg-[#0D212C]/10" />
                </div>
              </div>
            )}

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 flex items-start gap-2 rounded-2xl border border-red-500/15 bg-red-50 px-4 py-3 text-xs leading-relaxed text-red-700"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}

            {mode === 'login' && (
              <form onSubmit={handleLogin} className="space-y-3.5">
                <GlassInput
                  icon={<Mail className="h-4 w-4" />}
                  value={account}
                  onChange={event => { setAccount(event.target.value); clearError() }}
                  placeholder="管理员用户名 / 学号 / 邮箱"
                  autoComplete="username"
                />
                <GlassInput
                  icon={<Lock className="h-4 w-4" />}
                  value={password}
                  onChange={event => { setPassword(event.target.value); clearError() }}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="密码"
                  autoComplete="current-password"
                  trailing={
                    <VisibilityButton
                      visible={showPassword}
                      onClick={() => setShowPassword(current => !current)}
                    />
                  }
                />
                <PrimaryButton loading={loading} label="登录" />
                <p className="pt-1 text-center text-[10px] leading-relaxed text-[#273C46]/38">
                  管理端使用用户名登录 · 成员使用学号或邮箱登录
                </p>
              </form>
            )}

            {mode === 'register' && (
              <form onSubmit={handleRegister} className="space-y-3.5">
                {registerStep === 0 && (
                  <>
                    <GlassInput
                      icon={<Mail className="h-4 w-4" />}
                      value={regAccount}
                      onChange={event => { setRegAccount(event.target.value); clearError() }}
                      placeholder="学号或邮箱"
                      autoComplete="username"
                    />
                    <GlassInput
                      icon={<User className="h-4 w-4" />}
                      value={regName}
                      onChange={event => { setRegName(event.target.value); clearError() }}
                      placeholder="真实姓名"
                      autoComplete="name"
                    />
                  </>
                )}
                {registerStep === 1 && (
                  <GlassInput
                    icon={<Lock className="h-4 w-4" />}
                    value={regPassword}
                    onChange={event => { setRegPassword(event.target.value); clearError() }}
                    type="password"
                    placeholder="设置密码（至少 6 个字符）"
                    autoComplete="new-password"
                  />
                )}
                {registerStep === 2 && (
                  <GlassInput
                    icon={<Lock className="h-4 w-4" />}
                    value={regConfirm}
                    onChange={event => { setRegConfirm(event.target.value); clearError() }}
                    type="password"
                    placeholder="再次输入密码"
                    autoComplete="new-password"
                  />
                )}

                <PrimaryButton
                  loading={loading}
                  label={registerStep === 2 ? '完成注册' : '继续'}
                />

                {registerStep > 0 && (
                  <button
                    type="button"
                    onClick={() => { setRegisterStep((registerStep - 1) as RegisterStep); clearError() }}
                    className="mx-auto flex items-center gap-1.5 text-xs text-[#273C46]/50 transition-colors hover:text-[#051A24]"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    返回上一步
                  </button>
                )}
              </form>
            )}

            {mode === 'bind' && (
              <form onSubmit={handleQQBind} className="space-y-3.5">
                <div className="mb-4 flex items-center gap-3 rounded-2xl border border-[#12B7F5]/25 bg-[#12B7F5]/10 px-4 py-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#12B7F5] text-white">
                    <span className="text-[11px] font-black tracking-[-0.08em]">QQ</span>
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-[#051A24]">{qqNickname || 'QQ 用户'}</p>
                    <p className="mt-0.5 text-[10px] leading-relaxed text-[#273C46]/50">
                      首次登录需绑定管理员已录入的成员身份
                    </p>
                  </div>
                </div>
                <GlassInput
                  icon={<Mail className="h-4 w-4" />}
                  value={bindAccount}
                  onChange={event => { setBindAccount(event.target.value); clearError() }}
                  placeholder="学号或邮箱"
                  autoComplete="username"
                />
                <GlassInput
                  icon={<User className="h-4 w-4" />}
                  value={bindName}
                  onChange={event => { setBindName(event.target.value); clearError() }}
                  placeholder="真实姓名"
                  autoComplete="name"
                />
                <GlassInput
                  icon={<Lock className="h-4 w-4" />}
                  value={bindPassword}
                  onChange={event => { setBindPassword(event.target.value); clearError() }}
                  type={showBindPassword ? 'text' : 'password'}
                  placeholder="账号密码 / 首次激活请设置密码"
                  autoComplete="current-password"
                  trailing={
                    <VisibilityButton
                      visible={showBindPassword}
                      onClick={() => setShowBindPassword(current => !current)}
                    />
                  }
                />
                <PrimaryButton loading={loading} label="绑定并登录" />
                <button
                  type="button"
                  onClick={() => {
                    setBindTicket('')
                    setMode('login')
                    setError('')
                  }}
                  className="mx-auto flex items-center gap-1.5 text-xs text-[#273C46]/50 transition-colors hover:text-[#051A24]"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  返回普通登录
                </button>
              </form>
            )}
          </div>

          <p className="mt-5 flex items-center justify-center gap-1.5 text-center text-[10px] text-[#273C46]/32">
            <Sparkles className="h-3 w-3" />
            安全登录 · 账号仅用于星雨作坊成员门户
          </p>
        </motion.div>
      </main>

      <AnimatePresence>
        {successMessage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-[#efe9df]/75 px-4 backdrop-blur-md"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="auth-glass-card relative w-full max-w-sm overflow-hidden rounded-[30px] px-8 py-12 text-center"
            >
              {confettiColors.map((color, index) => (
                <span
                  key={`${color}-${index}`}
                  className="auth-confetti"
                  style={{
                    left: `${10 + ((index * 17) % 80)}%`,
                    background: color,
                    animationDelay: `${(index % 6) * 0.07}s`,
                    '--drift': `${index % 2 === 0 ? 18 : -18}px`,
                  } as CSSProperties}
                />
              ))}
              <div className="relative">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-[#051A24] shadow-xl">
                  <PartyPopper className="h-7 w-7" />
                </div>
                <h2 className="font-ticket-cn mt-6 text-3xl tracking-[0.04em]">{successTitle}</h2>
                <p className="mt-3 text-sm text-[#273C46]/60">{successMessage}</p>
                <div className="mt-6 flex items-center justify-center gap-2 text-xs text-[#3457ff]">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  正在跳转
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function GlassInput({
  icon,
  trailing,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  icon: ReactNode
  trailing?: ReactNode
}) {
  const { className = '', ...inputProps } = props
  return (
    <label className="glass-input-wrap block w-full">
      <div className="glass-input">
        <span className="glass-input-text-area" aria-hidden="true" />
        <span className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center text-[#273C46]/55">
          {icon}
        </span>
        <input
          {...inputProps}
          className={`relative z-10 h-full min-w-0 flex-1 bg-transparent text-sm text-[#051A24] placeholder:text-[#273C46]/60 focus:outline-none ${className}`}
        />
        {trailing && <span className="relative z-10 flex shrink-0 items-center pr-1">{trailing}</span>}
      </div>
    </label>
  )
}

function LiquidGlassButton({
  children,
  size = 'primary',
  fullWidth = false,
  contentClassName = '',
  className = '',
  onClick,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  size?: 'sm' | 'primary'
  fullWidth?: boolean
  contentClassName?: string
}) {
  const handleWrapperClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    const button = event.currentTarget.querySelector('button')
    if (button && !button.contains(event.target as Node) && !button.disabled) {
      button.click()
    }
  }

  return (
    <div
      className={`glass-button-wrap cursor-pointer relative rounded-full ${fullWidth ? 'w-full' : ''}`}
      onClick={handleWrapperClick}
    >
      <button
        {...props}
        onClick={onClick}
        className={`glass-button ${size === 'sm' ? 'auth-glass-button-sm' : 'auth-glass-button-primary'} ${
          fullWidth ? 'auth-glass-button-full' : ''
        } ${className}`.trim()}
      >
        <span className={`glass-button-text ${contentClassName}`}>{children}</span>
      </button>
      <div className="glass-button-shadow rounded-full pointer-events-none" />
    </div>
  )
}

function VisibilityButton({ visible, onClick }: { visible: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={visible ? '隐藏密码' : '显示密码'}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#273C46]/38 transition-colors hover:bg-[#0D212C]/[0.06] hover:text-[#051A24]"
    >
      {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </button>
  )
}

function PrimaryButton({ loading, label }: { loading: boolean; label: string }) {
  return (
    <div className="mt-2">
      <LiquidGlassButton
        type="submit"
        disabled={loading}
        fullWidth
        contentClassName="flex items-center justify-center gap-2 px-6 py-3.5 text-base font-medium"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
        {loading ? '处理中...' : label}
        {!loading && <ArrowRight className="h-4 w-4" />}
      </LiquidGlassButton>
    </div>
  )
}
