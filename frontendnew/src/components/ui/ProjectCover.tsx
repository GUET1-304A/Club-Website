import { ArrowUpRight } from 'lucide-react'
import type { Project } from '../../types'
import { COVER_PLACEHOLDER, handleImageError } from '../../lib/imageFallback'

const labels: Record<Project['category'], string> = {
  web: 'WEB 应用', miniapp: '小程序', ai: 'AI / 算法', tools: '工具库', game: '游戏',
}

export default function ProjectCover({ project }: { project: Project }) {
  return (
    <a href={`/project/${project.slug}`} className="project-cover group" data-category={project.category}>
      <span className="project-cover-category">{labels[project.category] || '作品'}</span>
      <div className="project-cover-preview">
        <img src={project.coverImage || COVER_PLACEHOLDER} alt={`${project.name}界面预览`}
          loading="lazy" onError={handleImageError} />
      </div>
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-xl leading-snug text-[var(--theme-text-strong)]">{project.name}</h3>
        <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-[var(--theme-text)] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
      </div>
    </a>
  )
}
