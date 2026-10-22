import { lazy, Suspense, useState, useEffect } from 'react'
import Navbar from './components/layout/Navbar'
import Footer from './components/layout/Footer'
import SideDecor from './components/effects/SideDecor'
import BackgroundVideo from './components/effects/BackgroundVideo'
import ThemeSwitcher from './components/effects/ThemeSwitcher'
import { useSiteData } from './store/useSiteData'
import { SiteDataNotice } from './components/ui/DataState'
import { useClientNavigation } from './hooks/useClientNavigation'
import { ToastProvider } from './components/admin/Toast'
import { useMemberAuth } from './hooks/useMemberAuth'
import { getRole } from './services/api'
import { useRouteMetadata } from './hooks/useMetadata'
const HomePage = lazy(() => import('./components/pages/HomePage'))
const AboutPage = lazy(() => import('./components/pages/AboutPage'))
const MembersPage = lazy(() => import('./components/pages/MembersPage'))
const ProjectsPage = lazy(() => import('./components/pages/ProjectsPage'))
const ProjectDetailPage = lazy(() => import('./components/pages/ProjectDetailPage'))
const AwardsPage = lazy(() => import('./components/pages/AwardsPage'))
const AwardDetailPage = lazy(() => import('./components/pages/AwardDetailPage'))
const BlogPage = lazy(() => import('./components/pages/BlogPage'))
const BlogDetailPage = lazy(() => import('./components/pages/BlogDetailPage'))
const ResearchPage = lazy(() => import('./components/pages/ResearchPage'))
const CooperationPage = lazy(() => import('./components/pages/CooperationPage'))
const ContactPage = lazy(() => import('./components/pages/ContactPage'))
const OpenSourcePage = lazy(() => import('./components/pages/OpenSourcePage'))
const JoinPage = lazy(() => import('./components/pages/JoinPage'))
const RecruitmentPage = lazy(() => import('./components/pages/RecruitmentPage'))
const TimelinePage = lazy(() => import('./components/pages/TimelinePage'))
const OnboardingPage = lazy(() => import('./components/pages/OnboardingPage'))
const YujiPage = lazy(() => import('./components/pages/YujiPage'))
const AdminDashboard = lazy(() => import('./components/admin/AdminDashboard'))
const AdminMembers = lazy(() => import('./components/admin/AdminMembers'))
const AdminProjects = lazy(() => import('./components/admin/AdminProjects'))
const AdminProjectDetail = lazy(() => import('./components/admin/AdminProjectDetail'))
const AdminAwards = lazy(() => import('./components/admin/AdminAwards'))
const AdminBlogs = lazy(() => import('./components/admin/AdminBlogs'))
const AdminPages = lazy(() => import('./components/admin/AdminPages'))
const AdminConfig = lazy(() => import('./components/admin/AdminConfig'))
const AdminApplications = lazy(() => import('./components/admin/AdminApplications'))
const AdminContacts = lazy(() => import('./components/admin/AdminContacts'))
const AdminCertificates = lazy(() => import('./components/admin/AdminCertificates'))
const AdminWeeklyReports = lazy(() => import('./components/admin/AdminWeeklyReports'))
const AdminNotifications = lazy(() => import('./components/admin/AdminNotifications'))
const AdminPermissions = lazy(() => import('./components/admin/AdminPermissions'))
const TeacherDashboard = lazy(() => import('./components/admin/TeacherDashboard'))
const AdminData = lazy(() => import('./components/admin/AdminData'))
const MemberDashboard = lazy(() => import('./components/member/MemberDashboard'))
const MemberDirectory = lazy(() => import('./components/member/MemberDirectory'))
const MemberProfilePage = lazy(() => import('./components/member/MemberProfile'))
const MemberProjects = lazy(() => import('./components/member/MemberProjects'))
const ProjectKanban = lazy(() => import('./components/member/ProjectKanban'))
const MemberTasks = lazy(() => import('./components/member/MemberTasks'))
const ResourceCenter = lazy(() => import('./components/member/ResourceCenter'))
const CertificateManager = lazy(() => import('./components/member/CertificateManager'))
const NotificationCenter = lazy(() => import('./components/member/NotificationCenter'))
const AssistantChat = lazy(() => import('./components/member/AssistantChat'))
const LoginPage = lazy(() => import('./components/pages/LoginPage'))

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

  if ((parts.length > 1 && !['project', 'award', 'blog', 'admin', 'member'].includes(parts[0])) ||
    (parts.length > 2 && ['project', 'award', 'blog'].includes(parts[0]))) return <NotFound />

  if (parts[0] === '') {
    return <HomePage />
  }

  switch (parts[0]) {
    case 'about':       return <AboutPage />
    case 'members':     return <MembersPage />
    case 'projects':    return <ProjectsPage />
    case 'project':     return <ProjectDetailPage key={parts[1]} slug={parts[1] || ''} />
    case 'awards':      return <AwardsPage />
    case 'award':       return <AwardDetailPage key={parts[1]} slug={parts[1] || ''} />
    case 'blog':        return parts[1] ? <BlogDetailPage key={parts[1]} slug={parts[1]} /> : <BlogPage />
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

function PageLoading() {
  return <div className="min-h-[60vh] flex items-center justify-center text-sm text-[var(--theme-text)]" role="status">正在加载页面…</div>
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
  const location = useClientNavigation()
  const path = location.pathname
  const { config, loaded, status } = useSiteData(['config'])
  useRouteMetadata(path, config)
  const videoUrl = config.heroVideoUrl || DEFAULT_VIDEO
  const [playVideo, setPlayVideo] = useState(canPlayBackgroundVideo)

  useEffect(() => {
    const media = window.matchMedia(VIDEO_MEDIA_QUERY)
    const update = () => setPlayVideo(canPlayBackgroundVideo())
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  const isAdmin = path === '/admin' || path.startsWith('/admin/') ||
    path === '/member' || path.startsWith('/member/') || path === '/login'
  const isHome = path === '/'

  if (isAdmin) {
    return (
      <div className="min-h-screen relative">
        <Suspense fallback={<PageLoading />}><AppContent path={path} /></Suspense>
      </div>
    )
  }

  return (
    <div className={`public-site min-h-screen relative isolate ${isHome ? 'public-home' : 'public-content'}`}>
      {/* Video background (z-0) */}
      <div className="fixed inset-0 bg-gradient-to-br from-[#e8e4dc] to-[#f5f2ed] z-0" />
      <div className="fixed inset-0 bg-cover bg-center z-0" style={{ backgroundImage: "url('/hero-poster.webp')" }} />
      <BackgroundVideo key={videoUrl} src={videoUrl} enabled={playVideo && (loaded.config || status.config === 'error')} />

      {/* Overlay (z-10) */}
      <div className="fixed inset-0 bg-white/35 dark:bg-black/55 z-10 pointer-events-none" />

      {/* Content (z-20) */}
      <div className="relative z-20">
        <SideDecor />
        <ThemeSwitcher compact={!isHome} />
        <Navbar />
        <SiteDataNotice resources={['config']} />
        <div className="relative z-10" data-public-content>
          <Suspense fallback={<PageLoading />}><AppContent path={path} /></Suspense>
          <Footer />
        </div>
      </div>
    </div>
  )
}
