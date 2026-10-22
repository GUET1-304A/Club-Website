import { Megaphone, ArrowUpRight, Clock } from 'lucide-react'
import { useSiteData } from '../../store/useSiteData'

export default function AnnouncementSection() {
  const { blogPosts } = useSiteData(['blogPosts'])
  const announcements = blogPosts
    .filter(post => post.category === 'announcement')
    .slice(0, 3)

  if (announcements.length === 0) return null

  return (
    <section className="site-container py-10">
      <div className="rounded-[28px] bg-[#051A24] text-white p-6 md:p-8">
        <div className="flex items-center gap-2 mb-5">
          <Megaphone className="w-4 h-4 text-white/70" />
          <h2 className="text-sm font-semibold tracking-wide">公告动态</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {announcements.map(post => (
            <a key={post.id} href={`/blog/${post.slug}`}
              className="group rounded-2xl bg-white/[0.06] hover:bg-white/[0.12] p-4 transition-all border border-white/5">
              <div className="flex items-center gap-1.5 text-[10px] text-white/40 mb-2">
                <Clock className="w-2.5 h-2.5" />
                {post.date || ''}
              </div>
              <p className="text-sm font-medium text-white/90 leading-5 line-clamp-2 group-hover:text-white transition-colors">
                {post.title}
              </p>
              {post.excerpt && (
                <p className="text-xs text-white/40 mt-2 leading-5 line-clamp-1">{post.excerpt}</p>
              )}
            </a>
          ))}
        </div>
        <a href="/blog" className="inline-flex items-center gap-1 mt-5 text-xs text-white/50 hover:text-white transition-colors">
          查看全部动态 <ArrowUpRight className="w-3 h-3" />
        </a>
      </div>
    </section>
  )
}
