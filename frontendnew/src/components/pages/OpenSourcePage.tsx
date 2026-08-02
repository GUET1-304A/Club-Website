import { Star, GitFork } from 'lucide-react'
import GithubIcon from '../ui/GithubIcon'
import Card from '../ui/Card'

const repos = [
  { name: 'campus-hub', desc: '校园综合服务平台', lang: 'TypeScript', stars: 128, forks: 36 },
  { name: 'ai-writer', desc: 'AI 智能写作助手', lang: 'Python', stars: 256, forks: 52 },
  { name: 'miniapp-toolkit', desc: '校园工具箱小程序', lang: 'TypeScript', stars: 89, forks: 21 },
]

export default function OpenSourcePage() {
  return (
    <div className="page-enter max-w-[1000px] mx-auto px-6 py-24">
      <h1 className="text-[36px] md:text-[44px] font-medium text-[#051A24] text-center">
        开源<span className="font-mondwest">精神</span>
      </h1>

      <div className="text-center mt-6 mb-12">
        <p className="text-sm md:text-base text-[#0D212C] max-w-lg mx-auto leading-relaxed">
          我们相信开源的力量。所有项目代码在 GitHub 上公开，欢迎 Star、PR 与交流。
        </p>
        <a href="https://github.com/xingyu-studio" target="_blank" rel="noopener noreferrer"
          className="btn-primary inline-flex mt-6 gap-2">
          <GithubIcon className="w-4 h-4" /> 访问 GitHub
        </a>
      </div>

      <div className="space-y-6 mt-12">
        {repos.map((repo) => (
          <Card key={repo.name} className="p-6 !rounded-[32px]">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-medium text-[#051A24]">{repo.name}</h3>
                <p className="text-sm text-[#273C46] mt-1">{repo.desc}</p>
                <span className="inline-block mt-3 text-xs px-2 py-0.5 rounded-full bg-[#051A24]/5 text-[#273C46]">{repo.lang}</span>
              </div>
              <div className="flex gap-4 text-sm text-[#273C46]">
                <span className="flex items-center gap-1"><Star className="w-4 h-4" /> {repo.stars}</span>
                <span className="flex items-center gap-1"><GitFork className="w-4 h-4" /> {repo.forks}</span>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
