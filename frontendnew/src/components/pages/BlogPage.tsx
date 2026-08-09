import { useState, useEffect } from 'react'
import { FileText, Pin, CheckCircle2 } from 'lucide-react'
import Card from '../ui/Card'
import TagPill from '../ui/TagPill'
import SearchModal from '../ui/SearchModal'
import type { SearchItem } from '../ui/SearchModal'
import EmptyState from '../ui/EmptyState'
import { useSiteData } from '../../store/useSiteData'
import { isMemberLoggedIn, memberBlogReadIds } from '../../services/memberApi'

const categories = [
  { key: 'all', label: '全部' },
  { key: 'tech', label: '技术分享' },
  { key: 'event', label: '活动记录' },
  { key: 'summary', label: '心得总结' },
  { key: 'announcement', label: '公告通知' },
]

const PAGE_SIZE = 6

const monthNames = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二']

export default function BlogPage() {
  const { blogPosts } = useSiteData()
  const [activeCat, setActiveCat] = useState('all')
  const [search, setSearch] = useState('')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [readIds, setReadIds] = useState<Set<number>>(() => new Set())

  useEffect(() => {
    if (!isMemberLoggedIn()) return
    memberBlogReadIds()
      .then(data => setReadIds(new Set(data.readIds)))
      .catch(() => {})
  }, [])

  const filtered = [...blogPosts].filter((p) => {
    if (activeCat !== 'all' && p.category !== activeCat) return false
    if (search && !p.title.includes(search)) return false
    return true
  }).sort((a, b) => Number(b.pinned || false) - Number(a.pinned || false))
  const visible = filtered.slice(0, visibleCount)

  return (
    <div className="page-enter max-w-[900px] mx-auto px-6 py-24">
      <h1 className="text-[36px] md:text-[44px] font-medium text-[#051A24] text-center">
        博客<span className="font-mondwest">动态</span>
      </h1>

      <div className="sticky top-20 z-40 mx-auto max-w-fit rounded-full bg-white/80 backdrop-blur-md py-2.5 px-6 shadow-sm border border-[rgba(0,0,0,0.04)] mt-8">
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="flex gap-3 flex-wrap justify-center">
            {categories.map((c) => (
              <TagPill key={c.key} label={c.label} active={activeCat === c.key}
                onClick={() => { setActiveCat(c.key); setVisibleCount(PAGE_SIZE) }} />
            ))}
          </div>
          <SearchModal
            items={blogPosts.map((p): SearchItem => ({ id: p.id, title: p.title, description: p.excerpt, category: p.category, href: `/blog/${p.slug}` }))}
            placeholder="搜索文章..."
            onSelect={(item) => { setSearch(item.title); setVisibleCount(PAGE_SIZE) }}
          />
        </div>
      </div>

      {visible.length > 0 ? (
        <div className="space-y-8 mt-8">
          {visible.map((post) => {
            const [, m, d] = post.date.split('-')
            return (
              <Card key={post.id} className="flex flex-row !p-0 overflow-hidden !rounded-[32px]">
                <div className="w-20 flex-shrink-0 flex flex-col items-center justify-center bg-[#051A24] text-white">
                  <span className="text-2xl font-mondwest">{d}</span>
                  <span className="text-xs text-[#E0EBF0] mt-1">{monthNames[parseInt(m)]}月</span>
                </div>
                <div className="p-6 flex-1">
                  <a href={`/blog/${post.slug}`} className="text-xl font-medium text-[#051A24] hover:opacity-70 transition-opacity">
                    {post.title}
                  </a>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    {post.pinned && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium rounded-full bg-[#051A24] text-white px-2 py-0.5">
                        <Pin className="w-2.5 h-2.5" /> 置顶
                      </span>
                    )}
                    {readIds.has(Number(post.id)) && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium rounded-full bg-emerald-50 text-emerald-700 px-2 py-0.5">
                        <CheckCircle2 className="w-2.5 h-2.5" /> 已读
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-[#273C46] mt-2 line-clamp-2">{post.excerpt}</p>
                  <div className="flex gap-3 mt-3 text-xs text-[#273C46]/60 items-center flex-wrap">
                    <img src={post.author.avatar} alt={post.author.name} className="w-5 h-5 rounded-full" />
                    <span>{post.author.name}</span>
                    <span>·</span>
                    <span>{post.date}</span>
                    {post.tags.map((t) => (<TagPill key={t} label={t} />))}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      ) : (
        <EmptyState icon={FileText} message="暂无匹配的文章" />
      )}

      {visible.length < filtered.length && (
        <div className="text-center mt-12">
          <button className="btn-tertiary" onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}>
            加载更多文章 ↓
          </button>
        </div>
      )}
    </div>
  )
}
