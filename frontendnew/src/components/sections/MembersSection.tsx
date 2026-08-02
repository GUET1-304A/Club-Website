import { useInViewAnimation } from '../../hooks/useInViewAnimation'
import Button from '../ui/Button'
import CircularCards from '../ui/CircularCards'
import { useSiteData } from '../../store/useSiteData'
import type { Testimonial } from '../ui/CircularCards'

export default function MembersSection() {
  const { ref, isInView } = useInViewAnimation({ threshold: 0.05 })
  const { members } = useSiteData()

  const memberTestimonials: Testimonial[] = members.map((m) => ({
    quote: m.bio || '热爱技术，乐于分享，用代码创造价值。',
    name: m.name,
    designation: `${m.role} · ${m.grade}`,
    src: m.avatar,
  }))

  return (
    <section ref={ref} className="max-w-[1400px] mx-auto px-6 py-20 md:py-28">
      {/* Header — left aligned */}
      <div className="mb-10 pl-4 md:pl-12">
        <p
          className={`font-mono text-sm text-[#051A24] tracking-widest uppercase mb-4 ${
            isInView ? 'animate-fade-in-up delay-100' : 'opacity-0'
          }`}
        >
          TEAM
        </p>
        <h2
          className={`text-[28px] md:text-[36px] text-[#051A24] ${
            isInView ? 'animate-fade-in-up delay-200' : 'opacity-0'
          }`}
        >
          我们的<span className="font-mondwest">成员</span>
        </h2>
      </div>

      {/* Circular carousel */}
      <CircularCards testimonials={memberTestimonials} autoplay={true} />

      {/* CTA */}
      <div className="text-center mt-12">
        <Button variant="tertiary" href="/members">
          查看全部成员 →
        </Button>
      </div>
    </section>
  )
}
