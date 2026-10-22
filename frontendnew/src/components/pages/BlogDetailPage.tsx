import { useDetailMetadata } from '../../hooks/useMetadata'
import { usePublicDetail } from '../../hooks/usePublicDetail'
import DetailError from '../ui/DetailError'
import { useEffect } from 'react'
import { Calendar, User, ArrowLeft, Tag, Pin } from 'lucide-react'
import TagPill from '../ui/TagPill'
import Card from '../ui/Card'
import Markdown from '../ui/Markdown'
import { useSiteData, mapApiBlog } from '../../store/useSiteData'
import { handleImageError } from '../../lib/imageFallback'
import { fetchBlog } from '../../services/api'
import { isMemberLoggedIn, memberMarkBlogRead } from '../../services/memberApi'

const CAT_LABELS: Record<string, string> = {
  tech: '技术分享', event: '活动记录', summary: '心得总结', announcement: '公告通知',
}

const loadDetail = (slug: string) => fetchBlog(slug).then(mapApiBlog)

export default function BlogDetailPage({ slug }: { slug: string }) {
  const { blogPosts: storeBlogs } = useSiteData(['blogPosts'])
  const { data: post, loading, error, retry } = usePublicDetail(slug, storeBlogs.find(p => p.slug === slug), loadDetail)
  useDetailMetadata(`/blog/${slug}`, {
    title: post?.title || (loading ? '文章详情' : error ? '文章加载失败' : '文章未找到'),
    description: post?.excerpt || post?.content, image: post?.coverImage, noIndex: !loading && !post, type: 'article',
  })
  const relatedPosts = storeBlogs.filter(p => p.slug !== slug && p.category === post?.category).slice(0, 3)

  useEffect(() => {
    if (!post || !isMemberLoggedIn()) return
    memberMarkBlogRead(Number(post.id)).catch(() => {})
  }, [post])

  if (loading) {
    return (
      <div className="page-enter max-w-[900px] mx-auto px-6 py-24 animate-pulse">
        <div className="h-8 w-2/3 bg-[#f0ece6] rounded-xl mb-4" />
        <div className="h-4 w-1/3 bg-[#f0ece6] rounded-lg mb-8" />
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-4 bg-[#f0ece6] rounded-lg" style={{ width: `${70 + Math.random() * 30}%` }} />
          ))}
        </div>
      </div>
    )
  }

  if (error) return <DetailError message={error} onRetry={retry} backHref="/blog" />

  if (!post) {
    return (
      <div className="page-enter max-w-[900px] mx-auto px-6 py-24 text-center">
        <h1 className="text-3xl font-medium text-[#051A24]">文章未找到</h1>
        <a href="/blog" className="btn-tertiary mt-6 inline-flex items-center gap-1.5">
          <ArrowLeft className="w-4 h-4" /> 返回博客列表
        </a>
      </div>
    )
  }

  const [, m, d] = post.date.split('-')
  const monthNames = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二']

  return (
    <div className="page-enter max-w-[900px] mx-auto px-6 py-24">
      {/* Back link */}
      <a href="/blog" className="inline-flex items-center gap-1.5 text-sm text-[#273C46]/50 hover:text-[#051A24] transition-colors mb-8">
        <ArrowLeft className="w-3.5 h-3.5" /> 返回博客
      </a>

      {/* Header card with date block */}
      <Card className="flex flex-row !p-0 overflow-hidden !rounded-[32px] mb-10" hover={false}>
        {/* Date block */}
        <div className="w-24 flex-shrink-0 flex flex-col items-center justify-center bg-[#051A24] text-white">
          <span className="text-3xl font-mondwest">{d || '—'}</span>
          <span className="text-xs text-[#E0EBF0] mt-1">{m ? `${monthNames[parseInt(m)]}月` : ''}</span>
        </div>

        {/* Title area */}
        <div className="p-6 md:p-8 flex-1">
          <div className="flex items-center gap-2 mb-3">
            <TagPill label={CAT_LABELS[post.category] || post.category} />
            {post.pinned && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium rounded-full bg-[#051A24] text-white px-2 py-1">
                <Pin className="w-2.5 h-2.5" /> 置顶
              </span>
            )}
            {post.tags.slice(0, 3).map(t => <TagPill key={t} label={t} />)}
          </div>
          <h1 className="text-2xl md:text-3xl font-medium text-[#051A24] leading-tight tracking-tight">
            {post.title}
          </h1>
          <div className="flex items-center gap-3 mt-4 text-sm text-[#273C46]/60">
            {post.author.avatar && (
              <img src={post.author.avatar} alt={post.author.name} className="w-6 h-6 rounded-full" />
            )}
            <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" /> {post.author.name}</span>
            <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {post.date}</span>
          </div>
        </div>
      </Card>

      {/* Cover image */}
      {post.coverImage && (
        <div className="w-full h-[250px] md:h-[350px] rounded-[32px] overflow-hidden shadow-lg mb-10">
              <img
                src={post.coverImage}
                alt={post.title}
                className="w-full h-full object-cover"
                onError={handleImageError}
              />
        </div>
      )}

      {/* Article body */}
      <div className="max-w-none">
        <Markdown content={post.content} />
      </div>

      {/* Tags footer */}
      {post.tags.length > 0 && (
        <div className="flex items-center gap-3 mt-12 pt-8 border-t border-[rgba(0,0,0,0.06)]">
          <Tag className="w-4 h-4 text-[#273C46]/40" />
          <div className="flex gap-2 flex-wrap">
            {post.tags.map(t => <TagPill key={t} label={t} />)}
          </div>
        </div>
      )}

      {/* Related posts */}
      {relatedPosts.length > 0 && (
        <div className="mt-16">
          <h2 className="text-xl font-medium text-[#051A24] mb-6">相关文章</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {relatedPosts.map(rp => (
              <a key={rp.id} href={`/blog/${rp.slug}`}
                className="card p-5 hover:translate-y-[-2px] transition-all duration-300"
                style={{ borderRadius: 22 }}>
                <h3 className="text-sm font-medium text-[#051A24] line-clamp-2">{rp.title}</h3>
                <p className="text-xs text-[#273C46]/50 mt-2 line-clamp-1">{rp.excerpt}</p>
                <div className="flex items-center gap-2 mt-3 text-xs text-[#273C46]/40">
                  <Calendar className="w-3 h-3" /> {rp.date}
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
