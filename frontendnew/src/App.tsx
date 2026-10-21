import { useState, useEffect } from 'react'
import Navbar from './components/layout/Navbar'
import Footer from './components/layout/Footer'
import SideDecor from './components/effects/SideDecor'
import ThemeSwitcher from './components/effects/ThemeSwitcher'
import { fetchSiteConfig } from './services/api'
import HomePage from './components/pages/HomePage'
import AboutPage from './components/pages/AboutPage'
import MembersPage from './components/pages/MembersPage'
import ProjectsPage from './components/pages/ProjectsPage'
import ProjectDetailPage from './components/pages/ProjectDetailPage'
import AwardsPage from './components/pages/AwardsPage'
import AwardDetailPage from './components/pages/AwardDetailPage'
import BlogPage from './components/pages/BlogPage'
import BlogDetailPage from './components/pages/BlogDetailPage'
import ResearchPage from './components/pages/ResearchPage'
import CooperationPage from './components/pages/CooperationPage'
import ContactPage from './components/pages/ContactPage'
import OpenSourcePage from './components/pages/OpenSourcePage'
import JoinPage from './components/pages/JoinPage'
import RecruitmentPage from './components/pages/RecruitmentPage'
import TimelinePage from './components/pages/TimelinePage'
import OnboardingPage from './components/pages/OnboardingPage'
import YujiPage from './components/pages/YujiPage'
import AdminDashboard from './components/admin/AdminDashboard'
import AdminMembers from './components/admin/AdminMembers'
import AdminProjects from './components/admin/AdminProjects'
import AdminProjectDetail from './components/admin/AdminProjectDetail'
import AdminAwards from './components/admin/AdminAwards'
import AdminBlogs from './components/admin/AdminBlogs'
import AdminPages from './components/admin/AdminPages'
import AdminConfig from './components/admin/AdminConfig'
import AdminApplications from './components/admin/AdminApplications'
import AdminContacts from './components/admin/AdminContacts'
import AdminCertificates from './components/admin/AdminCertificates'
import AdminWeeklyReports from './components/admin/AdminWeeklyReports'
import AdminNotifications from './components/admin/AdminNotifications'
import AdminPermissions from './components/admin/AdminPermissions'
import TeacherDashboard from './components/admin/TeacherDashboard'
import AdminData from './components/admin/AdminData'
import { ToastProvider } from './components/admin/Toast'
import MemberDashboard from './components/member/MemberDashboard'
import MemberDirectory from './components/member/MemberDirectory'
import MemberProfilePage from './components/member/MemberProfile'
import MemberProjects from './components/member/MemberProjects'
import ProjectKanban from './components/member/ProjectKanban'
import MemberTasks from './components/member/MemberTasks'
import ResourceCenter from './components/member/ResourceCenter'
import CertificateManager from './components/member/CertificateManager'
import NotificationCenter from './components/member/NotificationCenter'
import AssistantChat from './components/member/AssistantChat'
import { useMemberAuth } from './hooks/useMemberAuth'
import LoginPage from './components/pages/LoginPage'
import { getRole } from './services/api'

/* ═══════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════ */

function parsePath(path: string) {
  const clean = path.replace(/^\/+|\/+$/g, '') || ''
  return clean.split('/')
}

/* ═══════════════════════════════════════════════════════════════
   Public App Content
   ═══════════════════════════════════════════════════════════════ */

function AppContent({ path }: { path: string }) {
  const parts = parsePath(path)

  if (parts[0] === '') {
    return <HomePage />
  }

  switch (parts[0]) {
    case 'about':       return <AboutPage />
    case 'members':     return <MembersPage />
    case 'projects':    return <ProjectsPage />
    case 'project':     return <ProjectDetailPage slug={parts[1] || ''} />
    case 'awards':      return <AwardsPage />
    case 'award':       return <AwardDetailPage slug={parts[1] || ''} />
    case 'blog':        return parts[1] ? <BlogDetailPage slug={parts[1]} /> : <BlogPage />
    case 'research':    return <ResearchPage />
    case 'cooperation': return <CooperationPage />
    case 'contact':     return <ContactPage />
    case 'open-source': return <OpenSourcePage />
    case 'join':        return <JoinPage />
    case 'recruitment': return <RecruitmentPage />
    case 'timeline':    return <TimelinePage />
    case 'onboarding':  return <OnboardingPage />
    case 'yuji':        return <YujiPage />
    case 'login':       return <LoginPage />
    case 'admin':
      return <ToastProvider><AdminRouter parts={parts} /></ToastProvider>
    case 'member':
      return <ToastProvider><MemberRouter parts={parts} /></ToastProvider>
    default:
      return <NotFound />
  }
}

function NotFound() {
  return (
    <div className="page-enter min-h-[60vh] flex flex-col items-center justify-center text-center px-6 relative z-20">
      <h1 className="text-4xl font-mondwest text-[#051A24]">404</h1>
      <p className="text-[#273C46] mt-4">页面未找到</p>
      <a href="/" className="btn-tertiary mt-6 inline-flex">← 返回首页</a>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   Admin Router
   ═══════════════════════════════════════════════════════════════ */

function AdminRouter({ parts }: { parts: string[] }) {
  if (parts[1] === 'login') { window.location.href = '/login'; return null }
  if (getRole() === 'teacher' && (parts[1] === undefined || parts[1] === '')) {
    window.location.href = '/admin/teacher'
    return null
  }
  switch (parts[1]) {
    case undefined: case '':        return <AdminDashboard />
    case 'members':                 return <AdminMembers />
    case 'projects':                return parts[2]
      ? <AdminProjectDetail projectId={parseInt(parts[2]) || 0} />
      : <AdminProjects />
    case 'awards':                  return <AdminAwards />
    case 'blogs':                   return <AdminBlogs />
    case 'pages':                   return <AdminPages />
    case 'config':                  return <AdminConfig />
    case 'applications':            return <AdminApplications />
    case 'contacts':                return <AdminContacts />
    case 'certificates':            return <AdminCertificates />
    case 'weekly-reports':          return <AdminWeeklyReports />
    case 'notifications':           return <AdminNotifications />
    case 'permissions':             return <AdminPermissions />
    case 'teacher':                 return <TeacherDashboard />
    case 'data':                    return <AdminData />
    default:                        return <AdminDashboard />
  }
}

/* ═══════════════════════════════════════════════════════════════
   Member Router
   ═══════════════════════════════════════════════════════════════ */

function MemberRouter({ parts }: { parts: string[] }) {
  const { loading, member, setMember } = useMemberAuth()

  if (parts[1] === 'login') {
    if (member) { window.location.href = '/member/dashboard'; return null }
    window.location.href = '/login'
    return null
  }

  if (loading) return <MemberLoadingScreen />
  if (!member) return <MemberLoginRedirect />

  const page = parts[1]

  if (page === undefined || page === '' || page === 'dashboard')
    return <MemberDashboard member={member} />
  if (page === 'directory')
    return <MemberDirectory member={member} />
  if (page === 'profile')
    return <MemberProfilePage member={member} onUpdate={setMember} />
  if (page === 'projects')
    return parts[2]
      ? <ProjectKanban key={parts[2]} member={member} projectId={parseInt(parts[2]) || 0} />
      : <MemberProjects member={member} />
  if (page === 'tasks')
    return <MemberTasks member={member} />
  if (page === 'resources')
    return <ResourceCenter member={member} />
  if (page === 'certificates')
    return <CertificateManager member={member} />
  if (page === 'notifications')
    return <NotificationCenter member={member} />
  if (page === 'assistant')
    return <AssistantChat member={member} />

  return <MemberDashboard member={member} />
}

function MemberLoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f7f5]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-2xl bg-[#051A24] flex items-center justify-center shadow-lg animate-float">
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
        </div>
        <div className="flex gap-1">
          {[0, 1, 2].map(i => (
            <div key={i} className="w-2 h-2 rounded-full bg-[#051A24]/20 animate-bounce" style={{ animationDelay: `${i * 0.1}s` }} />
          ))}
        </div>
      </div>
    </div>
  )
}

function MemberLoginRedirect() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f7f5]">
      <div className="text-center animate-fade-in-up">
        <div className="mx-auto">
          <svg className="w-12 h-12 text-[#051A24]/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>
        </div>
        <h1 className="text-2xl font-medium text-[#051A24] mt-6 tracking-tight"
          style={{ fontFamily: "var(--font-sans)", fontWeight: 500 }}>
          成员门户
        </h1>
        <p className="text-sm text-[#273C46]/60 mt-2">请先登录以访问成员功能</p>
        <a href="/member/login" className="btn-primary inline-flex mt-8">前往登录</a>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   App Root
   ═══════════════════════════════════════════════════════════════ */

const DEFAULT_VIDEO = '/hero-bg.mp4'
const VIDEO_MEDIA_QUERY = '(min-width: 768px) and (prefers-reduced-motion: no-preference)'

function canPlayBackgroundVideo() {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
  return window.matchMedia(VIDEO_MEDIA_QUERY).matches && !connection?.saveData
}

export default function App() {
  const [path, setPath] = useState(window.location.pathname)
  const [videoUrl, setVideoUrl] = useState(DEFAULT_VIDEO)
  const [playVideo, setPlayVideo] = useState(canPlayBackgroundVideo)

  useEffect(() => {
    const media = window.matchMedia(VIDEO_MEDIA_QUERY)
    const update = () => setPlayVideo(canPlayBackgroundVideo())
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  // Load custom video background URL
  useEffect(() => {
    fetchSiteConfig()
      .then(cfg => {
        const url = (cfg.hero as Record<string, unknown>)?.video_url as string
        if (url) setVideoUrl(current => current === url ? current : url)
      })
      .catch(() => {})
  }, [])

  // SPA routing: intercept <a> clicks + popstate
  useEffect(() => {
    const onPopState = () => setPath(window.location.pathname)
    window.addEventListener('popstate', onPopState)

    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const anchor = target.closest('a')
      if (!anchor || !anchor.href) return
      if (anchor.target) return
      if (anchor.hasAttribute('download')) return
      if (!anchor.href.startsWith(window.location.origin)) return

      e.preventDefault()
      let newPath = '/'
      let search = ''
      try {
        const url = new URL(anchor.href)
        newPath = url.pathname
        search = url.search
      } catch { return }
      window.history.pushState({}, '', newPath + search)
      setPath(newPath)
      window.scrollTo(0, 0)
    }
    document.addEventListener('click', onClick)

    return () => {
      window.removeEventListener('popstate', onPopState)
      document.removeEventListener('click', onClick)
    }
  }, [])

  const isAdmin = path.startsWith('/admin') || path.startsWith('/member') || path === '/login'

  if (isAdmin) {
    return (
      <div className="min-h-screen relative">
        <AppContent path={path} />
      </div>
    )
  }

  return (
    <div className="min-h-screen relative">
      {/* Video background (z-0) */}
      <div className="fixed inset-0 bg-gradient-to-br from-[#e8e4dc] to-[#f5f2ed] z-0" />
      <div className="fixed inset-0 bg-cover bg-center z-0" style={{ backgroundImage: "url('/hero-poster.webp')" }} />
      {playVideo && (
        <video key={videoUrl} autoPlay loop muted playsInline preload="metadata" className="fixed inset-0 w-full h-full object-cover z-0">
          <source src={videoUrl} type="video/mp4" />
        </video>
      )}

      {/* Overlay (z-10) */}
      <div className="fixed inset-0 bg-white/35 dark:bg-black/55 z-10 pointer-events-none" />

      {/* Content (z-20) */}
      <div className="relative z-20">
        <SideDecor />
        <ThemeSwitcher />
        <Navbar />
        <AppContent path={path} />
        <Footer />
      </div>
    </div>
  )
}
