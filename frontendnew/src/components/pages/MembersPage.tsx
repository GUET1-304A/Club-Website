import { useState } from 'react'
import { Users } from 'lucide-react'
import Card from '../ui/Card'
import TagPill from '../ui/TagPill'
import SearchModal from '../ui/SearchModal'
import EmptyState from '../ui/EmptyState'
import { useSiteData } from '../../store/useSiteData'
import type { Member } from '../../types'
import type { SearchItem } from '../ui/SearchModal'

const groupLabels: Record<string, string> = {
  product: '流光组', design: '星绘组', dev: '逐云组', content: '拾焰组',
}

const groups = [
  { key: 'all', label: '全部' },
  { key: 'product', label: '流光组' },
  { key: 'design', label: '星绘组' },
  { key: 'dev', label: '逐云组' },
  { key: 'content', label: '拾焰组' },
] as const

const PAGE_SIZE = 12

export default function MembersPage() {
  const { members } = useSiteData()
  const [activeGroup, setActiveGroup] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  const filtered = members.filter((m) => {
    if (activeGroup !== 'all' && m.group !== activeGroup) return false
    if (search && !m.name.includes(search) && !m.role.includes(search)) return false
    return true
  })

  const visible = filtered.slice(0, visibleCount)

  return (
    <div className="page-enter max-w-[1200px] mx-auto px-6 py-24">
      <h1 className="text-[36px] md:text-[44px] font-medium text-[#051A24] text-center">
        我们的<span className="font-mondwest">成员</span>
      </h1>

      <div className="sticky top-20 z-40 mx-auto max-w-fit rounded-full bg-[var(--theme-surface-soft)] backdrop-blur-md py-2.5 px-6 shadow-sm border border-[var(--theme-border)] mt-8">
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="flex gap-3 flex-wrap justify-center">
            {groups.map((g) => (
              <TagPill
                key={g.key}
                label={g.label}
                active={activeGroup === g.key}
                onClick={() => { setActiveGroup(g.key); setVisibleCount(PAGE_SIZE) }}
              />
            ))}
          </div>
          <SearchModal
            items={members.map((m): SearchItem => ({ id: m.id, title: m.name, description: m.role, category: m.group }))}
            placeholder="搜索成员..."
            onSelect={(item) => { setSearch(item.title); setVisibleCount(PAGE_SIZE) }}
          />
        </div>
      </div>

      {visible.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mt-8">
          {visible.map((member) => (
            <MemberCard key={member.id} member={member} />
          ))}
        </div>
      ) : (
        <EmptyState icon={Users} message="暂无匹配的成员" />
      )}

      {visible.length < filtered.length && (
        <div className="text-center mt-12">
          <button className="btn-tertiary" onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}>
            加载更多成员 ↓
          </button>
        </div>
      )}
    </div>
  )
}

function MemberCard({ member }: { member: Member }) {
  return (
    <Card className="text-center px-4">
      <img src={member.avatar} alt={member.name} className="w-20 h-20 rounded-full object-cover mx-auto mt-8" loading="lazy" />
      <h3 className="text-lg font-medium text-[#051A24] mt-4">{member.name}</h3>
      <p className="text-sm text-[#273C46]">{member.role}</p>
      <div className="flex flex-wrap gap-2 justify-center mt-3 px-4">
        {member.skills.map((s) => (<TagPill key={s} label={s} />))}
      </div>
      <div className="mt-4 mb-8 text-xs text-[#273C46]/60">{member.grade} · {groupLabels[member.group] || member.group}</div>
    </Card>
  )
}
