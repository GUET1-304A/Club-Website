import { Mail } from 'lucide-react'
import GithubIcon from '../ui/GithubIcon'
import Logo from '../ui/Logo'

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
  return (
    <footer className="border-t border-[rgba(0,0,0,0.08)]">
      <div className="max-w-[1200px] mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          {/* Left - Logo + description */}
          <div>
            <a href="/" className="flex items-center gap-3 mb-4">
              <Logo size="md" />
              <span className="text-lg font-medium text-[#051A24]" style={{ fontFamily: "'PP Neue Montreal', 'Noto Sans SC', sans-serif", fontWeight: 500 }}>
                星雨作坊
              </span>
            </a>
            <p className="text-sm text-[#273C46] leading-relaxed max-w-xs">
              星雨作坊是一个由学生自主运营的开发社团。我们相信，每一行代码背后都藏着改变世界的力量。
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
                href="https://github.com/xingyu-studio"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-[#273C46] hover:text-[#051A24] transition-colors"
              >
                <GithubIcon className="w-4 h-4" />
                GitHub
              </a>
              <a
                href="mailto:hello@xingyu.studio"
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
          <span className="text-xs text-[#273C46]">以协作连接灵感，以开源延续成长。</span>
        </div>
      </div>
    </footer>
  )
}
