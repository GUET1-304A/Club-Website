import { ArrowUpRight, Code2 } from 'lucide-react'
import GithubIcon from '../ui/GithubIcon'
import Card from '../ui/Card'
import DataState from '../ui/DataState'
import EmptyState from '../ui/EmptyState'
import { useSiteData } from '../../store/useSiteData'
import { publicRepositories } from '../../lib/repositories'

export default function OpenSourcePage() {
  const { projects } = useSiteData(['projects'])
  const repos = publicRepositories(projects)
  return (
    <div className="page-enter max-w-[1000px] mx-auto px-6 py-24">
      <h1 className="text-[36px] md:text-[44px] font-medium text-[#051A24] text-center">
        开源<span className="font-mondwest">精神</span>
      </h1>

      <div className="text-center mt-6 mb-12">
        <p className="text-sm md:text-base text-[#0D212C] max-w-lg mx-auto leading-relaxed">
          我们相信开源的力量。在这里分享项目源码，欢迎提出问题、交流想法或参与贡献。
        </p>
        <a href="/projects"
          className="btn-primary inline-flex mt-6 gap-2">
          <Code2 className="w-4 h-4" /> 浏览全部项目
        </a>
      </div>

      <DataState resource="projects">
      <div className="space-y-6 mt-12">
        {repos.map(({ project, repository }) => (
          <Card key={repository.href} className="p-6 md:p-8 !rounded-[24px]">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <a href={repository.href} target="_blank" rel="noopener noreferrer" className="group inline-flex max-w-full items-start gap-2 text-lg font-medium text-[var(--theme-text-strong)] hover:underline underline-offset-4">
                  <span className="break-words min-w-0">{project.name}</span><ArrowUpRight className="mt-1 h-4 w-4 shrink-0" />
                </a>
                <p className="mt-1 flex items-start gap-1.5 break-all font-mono text-xs text-[var(--theme-text)]"><GithubIcon className="mt-0.5 h-3 w-3 shrink-0" />{repository.label}</p>
                <p className="text-sm text-[var(--theme-text)] mt-3 leading-relaxed">{project.description}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {project.techStack.map(tech => <span key={tech} className="rounded-full border border-[var(--theme-border)] px-2.5 py-1 text-xs text-[var(--theme-text)]">{tech}</span>)}
                </div>
              </div>
              <a href={`/project/${project.slug}`} className="shrink-0 text-sm text-[var(--theme-text-strong)] underline underline-offset-4">项目介绍</a>
            </div>
          </Card>
        ))}
        {!repos.length && <EmptyState icon={Code2} message="公开仓库整理中，欢迎先浏览我们的项目。" />}
      </div>
      </DataState>
    </div>
  )
}
