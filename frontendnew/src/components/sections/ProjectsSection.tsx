import { useInViewAnimation } from '../../hooks/useInViewAnimation'
import Button from '../ui/Button'
import FolderGallery from '../ui/FolderGallery'

export default function ProjectsSection() {
  const { ref, isInView } = useInViewAnimation({ threshold: 0.05 })

  return (
    <section ref={ref} className="max-w-[1100px] mx-auto px-6 py-20 md:py-28">
      {/* Header — left aligned */}
      <div className="mb-2 pl-4 md:pl-12">
        <p
          className={`font-mono text-sm text-[#051A24] tracking-widest uppercase mb-4 ${
            isInView ? 'animate-fade-in-up delay-100' : 'opacity-0'
          }`}
        >
          WORKS
        </p>
        <h2
          className={`text-[28px] md:text-[36px] text-[#051A24] ${
            isInView ? 'animate-fade-in-up delay-200' : 'opacity-0'
          }`}
        >
          我们的<span className="font-mondwest">作品</span>
        </h2>
      </div>

      {/* Folder gallery */}
      <FolderGallery />

      {/* CTA */}
      <div className="text-center mt-2">
        <Button variant="tertiary" href="/projects">
          查看全部作品 →
        </Button>
      </div>
    </section>
  )
}
