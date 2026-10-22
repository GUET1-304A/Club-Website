import { useDetailMetadata } from '../../hooks/useMetadata'
import { usePublicDetail } from '../../hooks/usePublicDetail'
import DetailError from '../ui/DetailError'
import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { ExternalLink, Users, Calendar, Star, GitFork, ArrowLeft, X, ChevronLeft, ChevronRight, Maximize2, Download } from 'lucide-react'
import GithubIcon from '../ui/GithubIcon'
import Card from '../ui/Card'
import TagPill from '../ui/TagPill'
import Markdown from '../ui/Markdown'
import { useSiteData } from '../../store/useSiteData'
import { fetchProject } from '../../services/api'
import { mapApiProject } from '../../store/useSiteData'
import { COVER_PLACEHOLDER, handleImageError } from '../../lib/imageFallback'

const CAT_LABELS: Record<string, string> = {
  web: 'Web应用', miniapp: '小程序', ai: 'AI/算法', tools: '工具库', game: '游戏',
}

const loadDetail = (slug: string) => fetchProject(slug).then(mapApiProject)

export default function ProjectDetailPage({ slug }: { slug: string }) {
  const { projects: storeProjects } = useSiteData(['projects'])
  const { data: project, loading, error, retry } = usePublicDetail(slug, storeProjects.find(item => item.slug === slug), loadDetail)
  useDetailMetadata(`/project/${slug}`, {
    title: project?.name || (loading ? '项目详情' : error ? '项目加载失败' : '项目未找到'),
    description: project?.description, image: project?.coverImage, noIndex: !loading && !project,
  })
  const [lightbox, setLightbox] = useState<number | null>(null)

  if (loading) {
    return (
      <div className="page-enter max-w-[1100px] mx-auto px-6 py-24 animate-pulse">
        <div className="h-[300px] md:h-[450px] bg-[#f0ece6] rounded-[32px] mb-12" />
        <div className="h-8 w-2/3 bg-[#f0ece6] rounded-xl mb-4" />
        <div className="space-y-3">{[...Array(6)].map((_, i) => (<div key={i} className="h-4 bg-[#f0ece6] rounded-lg" style={{ width: `${60 + Math.random() * 40}%` }} />))}</div>
      </div>
    )
  }

  if (error) return <DetailError message={error} onRetry={retry} backHref="/projects" />

  if (!project) {
    return (
      <div className="page-enter max-w-[1100px] mx-auto px-6 py-24 text-center">
        <h1 className="text-3xl font-medium text-[#051A24]">项目未找到</h1>
        <a href="/projects" className="btn-tertiary mt-6 inline-flex items-center gap-1.5"><ArrowLeft className="w-4 h-4" /> 返回项目列表</a>
      </div>
    )
  }

  return (
    <div className="page-enter max-w-[1100px] mx-auto px-6 py-24">
      {/* Back link */}
      <a href="/projects" className="inline-flex items-center gap-1.5 text-sm text-[#273C46]/50 hover:text-[#051A24] transition-colors mb-6">
        <ArrowLeft className="w-3.5 h-3.5" /> 返回项目
      </a>

      {/* Cover image */}
      <div className="w-full h-[300px] md:h-[450px] rounded-[32px] overflow-hidden shadow-lg">
        <img
          src={project.coverImage || COVER_PLACEHOLDER}
          alt={project.name}
          className="w-full h-full object-cover"
          onError={handleImageError}
        />
      </div>

      {/* Screenshots — shown right after cover */}
      {project.screenshots.length > 0 && (
        <div className="mt-6">
          <h2 className="text-lg font-medium text-[#051A24] mb-3 flex items-center gap-2">
            <Maximize2 className="w-4 h-4 text-[#273C46]/40" /> 项目展示
            <span className="text-xs text-[#273C46]/40 font-normal">({project.screenshots.length} 张图片 · 点击放大)</span>
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {project.screenshots.map((url, i) => (
              <button
                key={i}
                onClick={() => setLightbox(i)}
                className="relative group rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 hover:scale-[1.02]"
              >
                <img
                  src={url}
                  alt={`${project.name} 截图 ${i + 1}`}
                  className="w-full h-36 md:h-44 object-cover"
                  onError={handleImageError}
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                  <Maximize2 className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-12 mt-12">
        {/* Left column */}
        <div className="min-w-0">
          <h1 className="text-3xl md:text-4xl font-medium text-[#051A24] tracking-tight">{project.name}</h1>
          <div className="flex gap-3 mt-3 flex-wrap">
            <TagPill label={CAT_LABELS[project.category] || project.category} />
            <TagPill label={project.status === 'active' ? '进行中' : project.status === 'completed' ? '已完成' : '已归档'} />
          </div>

          {/* Description */}
          <p className="mt-6 text-sm md:text-base text-[#0D212C] leading-relaxed">{project.description}</p>
          <p className="mt-3 text-sm text-[#273C46]/60">
            项目开始于 {project.startDate}{project.endDate ? `，于 ${project.endDate} 完成` : '，目前仍在积极开发中'}。
          </p>

          {/* Markdown content */}
          {project.content && (
            <div className="mt-10">
              <Markdown content={project.content} />
            </div>
          )}

          {/* Tech stack */}
          <h2 className="text-xl font-medium text-[#051A24] mt-10 mb-4">技术栈</h2>
          <div className="flex gap-2 flex-wrap">
            {project.techStack.map(t => <TagPill key={t} label={t} />)}
          </div>

        </div>

        {/* Right sidebar */}
        <div className="space-y-6">
          <Card className="p-6 !rounded-[24px] sticky top-24">
            <div className="space-y-4">
              {project.githubUrl && (
                <a href={project.githubUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-[#051A24] hover:opacity-70 transition-opacity">
                  <GithubIcon className="w-4 h-4" />
                  <span>查看源码</span>
                  <span className="ml-auto flex gap-3 text-[#273C46]">
                    <span className="flex items-center gap-1"><Star className="w-3 h-3" />{project.stars}</span>
                    <span className="flex items-center gap-1"><GitFork className="w-3 h-3" />{project.forks}</span>
                  </span>
                </a>
              )}
              {project.demoUrl && (
                <a href={project.demoUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-[#051A24] hover:opacity-70 transition-opacity">
                  <ExternalLink className="w-4 h-4" /> 在线演示
                </a>
              )}

              <hr className="border-[rgba(0,0,0,0.06)]" />

              {/* Team */}
              {project.team.length > 0 && (
                <>
                  <div>
                    <h4 className="text-xs font-medium text-[#273C46] mb-3 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5" /> 团队成员
                    </h4>
                    <div className="space-y-2">
                      {project.team.map((t) => (
                        <div key={t.name} className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-[#f0ece6] overflow-hidden shrink-0">
                            {t.avatar ? <img src={t.avatar} alt={t.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[10px] text-[#273C46]/40">{t.name[0]}</div>}
                          </div>
                          <span className="text-sm text-[#051A24]">{t.name}</span>
                          <span className="text-xs text-[#273C46]/60">{t.role}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <hr className="border-[rgba(0,0,0,0.06)]" />
                </>
              )}

              {/* Timeline */}
              <div>
                <h4 className="text-xs font-medium text-[#273C46] mb-2 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" /> 项目周期
                </h4>
                <p className="text-sm text-[#051A24]">{project.startDate} ~ {project.endDate || '至今'}</p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Lightbox */}
      {lightbox !== null && project.screenshots[lightbox] && (
        <Lightbox
          images={project.screenshots}
          index={lightbox}
          onClose={() => setLightbox(null)}
          onChange={setLightbox}
        />
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   Lightbox — fullscreen gallery viewer
   ═══════════════════════════════════════════════════════════════ */

function Lightbox({
  images, index, onClose, onChange,
}: {
  images: string[]
  index: number
  onClose: () => void
  onChange: (i: number) => void
}) {
  const prev = useCallback(() => onChange((index - 1 + images.length) % images.length), [index, images.length, onChange])
  const next = useCallback(() => onChange((index + 1) % images.length), [index, images.length, onChange])

  // 锁定 body 滚动，防止网页被撑长
  useEffect(() => {
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = original }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') prev()
      if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, prev, next])

  return createPortal((
    <div
      className="fixed inset-0 z-[200] bg-black/95 flex flex-col"
      onClick={onClose}
    >
      {/* Top bar */}
      <div className="absolute top-0 inset-x-0 h-16 bg-gradient-to-b from-black/60 to-transparent z-10 flex items-center justify-between px-4">
        <span className="text-white/80 text-sm font-medium ml-2">
          {index + 1} / {images.length}
        </span>
        <div className="flex items-center gap-1">
          <a
            href={images[index]}
            download
            target="_blank"
            rel="noreferrer"
            onClick={e => e.stopPropagation()}
            className="p-2.5 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-all"
            title="下载原图"
          >
            <Download className="w-5 h-5" />
          </a>
          <button
            onClick={onClose}
            className="p-2.5 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-all"
            title="关闭 (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main image area */}
      <div className="flex-1 flex items-center justify-center p-4 md:p-8 pt-20 pb-24">
        {/* Prev button */}
        {images.length > 1 && (
          <button
            onClick={e => { e.stopPropagation(); prev() }}
            className="absolute left-3 md:left-6 top-1/2 -translate-y-1/2 z-10
              w-11 h-11 rounded-2xl flex items-center justify-center
              bg-white/10 backdrop-blur-md text-white/70 hover:text-white hover:bg-white/20
              transition-all duration-200 hover:scale-105 active:scale-95"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        <img
          src={images[index]}
          alt={`截图 ${index + 1}`}
          className="max-w-full max-h-full rounded-2xl object-contain shadow-2xl select-none"
          onClick={e => e.stopPropagation()}
          draggable={false}
        />

        {/* Next button */}
        {images.length > 1 && (
          <button
            onClick={e => { e.stopPropagation(); next() }}
            className="absolute right-3 md:right-6 top-1/2 -translate-y-1/2 z-10
              w-11 h-11 rounded-2xl flex items-center justify-center
              bg-white/10 backdrop-blur-md text-white/70 hover:text-white hover:bg-white/20
              transition-all duration-200 hover:scale-105 active:scale-95"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Bottom thumbnail strip */}
      {images.length > 1 && (
        <div className="absolute bottom-0 inset-x-0 h-20 bg-gradient-to-t from-black/60 to-transparent z-10 flex items-center justify-center gap-2 px-4 overflow-x-auto">
          {images.map((url, i) => (
            <button
              key={i}
              onClick={e => { e.stopPropagation(); onChange(i) }}
              className={`shrink-0 w-14 h-10 rounded-xl overflow-hidden border-2 transition-all duration-200
                ${i === index
                  ? 'border-white shadow-lg scale-110'
                  : 'border-white/20 opacity-50 hover:opacity-80 hover:border-white/50'
                }`}
            >
              <img src={url} alt={`缩略图 ${i + 1}`} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  ), document.body)
}
