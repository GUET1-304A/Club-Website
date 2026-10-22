import { useInViewAnimation } from '../../hooks/useInViewAnimation'
import Divider from '../ui/Divider'
import Card from '../ui/Card'
import { useSiteData } from '../../store/useSiteData'
import { handleImageError } from '../../lib/imageFallback'
import { usePageData } from '../../store/usePageData'
import PageDataNotice from '../ui/PageDataNotice'

export default function AboutPage() {
  const { ref, isInView } = useInViewAnimation({ threshold: 0.1 })
  const { config } = useSiteData(['config'])
  const stats = config.stats
  const { page } = usePageData('about')
  const photos = ((page?.content as { images?: string[] } | undefined)?.images ?? []).filter(src => src.trim().length > 0)

  return (
    <div ref={ref} className="page-enter max-w-[900px] mx-auto px-6 py-24">
      <h1 className="text-[36px] md:text-[44px] font-medium text-[#051A24]">
        关于<span className="font-mondwest">{config.siteName}</span>
      </h1>
      <PageDataNotice slug="about" />

      <div className="mt-8 space-y-6 text-sm md:text-base text-[#0D212C] leading-relaxed">
        <p>{config.aboutDescription}</p>
        {config.aboutExtra && <p>{config.aboutExtra}</p>}
      </div>

      {config.aboutImage && (
        <Card hover={false} className="mt-10 overflow-hidden p-2">
          <img
            src={config.aboutImage}
            alt="星雨作坊成员日常"
            className="aspect-[16/9] w-full rounded-[24px] object-cover md:rounded-[30px]"
            loading="lazy"
            onError={handleImageError}
          />
        </Card>
      )}

      <Divider />

      {/* Stats */}
      <div className="flex gap-10 justify-center">
        {stats.map((stat, i) => (
          <div
            key={stat.label}
            className={`text-center ${isInView ? `animate-fade-in-up delay-${(i + 1) * 100}` : 'opacity-0'}`}
          >
            <div className="text-[28px] font-medium text-[#051A24] font-mondwest">
              {stat.value}
              {stat.suffix || ''}
            </div>
            <div className="text-xs text-[#273C46] mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      <Divider />

      {/* Photo wall */}
      <h2 className="text-2xl font-medium text-[#051A24] mb-6">
        <span className="font-mondwest">活动</span>剪影
      </h2>
      {!photos.length && <p className="text-sm text-[var(--theme-text)]">活动照片整理中，敬请期待。</p>}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {photos.map((src, index) => (
          <img
            key={`${src}-${index}`}
            src={src}
            alt={`活动照片 ${index + 1}`}
            className="rounded-2xl object-cover aspect-square hover:scale-[1.02] transition-transform"
            loading="lazy"
            onError={handleImageError}
          />
        ))}
      </div>
    </div>
  )
}
