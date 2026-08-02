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
  return (
    <div className="hidden lg:block fixed inset-0 pointer-events-none z-[5]" aria-hidden="true">
      {/* ===== LEFT — Docker / Git / Linux ===== */}
      <div className="absolute left-6 top-24 select-none space-y-16">
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
      <div className="absolute right-6 top-24 select-none space-y-16">
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
