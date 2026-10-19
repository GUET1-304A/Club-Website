import { useState, useEffect, useCallback } from 'react'
import { Search, Users, Mail, Globe } from 'lucide-react'
import GithubIcon from '../ui/GithubIcon'
import MemberLayout from './MemberLayout'
import TagPill from '../ui/TagPill'
import { memberDirectory, type MemberProfile } from '../../services/memberApi'

const GROUPS = [
  { value: 'product', label: '产品组' },
  { value: 'design', label: '设计组' },
  { value: 'dev', label: '开发组' },
  { value: 'content', label: '内容组' },
]

export default function MemberDirectory({ member }: { member: MemberProfile }) {
  const [members, setMembers] = useState<MemberProfile[]>([])
  const [search, setSearch] = useState('')
  const [group, setGroup] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const params: Record<string, string> = {}
    if (search) params.search = search
    if (group) params.group = group
    const data = await memberDirectory(params).catch(() => [])
    setMembers(data)
    setLoading(false)
  }, [search, group])

  useEffect(() => { load() }, [load])

  return (
    <MemberLayout member={member}>
      <div className="animate-fade-in-up">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-[28px] font-medium text-[#051A24] tracking-tight"
              style={{ fontFamily: "var(--font-sans)", fontWeight: 500 }}>
              成员通讯录
            </h1>
            <p className="text-sm text-[#273C46]/50 mt-1">
              {members.length} 位成员
              {group && ` · ${GROUPS.find(g => g.value === group)?.label || group}`}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#273C46]/25" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="搜索姓名、角色、技能..."
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-[rgba(0,0,0,0.06)] bg-white text-sm text-[#051A24]
                placeholder:text-[#273C46]/30 focus:outline-none focus:border-[#051A24]/30 focus:ring-2 focus:ring-[#051A24]/5 transition-all"
            />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {[{ value: '', label: '全部' }, ...GROUPS].map(g => (
              <TagPill key={g.value} label={g.label} active={group === g.value} onClick={() => setGroup(g.value)} />
            ))}
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="card p-5 animate-pulse" style={{ borderRadius: 22 }}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-xl bg-[#f0ece6]" />
                  <div className="space-y-1.5 flex-1">
                    <div className="h-4 w-20 bg-[#f0ece6] rounded-lg" />
                    <div className="h-3 w-16 bg-[#f0ece6] rounded-md" />
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <div className="h-5 w-14 bg-[#f0ece6] rounded-full" />
                  <div className="h-5 w-12 bg-[#f0ece6] rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : members.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#f0ece6] flex items-center justify-center mb-4">
              <Users className="w-7 h-7 text-[#273C46]/20" />
            </div>
            <p className="text-sm text-[#273C46]/50">暂无匹配的成员</p>
            {search && <p className="text-xs text-[#273C46]/30 mt-1">尝试其他搜索词</p>}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {members.map(m => (
              <div
                key={m.id}
                className="card p-5 group hover:translate-y-[-2px] transition-all duration-300"
                style={{ borderRadius: 22 }}
              >
                {/* Avatar + Name */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#f0ece6] to-[#e8e4dc] overflow-hidden shrink-0 ring-2 ring-white shadow-sm">
                    {m.avatar
                      ? <img src={m.avatar} alt="" className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center text-sm font-semibold text-[#273C46]/30">{m.name?.[0] || '?'}</div>
                    }
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-[#051A24] truncate">{m.name}</h3>
                    <p className="text-[11px] text-[#273C46]/50 truncate">{m.role || m.grade || ''}</p>
                  </div>
                </div>

                {/* Group tag */}
                {m.group && (
                  <span className="inline-block text-[10px] bg-[#f0ece6] text-[#273C46]/70 rounded-full px-2 py-0.5 font-medium mb-2">
                    {GROUPS.find(g => g.value === m.group)?.label || m.group}
                  </span>
                )}

                {/* Skills */}
                {m.skills && m.skills.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {m.skills.slice(0, 3).map(s => (
                      <span key={s} className="text-[10px] bg-white border border-[rgba(0,0,0,0.04)] text-[#273C46]/60 rounded-full px-2 py-0.5">{s}</span>
                    ))}
                    {m.skills.length > 3 && (
                      <span className="text-[10px] text-[#273C46]/30">+{m.skills.length - 3}</span>
                    )}
                  </div>
                )}

                {/* Bio */}
                {m.bio && (
                  <p className="text-xs text-[#273C46]/50 leading-relaxed line-clamp-2 mb-3">{m.bio}</p>
                )}

                {/* Contact links */}
                <div className="flex items-center gap-1.5 pt-2 border-t border-[rgba(0,0,0,0.03)]">
                  {m.email && (
                    <a href={`mailto:${m.email}`} className="p-1.5 rounded-lg text-[#273C46]/30 hover:text-[#051A24] hover:bg-[#f0ece6] transition-all" title="发送邮件">
                      <Mail className="w-3.5 h-3.5" />
                    </a>
                  )}
                  {m.github && (
                    <a href={m.github} target="_blank" rel="noreferrer" className="p-1.5 rounded-lg text-[#273C46]/30 hover:text-[#051A24] hover:bg-[#f0ece6] transition-all" title="GitHub">
                      <GithubIcon className="w-3.5 h-3.5" />
                    </a>
                  )}
                  {m.blog && (
                    <a href={m.blog} target="_blank" rel="noreferrer" className="p-1.5 rounded-lg text-[#273C46]/30 hover:text-[#051A24] hover:bg-[#f0ece6] transition-all" title="博客">
                      <Globe className="w-3.5 h-3.5" />
                    </a>
                  )}
                  <span className="flex-1" />
                  {m.studentId && (
                    <span className="text-[10px] text-[#273C46]/30 font-mono">{m.studentId}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </MemberLayout>
  )
}
