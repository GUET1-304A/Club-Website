import { useState, useEffect } from 'react'
import { Trophy, Users, Building, Calendar, ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react'
import Card from '../ui/Card'
import TagPill from '../ui/TagPill'
import Markdown from '../ui/Markdown'
import { useSiteData } from '../../store/useSiteData'
import { fetchAward } from '../../services/api'
import { mapApiAward } from '../../store/useSiteData'
import type { Award } from '../../types'

const LEVEL_LABELS: Record<Award['level'], string> = {
  national: '国家级', provincial: '省级', school: '校级', other: '其他',
}

export default function AwardDetailPage({ slug }: { slug: string }) {
  const { awards: storeAwards } = useSiteData()
  const [award, setAward] = useState<Award | null>(
    () => storeAwards.find(a => a.slug === slug) || null
  )
  const [loading, setLoading] = useState(!award)
  const [certIndex, setCertIndex] = useState(0)

  useEffect(() => {
    if (award) return
    let cancelled = false
    fetchAward(slug)
      .then(data => {
        if (!cancelled) {
          setAward(mapApiAward(data))
          setLoading(false)
        }
      })
      .catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [slug])

  if (loading) {
    return (
      <div className="page-enter max-w-[900px] mx-auto px-6 py-24 animate-pulse">
        <div className="h-8 w-2/3 bg-[#f0ece6] rounded-xl mb-4" />
        <div className="h-4 w-1/3 bg-[#f0ece6] rounded-lg mb-8" />
        <div className="h-48 bg-[#f0ece6] rounded-[32px]" />
      </div>
    )
  }

  if (!award) {
    return (
      <div className="page-enter max-w-[900px] mx-auto px-6 py-24 text-center">
        <h1 className="text-3xl font-medium text-[#051A24]">奖项未找到</h1>
        <a href="/awards" className="btn-tertiary mt-6 inline-flex items-center gap-1.5"><ArrowLeft className="w-4 h-4" /> 返回奖项列表</a>
      </div>
    )
  }

  return (
    <div className="page-enter max-w-[900px] mx-auto px-6 py-24">
      {/* Back link */}
      <a href="/awards" className="inline-flex items-center gap-1.5 text-sm text-[#273C46]/50 hover:text-[#051A24] transition-colors mb-8">
        <ArrowLeft className="w-3.5 h-3.5" /> 返回奖项
      </a>

      <h1 className="text-3xl md:text-4xl font-medium text-[#051A24] tracking-tight">{award.name}</h1>

      <div className="flex gap-3 mt-4 flex-wrap">
        <TagPill label={LEVEL_LABELS[award.level]} />
        {award.category && <TagPill label={award.category} />}
      </div>

      {/* Certificate images carousel */}
      {award.certificateImages.length > 0 && (
        <div className="mt-8 relative">
          <div className="w-full h-[300px] md:h-[400px] rounded-[32px] overflow-hidden shadow-lg bg-[#f8f7f5]">
            <img
              src={award.certificateImages[certIndex]}
              alt={`证书 ${certIndex + 1}`}
              className="w-full h-full object-contain"
            />
          </div>
          {award.certificateImages.length > 1 && (
            <>
              <button
                onClick={() => setCertIndex(i => (i - 1 + award.certificateImages.length) % award.certificateImages.length)}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 backdrop-blur-sm shadow-md flex items-center justify-center hover:bg-white transition-all text-[#051A24]"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => setCertIndex(i => (i + 1) % award.certificateImages.length)}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 backdrop-blur-sm shadow-md flex items-center justify-center hover:bg-white transition-all text-[#051A24]"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
              <div className="flex justify-center gap-1.5 mt-3">
                {award.certificateImages.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCertIndex(i)}
                    className={`w-2 h-2 rounded-full transition-all ${i === certIndex ? 'bg-[#051A24] w-5' : 'bg-[#273C46]/20 hover:bg-[#273C46]/40'}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-[1fr_280px] gap-12 mt-10">
        {/* Left */}
        <div className="space-y-6 min-w-0">
          {award.description && (
            <div>
              <h3 className="text-sm font-medium text-[#273C46] mb-2">详情</h3>
              <div className="text-sm md:text-base text-[#0D212C] leading-relaxed">
                <Markdown content={award.description} />
              </div>
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <Card className="p-6 !rounded-[24px] h-fit space-y-3">
          <div className="flex items-center gap-2 text-sm text-[#273C46]">
            <Trophy className="w-4 h-4" /> {LEVEL_LABELS[award.level]}
          </div>
          <div className="flex items-center gap-2 text-sm text-[#273C46]">
            <Users className="w-4 h-4" /> {award.winner}
          </div>
          {award.issuer && (
            <div className="flex items-center gap-2 text-sm text-[#273C46]">
              <Building className="w-4 h-4" /> {award.issuer}
            </div>
          )}
          <div className="flex items-center gap-2 text-sm text-[#273C46]">
            <Calendar className="w-4 h-4" /> {award.date}
          </div>
          {award.relatedProject && (
            <a href={`/project/${award.relatedProject}`}
              className="block mt-4 pt-4 border-t border-[rgba(0,0,0,0.08)] text-sm font-medium text-[#051A24] hover:opacity-70 transition-opacity">
              查看相关项目 →
            </a>
          )}
        </Card>
      </div>
    </div>
  )
}
