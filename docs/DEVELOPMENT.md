# 星雨作坊官网 v2 — 开发文档

## 一、项目概述

基于 `base_web` 的业务逻辑与内容数据，重新设计并实现的星雨作坊官网。采用 **「暖米 Warm Cream」** 设计主题，奶油色底色搭配暖陶土/琥珀/珊瑚色系，融合现代卡片设计与丰富微交互。

---

## 二、技术栈

| 类别 | 技术 | 版本 | 用途 |
|------|------|------|------|
| 框架 | Vue 3 | 3.5+ | Composition API + `<script setup>` |
| 构建 | Vite | 6.x | 开发服务器 + 构建 |
| 路由 | Vue Router | 4.x | SPA 路由（14 条懒加载路由） |
| CSS | Tailwind CSS | 4.x | 原子化样式（通过 `@tailwindcss/vite` 插件） |
| 动画 | GSAP | 3.12+ | ScrollTrigger + 页面转场 |
| 图标 | Lucide Vue | 0.468+ | 图标库 |
| 状态 | Pinia | 2.x | 全局状态管理（站点配置） |
| Markdown | marked | 15.x | Markdown 渲染 |

---

## 三、设计系统：「暖米 Warm Cream」

### 色彩体系

```css
:root {
  /* 暖色调色板 */
  --warm-terracotta: #c06040;   /* 陶土红（主强调） */
  --warm-amber: #d4920a;        /* 琥珀金 */
  --warm-coral: #e07050;        /* 珊瑚橘 */
  --warm-sage: #7a9a6a;         /* 鼠尾草绿 */
  --warm-brown: #8b7355;        /* 暖棕 */
  --warm-rose: #c07080;         /* 玫瑰粉 */

  /* 渐变组合 */
  --grad-primary: linear-gradient(135deg, var(--warm-terracotta), var(--warm-coral));
  --grad-warm: linear-gradient(135deg, var(--warm-amber), var(--warm-coral));
  --grad-cool: linear-gradient(135deg, var(--warm-sage), var(--warm-brown));

  /* 底色 */
  --bg: #faf7f2;                /* 奶油白 */
  --bg-soft: #f5f0e8;           /* 柔和底色 */
  --glass-border: rgba(0,0,0,0.08);
  --glass-border-hover: rgba(0,0,0,0.15);

  /* 文字 */
  --text-primary: #2c2520;
  --text-secondary: #6b5e52;
  --text-muted: #a09080;

  /* 字体 */
  --font-heading: 'Space Grotesk', 'Noto Sans SC', sans-serif;
  --font-body: 'Noto Sans SC', 'Inter', sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;

  /* 阴影 */
  --shadow-sm: 0 2px 12px rgba(120, 90, 60, 0.06);
  --shadow-md: 0 4px 20px rgba(120, 90, 60, 0.08);
  --shadow-lg: 0 8px 36px rgba(120, 90, 60, 0.1);
  --shadow-xl: 0 16px 56px rgba(120, 90, 60, 0.14);

  /* 圆角 */
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 24px;
}
```

### 卡片悬浮效果（全局统一）

所有卡片（PaperCard + 各页面自定义卡片）使用统一悬浮效果：

- 上移 `translateY(-12px)` + 放大 `scale(1.03)`
- 阴影加深至 `0 24px 64px rgba(120, 90, 60, 0.14)`
- 边框变为对应强调色
- 背后光晕扩散（radial-gradient 渐显）
- 底部彩色线条渐显
- 缓动曲线 `cubic-bezier(0.22, 1, 0.36, 1)`

---

## 四、路由结构

```
路由表
├── /                    → HomeView            首页
├── /about               → AboutView           关于我们
├── /members             → MembersView         成员展示
├── /projects            → ProjectsView        项目画廊
├── /projects/awards     → AwardsView          比赛奖项
├── /awards/:slug        → AwardDetailView     奖项详情
├── /project/:slug       → ProjectDetailView   项目详情
├── /blog                → BlogView            博客动态
├── /join                → JoinView            加入申请
├── /recruitment         → RecruitmentView     招新信息
├── /open-source         → OpenSourceView      开源精神
├── /timeline            → TimelineView        时间线
├── /onboarding          → OnboardingView      新手指南
├── /yuji                → YujiView            雨记协作板
└── /:pathMatch(.*)*     → 重定向到 /
```

所有视图组件通过动态 `import()` 懒加载。路由使用 HTML5 history 模式，支持 hash 锚点平滑滚动。

---

## 五、项目结构

```
src/
├── App.vue                          # 根组件（InkBg + LineDogPet + Navbar + 转场路由 + Footer）
├── main.js                          # 入口（挂载 Pinia、Router）
├── style.css                        # 全局样式 + Tailwind + CSS 变量
│
├── components/
│   ├── layout/
│   │   ├── Navbar.vue               # 顶部导航（白底 + 图片 logo + 动画下划线）
│   │   └── Footer.vue               # 底部信息
│   │
│   ├── effects/
│   │   ├── InkBg.vue                # 暖色渐变背景 + 对角线纹理
│   │   ├── CountUp.vue              # 数字跳动动画
│   │   └── LineDogPet.vue           # 线条小狗桌宠（随机走动 + 骰子导航）
│   │
│   ├── ui/
│   │   ├── PaperCard.vue            # 通用卡片（支持 glow 光晕效果）
│   │   ├── TagPill.vue              # 标签胶囊
│   │   ├── InkDivider.vue           # 墨线分隔符
│   │   └── MarkdownRenderer.vue     # Markdown 渲染
│   │
│   └── sections/                    # 首页章节组件
│       ├── HeroSection.vue          # Hero 区域（双旋转环 + 浮动卡片 + 光球）
│       ├── AboutSection.vue         # 社团简介（卡片光晕 + 角标装饰）
│       ├── MembersSection.vue       # 人员介绍（四组卡片 + 网格背景）
│       ├── ProductsSection.vue      # 产品展示（水平轮播 + 点击跳转详情）
│       ├── AwardsSection.vue        # 比赛奖项（年份分组 + 类别标签）
│       └── OpenSourceSection.vue    # 开源精神（点阵背景 + 社区横幅）
│
├── views/
│   ├── HomeView.vue                 # 首页（组装 6 个 Section）
│   ├── AboutView.vue                # 关于页
│   ├── MembersView.vue              # 成员页（组别筛选 + 搜索 + 加载更多）
│   ├── ProjectsView.vue             # 项目页（分类筛选 + 搜索 + 奖项区域）
│   ├── ProjectDetailView.vue        # 项目详情（封面 + 双栏布局 + 侧边栏）
│   ├── AwardsView.vue               # 奖项列表（年份分组 + 类别筛选）
│   ├── AwardDetailView.vue          # 奖项详情（双栏布局）
│   ├── BlogView.vue                 # 博客（分类筛选 + 搜索 + 加载更多）
│   ├── OpenSourceView.vue           # 开源仓库（加载更多 + 贡献者）
│   ├── JoinView.vue                 # 加入申请（三步表单 + 表单验证）
│   ├── RecruitmentView.vue          # 招新信息
│   ├── TimelineView.vue             # 时间线
│   ├── OnboardingView.vue           # 新手指南
│   └── YujiView.vue                 # 雨记协作板
│
├── composables/
│   ├── useInkReveal.js              # 首页 section 滚动揭示动画
│   └── useScrollReveal.js           # 子页面通用滚动入场
│
├── stores/
│   └── siteConfig.js                # Pinia store（站点配置 + 页面数据）
│
├── data/
│   ├── defaultConfig.js             # 站点配置默认数据
│   └── defaultPages.js              # 页面内容默认数据（14 个页面）
│
├── router/
│   └── index.js                     # 路由定义（14 条路由 + 404 重定向）
│
└── assets/
    └── logo.png                     # 站点 logo 图片
```

---

## 六、核心交互设计

### 6.1 页面转场

GSAP 驱动的 `out-in` 模式转场：

```javascript
onBeforeEnter: opacity: 0, y: 24
onEnter:       opacity: 1, y: 0, 0.45s, power2.out
onLeave:       opacity: 0, y: -16, 0.2s, power2.in
```

### 6.2 线条小狗桌宠（LineDogPet）

固定定位的 SVG 小狗，具有以下功能：

- **随机走动**：页面加载 3 秒后开始在视口内随机移动，走到目标后休息 2~6 秒再出发
- **行走动画**：上下弹跳 + 前后腿交替 + 尾巴加速摇摆
- **自动转身**：根据移动方向水平翻转 SVG
- **滚动靠边**：用户滚动页面时，小狗移到最近的侧边（左侧/右侧），待在原地不动；滚动停止 2 秒后恢复自由走动
- **骰子导航**：点击打开菜单，可"投骰子"随机跳转到 8 个页面之一
- **菜单方向自适应**：根据小狗在视口中的位置，菜单自动选择上下左右弹出方向，避免超出页面
- **待机动画**：眨眼（ry 属性动画）、耳朵抖动、尾巴摇摆、头顶呆毛

### 6.3 卡片光晕效果（PaperCard）

PaperCard 组件支持 `glow` prop，传入 CSS 颜色值后启用：

- 背后 radial-gradient 光晕扩散（0.04 → 0.15 opacity）
- 底部彩色线条渐显（0 → 1 opacity）
- 边框变为对应强调色

各页面使用不同的强调色：

| 页面 | 光晕颜色 |
|------|---------|
| 成员风采 | terracotta |
| 博客动态 | amber |
| 开源仓库 | sage |
| 比赛奖项 | amber |
| 作品展示 | coral |
| 关于社团 | terracotta / amber |
| 招新详情 | coral |
| 入门引导 | terracotta / sage / amber |
| 时间线 | terracotta |
| 雨记协作板 | coral |
| 加入我们（福利卡） | sage |

### 6.4 列表页通用模式

所有列表页面（成员、项目、博客、开源、奖项）使用统一模式：

- **分类筛选**：胶囊标签栏，选中态渐变背景
- **搜索框**：圆形输入框，聚焦时宽度扩展
- **加载更多**：分页加载，PAGE_SIZE = 6
- **空状态提示**

### 6.5 表单验证（JoinView）

三步表单，实时验证：

- 姓名：必填，≥ 2 字符
- 学号：必填，6-12 位数字
- 年级专业：必填
- 手机：必填，11 位手机号格式
- 邮箱：必填，标准邮箱格式
- 组别：必选
- 申请动机：必填，≥ 10 字

错误状态：红色边框 + 错误提示文字

---

## 七、数据层

### 数据来源

首期采用本地默认数据，通过 Pinia store 管理：

```javascript
// stores/siteConfig.js
state: {
  config: { ...defaultSiteConfig },  // 站点配置
  pages: { ...defaultPages },         // 页面内容
  loaded: true
}
getters: {
  hero, about, members, products, openSource, footer, getPage(slug)
}
```

### 数据模块

| 数据 | 来源 | 对应页面 |
|------|------|----------|
| hero | config.hero | 首页 Hero |
| about | config.about | 首页 About + /about |
| members | config.members | 首页 Members + /members |
| products | config.products | 首页 Products + /projects |
| openSource | config.openSource | 首页 OpenSource + /open-source |
| footer | config.footer | 全局 Footer |
| 页面内容 | pages[slug] | 各子页面 |

---

## 八、依赖安装

```bash
npm create vite@latest . -- --template vue
npm install vue-router@4 pinia gsap lucide-vue-next marked
npm install -D tailwindcss@4 @tailwindcss/vite
```

### 关键配置

**vite.config.js**

```javascript
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'url'

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) }
  },
  server: {
    port: 3000,
    proxy: {
      '/api': { target: 'http://localhost:5000', changeOrigin: true },
      '/uploads': { target: 'http://localhost:5000', changeOrigin: true }
    }
  }
})
```

**index.html 字体引入**

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;700&family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">
```

---

## 九、后端服务

### 技术栈

| 类别 | 技术 | 用途 |
|------|------|------|
| 框架 | Flask 3.0 | Web 服务 |
| ORM | Flask-SQLAlchemy | 数据库操作 |
| 认证 | Flask-JWT-Extended | 管理员 JWT 认证 |
| 跨域 | Flask-CORS | 开发环境跨域 |
| 数据库 | SQLite | 首期默认存储 |

### 后端结构

```
backend/
├── app.py              # Flask 应用工厂
├── config.py           # 配置类
├── models.py           # SiteConfig / Page / Application / AdminUser
├── defaults.py         # 默认数据
├── requirements.txt    # Python 依赖
└── routes/
    └── api.py          # 公开 + 管理 API
```

### API 端点

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| GET | `/api/config` | 站点配置 | 无 |
| GET | `/api/pages` | 页面列表 | 无 |
| GET | `/api/pages/<slug>` | 页面详情 | 无 |
| POST | `/api/applications` | 提交申请 | 无 |
| POST | `/api/admin/login` | 管理员登录 | 无 |
| GET | `/api/admin/me` | 当前用户 | JWT |
| GET/PUT | `/api/admin/config` | 配置管理 | JWT |
| GET/POST/PUT/DELETE | `/api/admin/pages` | 页面管理 | JWT |
| GET/PATCH/DELETE | `/api/admin/applications` | 申请管理 | JWT |
| GET/POST | `/api/admin/export/import` | 数据导入导出 | JWT |
| POST | `/api/admin/upload-image` | 上传图片 (OSS/本地) | JWT |
| POST | `/api/admin/reset-all` | 重置为默认 | JWT |

### 前端 API 服务

`src/services/api.js` 封装了所有 API 调用：

- `getSiteConfig()` — 获取站点配置，失败时回退到本地默认数据
- `getPage(slug)` — 获取页面内容，失败时回退到本地默认数据
- `submitApplication(payload)` — 提交加入申请
- `login/logout/isLoggedIn` — 管理员认证
- 其他管理端 API 方法

### 数据流

1. 前端启动时，Pinia store 先用本地默认数据渲染页面
2. 异步请求 API 获取最新数据，获取成功则覆盖默认数据
3. API 不可用时（后端未启动），前端仍可正常运行

---

## 十、开发命令

### 前端

```bash
npm run dev       # 启动开发服务器 (localhost:3000)
npm run build     # 生产构建
npm run preview   # 预览构建结果
```

### 后端

```bash
cd backend
pip install -r requirements.txt
python app.py     # 启动 Flask 服务 (localhost:5000)
```



---

## 十一、Docker 部署

### 一键启动

```bash
docker compose up -d --build
```

启动后访问 `http://localhost` 即可。

### 架构

| 容器 | 说明 | 端口 |
|------|------|------|
| xingyu-frontend | nginx 提供前端静态文件 + 反向代理 | 80 |
| xingyu-backend | Flask + gunicorn API 服务 | 5000 (内部) |

### 数据持久化

| Volume | 用途 |
|--------|------|
| db-data | SQLite 数据库 |
| upload-data | 上传的图片文件 |

### 环境变量

在项目根目录创建 `.env` 文件可自定义配置：

```bash
SECRET_KEY=your-secret-key
JWT_SECRET_KEY=your-jwt-secret
PORT=80
```

### 常用命令

```bash
docker compose up -d          # 启动
docker compose down            # 停止
docker compose logs -f         # 查看日志
docker compose up -d --build   # 重新构建并启动
```
