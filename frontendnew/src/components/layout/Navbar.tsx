import { useState, useEffect, useRef, createContext, useContext } from 'react'
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  AnimatePresence,
  type SpringOptions,
  type MotionValue,
} from 'framer-motion'
import { Menu, X, Home, Users, FolderGit2, Trophy, PenTool, UserPlus, Clock, BookOpen, Cloud, LogIn, FlaskConical, Handshake, Mail, Moon, Sun } from 'lucide-react'
import GithubIcon from '../ui/GithubIcon'
import Logo from '../ui/Logo'
import { setDarkMode, useDarkMode } from '../../lib/theme'

// ===== Nav links =====
const navItems = [
  { label: '首页', href: '/', Icon: Home },
  { label: '成员', href: '/members', Icon: Users },
  { label: '项目', href: '/projects', Icon: FolderGit2 },
  { label: '奖项', href: '/awards', Icon: Trophy },
  { label: '博客', href: '/blog', Icon: PenTool },
  { label: '开源', href: '/open-source', Icon: GithubIcon },
  { label: '研究', href: '/research', Icon: FlaskConical },
  { label: '合作', href: '/cooperation', Icon: Handshake },
  { label: '加入', href: '/join', Icon: UserPlus },
  { label: '时间线', href: '/timeline', Icon: Clock },
  { label: '入门', href: '/onboarding', Icon: BookOpen },
  { label: '雨记', href: '/yuji', Icon: Cloud },
  { label: '联系', href: '/contact', Icon: Mail },
  { label: '登录', href: '/login', Icon: LogIn },
]

// ===== Dock constants =====
const MAG = 64
const DIST = 120
const PANEL_H = 52
const SPRING: SpringOptions = { mass: 0.1, stiffness: 150, damping: 12 }

// ===== Dock context =====
type DockCtx = { mouseX: MotionValue<number>; spring: SpringOptions; magnification: number; distance: number }
const DockContext = createContext<DockCtx | undefined>(undefined)
const useDock = () => useContext(DockContext)!

// ===== Sub-components =====
function DockLabel({ children, isHovered }: { children: React.ReactNode; isHovered: MotionValue<number> }) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const unsub = isHovered.on('change', (v: number) => setVisible(v === 1))
    return () => unsub()
  }, [isHovered])
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 0 }} animate={{ opacity: 1, y: -6 }} exit={{ opacity: 0, y: 0 }}
          transition={{ duration: 0.15 }}
          className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-[#051A24] px-2 py-0.5 text-[10px] text-white font-medium pointer-events-none"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ===== Main Navbar =====
export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const darkMode = useDarkMode()
  const [navOpacity, setNavOpacity] = useState(0)
  const [isAtTop, setIsAtTop] = useState(true)

  useEffect(() => {
    const onScroll = () => {
      const heroH = window.innerHeight
      const progress = Math.min(window.scrollY / heroH, 1)
      setNavOpacity(progress)
      setIsAtTop(window.scrollY < 10)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!mobileOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false)
    }
    const onResize = () => {
      if (window.innerWidth >= 1024) setMobileOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('resize', onResize)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('resize', onResize)
    }
  }, [mobileOpen])

  const toggleDarkMode = () => {
    setDarkMode(!darkMode)
  }

  // Dock state
  const mouseX = useMotionValue(Infinity)
  const isHovered = useMotionValue(0)
  const maxH = MAG + MAG / 2 + 4

  const bgOpacity = isAtTop ? 0 : Math.min(navOpacity * 0.15, 0.15)
  const hasShadow = navOpacity > 0.5

  return (
    <nav
      className="sticky top-0 z-50 transition-shadow duration-300"
      style={{
        background: `color-mix(in srgb, var(--theme-nav) ${Math.round(bgOpacity * 100)}%, transparent)`,
        backdropFilter: 'blur(24px) saturate(1.8)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.8)',
        boxShadow: hasShadow
          ? '0 2px 16px rgba(0,0,0,0.08)'
          : 'none',
      }}
    >
      <div className="flex h-16 lg:h-[100px] items-center justify-center px-4 lg:px-6 max-w-[1400px] mx-auto relative overflow-visible">
        {/* Desktop dock — logo integrated as first item */}
        <div className="hidden lg:flex items-center gap-4">
          {/* Brand — clickable home */}
          <a href="/" data-logo className="flex items-center gap-2 shrink-0 mr-2" style={{ height: PANEL_H }}>
            <Logo size="md" className="hover:scale-105 transition-transform" />
            <span className="font-display text-[15px] text-[#051A24] tracking-[0.04em]">
              星雨作坊
            </span>
          </a>
          {/* Divider */}
          <div className="w-px h-6 bg-[rgba(0,0,0,0.08)] mx-1 shrink-0" />
          <div style={{ height: maxH }} className="flex items-center overflow-visible">
            <motion.div
              onMouseMove={({ pageX }) => { isHovered.set(1); mouseX.set(pageX) }}
              onMouseLeave={() => { isHovered.set(0); mouseX.set(Infinity) }}
              className="mx-auto flex items-center gap-3 rounded-2xl px-3"
              style={{ height: PANEL_H }}
              role="toolbar"
            >
              <DockContext.Provider value={{ mouseX, spring: SPRING, distance: DIST, magnification: MAG }}>
                {navItems.map((item) => (
                  <DockItem key={item.href} href={item.href} Icon={item.Icon} label={item.label} />
                ))}
              </DockContext.Provider>
            </motion.div>
          </div>
        </div>

        {/* Mobile: logo + burger */}
        <div className="lg:hidden flex items-center justify-between w-full">
          <a href="/" className="flex items-center gap-2">
            <Logo size="sm" />
            <span className="font-display text-sm text-[#051A24] tracking-[0.04em]">星雨作坊</span>
          </a>
          <button
            type="button"
            className="flex h-11 w-11 items-center justify-center rounded-xl text-[#051A24]"
            onClick={() => {
              setMobileOpen(!mobileOpen)
            }}
            aria-label={mobileOpen ? '关闭菜单' : '打开菜单'}
            aria-expanded={mobileOpen}
            aria-controls="mobile-site-menu"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div
          id="mobile-site-menu"
          className="lg:hidden absolute inset-x-0 top-full max-h-[calc(100dvh-4rem)] overflow-y-auto overscroll-contain border-t border-black/5 bg-white/95 shadow-lg backdrop-blur-xl dark:border-white/10 dark:bg-[#111820]/95"
        >
          <div className="flex flex-col max-w-[1400px] mx-auto px-4 py-3">
            {navItems.map(({ label, href, Icon }) => (
              <a key={href} href={href} className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-[#273C46] hover:bg-black/5 hover:text-[#051A24] transition-colors"
                onClick={() => setMobileOpen(false)}>
                <Icon className="w-4 h-4" strokeWidth={1.5} />
                {label}
              </a>
            ))}
            <button
              type="button"
              onClick={toggleDarkMode}
              aria-pressed={darkMode}
              className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-left text-sm font-medium text-[#273C46] hover:bg-black/5 hover:text-[#051A24] transition-colors"
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              {darkMode ? '切换浅色模式' : '切换深色模式'}
            </button>
          </div>
        </div>
      )}
    </nav>
  )
}

// ===== Dock item =====
function DockItem({ href, Icon, label }: { href: string; Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; label: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const { distance, magnification, mouseX, spring } = useDock()
  const isHoveredMv = useMotionValue(0)

  const mouseDistance = useTransform(mouseX, (val) => {
    const rect = ref.current?.getBoundingClientRect() ?? { x: 0, width: 0 }
    return val - rect.x - rect.width / 2
  })

  const widthTransform = useTransform(mouseDistance, [-distance, 0, distance], [40, magnification, 40])
  const width = useSpring(widthTransform, spring)
  const iconSize = useTransform(width, (v) => v * 0.45)

  return (
    <motion.div
      ref={ref}
      style={{ width }}
      onHoverStart={() => isHoveredMv.set(1)}
      onHoverEnd={() => isHoveredMv.set(0)}
      onFocusCapture={() => isHoveredMv.set(1)}
      onBlurCapture={() => isHoveredMv.set(0)}
      className="relative inline-flex items-center justify-center cursor-pointer"
    >
      <a href={href} aria-label={label} className="flex items-center justify-center w-full h-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3457ff]">
        <DockLabel isHovered={isHoveredMv}>{label}</DockLabel>
        <motion.div style={{ width: iconSize, height: iconSize }} className="flex items-center justify-center">
          <Icon className="w-full h-full text-[#051A24]/70" strokeWidth={1.5} />
        </motion.div>
      </a>
    </motion.div>
  )
}
