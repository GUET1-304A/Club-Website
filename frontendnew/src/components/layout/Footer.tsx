import { Mail } from 'lucide-react'
import GithubIcon from '../ui/GithubIcon'
import Logo from '../ui/Logo'
import { useSiteData } from '../../store/useSiteData'

const quickLinks = [
  { label: '关于我们', href: '/about' },
  { label: '研究方向', href: '/research' },
  { label: '合作交流', href: '/cooperation' },
  { label: '成员风采', href: '/members' },
  { label: '项目作品', href: '/projects' },
  { label: '开源精神', href: '/open-source' },
  { label: '加入社团', href: '/join' },
  { label: '联系我们', href: '/contact' },
]

export default function Footer() {
  const { config } = useSiteData()
  const brand = config.siteName || '星雨作坊'
  const description = config.footerDescription
  const githubUrl = config.footerGithub || 'https://github.com/xingyu-studio'
  const email = config.footerEmail || 'hello@xingyu.studio'
  const icpNumber = config.icp?.number?.trim()
  const icpUrl = config.icp?.url?.trim() || 'https://beian.miit.gov.cn/'
  const policeNumber = config.icp?.police_number?.trim()
  const policeUrl = config.icp?.police_url?.trim() || 'https://beian.mps.gov.cn/'

  return (
    <footer className="border-t border-[rgba(0,0,0,0.08)]">
      <div className="max-w-[1200px] mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          {/* Left - Logo + description */}
          <div>
            <a href="/" className="flex items-center gap-3 mb-4">
              <Logo size="md" />
              <span className="text-lg font-medium text-[#051A24]" style={{ fontFamily: "var(--font-sans)", fontWeight: 500 }}>
                {brand}
              </span>
            </a>
            <p className="text-sm text-[#273C46] leading-relaxed max-w-xs">
              {description}
            </p>
          </div>

          {/* Middle - Quick links */}
          <div>
            <h4 className="text-sm font-medium text-[#051A24] mb-4">快速链接</h4>
            <div className="flex flex-col gap-2">
              {quickLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-sm text-[#273C46] hover:text-[#051A24] transition-colors"
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>

          {/* Right - Contact */}
          <div>
            <h4 className="text-sm font-medium text-[#051A24] mb-4">联系我们</h4>
            <div className="flex flex-col gap-3">
              <a
                href={githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-[#273C46] hover:text-[#051A24] transition-colors"
              >
                <GithubIcon className="w-4 h-4" />
                GitHub
              </a>
              <a
                href={`mailto:${email}`}
                className="flex items-center gap-2 text-sm text-[#273C46] hover:text-[#051A24] transition-colors"
              >
                <Mail className="w-4 h-4" />
                Email
              </a>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-[rgba(0,0,0,0.08)] mt-12 pt-6 flex flex-col sm:flex-row justify-between gap-2">
          <span className="text-xs text-[#273C46]">© 2026 星雨作坊 Xingyu Studio</span>
          <span className="text-xs text-[#273C46]">{config.footerText}</span>
        </div>

        {/* 备案信息 — 工信部要求备案号在首页可见且可点击跳转 */}
        {(icpNumber || policeNumber) && (
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#273C46]/70">
            {icpNumber && (
              <a
                href={icpUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[#051A24] transition-colors"
              >
                {icpNumber}
              </a>
            )}
            {policeNumber && (
              <a
                href={policeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[#051A24] transition-colors"
              >
                {policeNumber}
              </a>
            )}
          </div>
        )}
      </div>
    </footer>
  )
}
