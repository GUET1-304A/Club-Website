import { useState, useEffect, useCallback } from 'react'
import { Search, FolderGit2, Users, GitBranch, ArrowRight } from 'lucide-react'
import MemberLayout from './MemberLayout'
import TagPill from '../ui/TagPill'
import { memberListProjects, type MemberProfile, type ProjectData } from '../../services/memberApi'

const CATEGORIES = [
  { value: 'web', label: 'Web' },
  { value: 'miniapp', label: '小程序' },
  { value: 'ai', label: 'AI' },
  { value: 'tools', label: '工具' },
  { value: 'game', label: '游戏' },
]

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  active: { label: '进行中', cls: 'bg-emerald-50 text-emerald-700' },
  completed: { label: '已完成', cls: 'bg-blue-50 text-blue-700' },
  archived: { label: '已归档', cls: 'bg-gray-100 text-gray-400' },
}

export default function MemberProjects({ member }: { member: MemberProfile }) {
  const [projects, setProjects] = useState<ProjectData[]>([])
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const params: Record<string, string> = {}
    if (search) params.search = search
    if (category) params.category = category
    const data = await memberListProjects(params).catch(() => [])
    setProjects(data)
    setLoading(false)
  }, [search, category])

  useEffect(() => { load() }, [load])

  return (
    <MemberLayout member={member}>
      <div className="animate-fade-in-up">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-[28px] font-medium text-[#051A24] tracking-tight"
              style={{ fontFamily: "var(--font-sans)", fontWeight: 500 }}>
              我的项目
            </h1>
            <p className="text-sm text-[#273C46]/50 mt-1">
              {projects.length} 个项目 · {projects.filter(p => p.status === 'active').length} 个进行中
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#273C46]/25" />
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="搜索项目..."
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-[rgba(0,0,0,0.06)] bg-white text-sm text-[#051A24]
                placeholder:text-[#273C46]/30 focus:outline-none focus:border-[#051A24]/30 focus:ring-2 focus:ring-[#051A24]/5 transition-all"
            />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {[{ value: '', label: '全部' }, ...CATEGORIES].map(c => (
              <TagPill key={c.value} label={c.label} active={category === c.value} onClick={() => setCategory(c.value)} />
            ))}
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="card overflow-hidden animate-pulse" style={{ borderRadius: 24 }}>
                <div className="h-40 bg-[#f0ece6]" />
                <div className="p-5 space-y-3">
                  <div className="h-5 w-32 bg-[#f0ece6] rounded-lg" />
                  <div className="h-3 w-full bg-[#f0ece6] rounded-md" />
                  <div className="flex gap-2"><div className="h-5 w-14 bg-[#f0ece6] rounded-full" /><div className="h-5 w-12 bg-[#f0ece6] rounded-full" /></div>
                </div>
              </div>
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#f0ece6] flex items-center justify-center mb-4">
              <FolderGit2 className="w-7 h-7 text-[#273C46]/20" />
            </div>
            <p className="text-sm text-[#273C46]/50">暂无项目</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {projects.map(p => {
              const progress = (p.taskCount && p.taskCount > 0)
                ? Math.round((p.taskDoneCount || 0) / p.taskCount * 100)
                : 0
              const statusInfo = STATUS_MAP[p.status || 'active'] || STATUS_MAP.active

              return (
                <a
                  key={p.id}
                  href={`/member/projects/${p.id}`}
                  className="card overflow-hidden group hover:translate-y-[-3px] transition-all duration-300"
                  style={{ borderRadius: 24 }}
                >
                  {/* Cover */}
                  <div className="relative h-40 bg-gradient-to-br from-[#f0ece6] to-[#e8e4dc] overflow-hidden">
                    {p.coverImage
                      ? <img src={p.coverImage} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      : (
                        <div className="w-full h-full flex items-center justify-center">
                          <FolderGit2 className="w-10 h-10 text-[#273C46]/15" />
                        </div>
                      )}
                    {/* Status badge */}
                    <span className={`absolute top-3 right-3 text-[10px] font-medium rounded-full px-2.5 py-1 ${statusInfo.cls}`}>
                      {statusInfo.label}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <h3 className="text-base font-semibold text-[#051A24] group-hover:text-[#0D212C] transition-colors line-clamp-1">
                        {p.name}
                      </h3>
                    </div>

                    {p.description && (
                      <p className="text-xs text-[#273C46]/50 line-clamp-2 mb-3 leading-relaxed">{p.description}</p>
                    )}

                    {/* Category & tech */}
                    <div className="flex flex-wrap items-center gap-1.5 mb-3">
                      {p.category && (
                        <span className="text-[10px] bg-[#f0ece6] text-[#273C46]/70 rounded-full px-2 py-0.5 font-medium">
                          {CATEGORIES.find(c => c.value === p.category)?.label || p.category}
                        </span>
                      )}
                      {(p.techStack || []).slice(0, 3).map(t => (
                        <span key={t} className="text-[10px] bg-white border border-[rgba(0,0,0,0.04)] text-[#273C46]/50 rounded-full px-2 py-0.5">{t}</span>
                      ))}
                    </div>

                    {/* Progress bar */}
                    {(p.taskCount && p.taskCount > 0) ? (
                      <div className="mb-3">
                        <div className="flex items-center justify-between text-[10px] text-[#273C46]/50 mb-1">
                          <span>任务进度</span>
                          <span>{progress}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-[#f0ece6] overflow-hidden">
                          <div className="h-full rounded-full bg-gradient-to-r from-[#051A24] to-[#1a3a4a] transition-all" style={{ width: `${progress}%` }} />
                        </div>
                      </div>
                    ) : (
                      <div className="mb-3 text-[10px] text-[#273C46]/30">暂无任务</div>
                    )}

                    {/* Meta */}
                    <div className="flex items-center justify-between pt-3 border-t border-[rgba(0,0,0,0.03)]">
                      <div className="flex items-center gap-3 text-[11px] text-[#273C46]/50">
                        {p.ownerName && (
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {p.ownerName}
                          </span>
                        )}
                        {p.milestoneCount && p.milestoneCount > 0 && (
                          <span className="flex items-center gap-1">
                            <GitBranch className="w-3 h-3" />
                            {p.milestoneCount} 里程碑
                          </span>
                        )}
                      </div>
                      <ArrowRight className="w-4 h-4 text-[#273C46]/20 group-hover:text-[#051A24]/40 group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </div>
                </a>
              )
            })}
          </div>
        )}
      </div>
    </MemberLayout>
  )
}
