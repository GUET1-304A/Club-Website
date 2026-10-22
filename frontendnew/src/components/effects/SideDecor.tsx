import { useEffect, useRef } from 'react'

const leftSnippets = [
  `# Dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]`,

  `# docker-compose.yml
services:
  web:
    build: .
    ports:
      - "80:3000"
    volumes:
      - ./data:/app/data
    restart: unless-stopped`,

  `# Git 常用命令
git init
git add .
git commit -m "feat: init"
git branch -M main
git remote add origin <url>
git push -u origin main
git log --oneline --graph`,

  `# Linux
ps aux | grep node
chmod +x deploy.sh
systemctl restart nginx
tail -f /var/log/nginx/access.log
crontab -e
df -h`,
]

const rightSnippets = [
  `// TypeScript
interface Member {
  id: string
  name: string
  role: "frontend" | "backend"
  skills: string[]
  joinDate: Date
}

const team: Member[] = [
  { name: "星雨", role: "frontend",
    skills: ["React", "Vue"] },
]`,

  `# Python
def fibonacci(n: int) -> int:
    if n <= 1:
        return n
    a, b = 0, 1
    for _ in range(n - 1):
        a, b = b, a + b
    return b

print(fibonacci(10))  # 55`,

  `-- SQL
CREATE TABLE members (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(50) NOT NULL,
  grade      VARCHAR(10),
  joined_at  TIMESTAMP DEFAULT NOW()
);

SELECT name, grade
FROM members
WHERE grade = '2024级'
ORDER BY joined_at DESC;`,

  `# Rust
fn main() {
    let team = vec!["前端", "后端",
                    "算法", "设计"];
    for role in &team {
        println!("招募: {}", role);
    }
}`,
]

export default function SideDecor() {
  const decorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const content = document.querySelector<HTMLElement>('[data-public-content]')
    const decor = decorRef.current
    if (!content || !decor) return

    let frame = 0
    const update = () => {
      frame = 0
      const page = content.firstElementChild
      if (!page) return
      // Respect the widest visible block, including full-width carousels.
      const regions = page.classList.contains('site-home')
        ? Array.from(page.children)
        : [page]
      const footer = content.lastElementChild
      const footerTop = footer && footer !== page ? footer.getBoundingClientRect().top : window.innerHeight
      decor.style.clipPath = `inset(0 0 ${Math.max(0, window.innerHeight - footerTop)}px 0)`
      let left = document.documentElement.clientWidth
      let right = 0
      let visible = false
      for (const region of regions) {
        const rect = region.getBoundingClientRect()
        if (rect.bottom <= 100 || rect.top >= window.innerHeight) continue
        const safeContent = region.querySelector<HTMLElement>('[data-decor-safe-content]') || region
        const bounds = safeContent.getBoundingClientRect()
        visible = true
        left = Math.min(left, bounds.left)
        right = Math.max(right, bounds.right)
      }
      const leftSpace = visible ? Math.max(0, left - 32) : 0
      const rightSpace = visible ? Math.max(0, document.documentElement.clientWidth - right - 32) : 0
      decor.style.setProperty('--decor-left-space', `${leftSpace >= 48 ? leftSpace : 0}px`)
      decor.style.setProperty('--decor-right-space', `${rightSpace >= 48 ? rightSpace : 0}px`)
    }
    const schedule = () => { if (!frame) frame = window.requestAnimationFrame(update) }
    const resize = new ResizeObserver(schedule)
    const mutations = new MutationObserver(schedule)
    resize.observe(content)
    mutations.observe(content, { childList: true, subtree: true })
    window.addEventListener('resize', schedule)
    window.addEventListener('scroll', schedule, { passive: true })
    schedule()
    return () => {
      window.cancelAnimationFrame(frame)
      resize.disconnect()
      mutations.disconnect()
      window.removeEventListener('resize', schedule)
      window.removeEventListener('scroll', schedule)
    }
  }, [])

  return (
    <div ref={decorRef} className="side-decor fixed inset-0 pointer-events-none z-0" aria-hidden="true">
      {/* ===== LEFT — Docker / Git / Linux ===== */}
      <div className="side-decor-column side-decor-left absolute top-28 select-none space-y-16">
        {leftSnippets.map((code, i) => (
          <pre
            key={i}
            className="text-[11px] text-[#051A24]/20 leading-[1.7] font-mono whitespace-pre"
          >
            {code}
          </pre>
        ))}
      </div>

      {/* ===== RIGHT — TS / Python / SQL / Rust ===== */}
      <div className="side-decor-column side-decor-right absolute top-28 select-none space-y-16">
        {rightSnippets.map((code, i) => (
          <pre
            key={i}
            className="text-[11px] text-[#051A24]/20 leading-[1.7] font-mono whitespace-pre"
          >
            {code}
          </pre>
        ))}
      </div>
    </div>
  )
}
