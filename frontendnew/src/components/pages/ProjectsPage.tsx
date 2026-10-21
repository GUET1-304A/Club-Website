import { useState } from 'react'
import { FolderOpen, Star, GitFork } from 'lucide-react'
import Card from '../ui/Card'
import TagPill from '../ui/TagPill'
import SearchModal from '../ui/SearchModal'
import type { SearchItem } from '../ui/SearchModal'
import EmptyState from '../ui/EmptyState'
import Button from '../ui/Button'
import { useSiteData } from '../../store/useSiteData'
import { COVER_PLACEHOLDER, handleImageError } from '../../lib/imageFallback'

const categories = [
  { key: 'all', label: '全部' },
  { key: 'web', label: 'Web 应用' },
  { key: 'miniapp', label: '小程序' },
  { key: 'ai', label: 'AI/算法' },
  { key: 'tools', label: '工具库' },
  { key: 'game', label: '游戏' },
]

export default function ProjectsPage() {
  const { projects } = useSiteData()
  const [activeCat, setActiveCat] = useState('all')
  const [search, setSearch] = useState('')

  const filtered = projects.filter((p) => {
    if (activeCat !== 'all' && p.category !== activeCat) return false
    if (search && !p.name.includes(search) && !p.description.includes(search)) return false
    return true
  })

  return (
    <div className="page-enter max-w-[1200px] mx-auto px-6 py-24">
      <h1 className="text-[36px] md:text-[44px] font-medium text-[#051A24] text-center">
        作品<span className="font-mondwest">画廊</span>
      </h1>

      <div className="sticky top-20 z-40 mx-auto max-w-fit rounded-full bg-[var(--theme-surface-soft)] backdrop-blur-md py-2.5 px-6 shadow-sm border border-[var(--theme-border)] mt-8">
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="flex gap-3 flex-wrap justify-center">
            {categories.map((c) => (
              <TagPill key={c.key} label={c.label} active={activeCat === c.key} onClick={() => setActiveCat(c.key)} />
            ))}
          </div>
          <SearchModal
            items={projects.map((p): SearchItem => ({ id: p.id, title: p.name, description: p.description, category: p.category, href: `/project/${p.slug}` }))}
            placeholder="搜索项目..."
            onSelect={(item) => { setSearch(item.title) }}
          />
        </div>
      </div>

      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mt-8">
          {filtered.map((project) => (
            <Card key={project.id} className="overflow-hidden !p-0">
              <img
                src={project.coverImage || COVER_PLACEHOLDER}
                alt={project.name}
                className="w-full h-52 object-cover"
                loading="lazy"
                onError={handleImageError}
              />
              <div className="p-6">
                <h3 className="text-xl font-medium text-[#051A24]">{project.name}</h3>
                <p className="text-sm text-[#273C46] mt-2 line-clamp-2">{project.description}</p>
                <div className="flex gap-2 mt-4 flex-wrap">
                  {project.techStack.map((t) => (<TagPill key={t} label={t} />))}
                </div>
                <div className="flex justify-between items-center mt-4 pt-4 border-t border-[rgba(0,0,0,0.08)]">
                  <div className="flex gap-3 text-sm text-[#273C46]">
                    <span className="flex items-center gap-1"><Star className="w-4 h-4" /> {project.stars}</span>
                    <span className="flex items-center gap-1"><GitFork className="w-4 h-4" /> {project.forks}</span>
                  </div>
                  <a href={`/project/${project.slug}`} className="text-sm font-medium text-[#051A24] hover:opacity-70 transition-opacity">
                    查看详情 →
                  </a>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState icon={FolderOpen} message="暂无匹配的项目" />
      )}

      <div className="mt-20 pt-16 border-t border-[rgba(0,0,0,0.08)] text-center">
        <p className="text-[#273C46] text-sm mb-4">也看看我们的比赛成果</p>
        <Button variant="tertiary" href="/awards">查看全部奖项 →</Button>
      </div>
    </div>
  )
}
