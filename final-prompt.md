# 星雨作坊官网 — 最终 UI 设计提示词

为星雨作坊（Xingyu Studio）学生开发社团构建完整官网。采用**白色极简主义**设计语言，深色文字、精致阴影、衬线 accent 字体与大圆角卡片构成核心视觉识别。使用 React 19 + TypeScript + Vite + Tailwind CSS 4 + lucide-react 实现。

---

## 一、技术栈

| 类别 | 技术 | 用途 |
|------|------|------|
| 框架 | React 19 | Hooks + 函数组件 |
| 构建 | Vite 8 | 开发服务器 + 生产构建 |
| 语言 | TypeScript 6 | 类型安全 |
| CSS | Tailwind CSS 4 | `@tailwindcss/vite` 插件 |
| 动画 | CSS Keyframes + IntersectionObserver | 滚动入场 + 视差 |
| 图标 | lucide-react | 图标库 |
| 状态 | React Context | 站点配置 |

---

## 二、设计系统

### 2.1 色彩

```css
:root {
  /* 深色 */
  --dark-primary: #051A24;     /* 最深 — 标题、正文 */
  --dark-secondary: #0D212C;   /* 次深 — 副标题 */
  --dark-muted: #273C46;       /* 弱化文字 */

  /* 浅色（用于深色背景上的文字） */
  --light-primary: #F6FCFF;
  --light-secondary: #E0EBF0;

  /* 底色 */
  --bg: #FFFFFF;               /* 全局纯白背景 */

  /* 边框 */
  --border: rgba(0, 0, 0, 0.08);
  --border-hover: rgba(0, 0, 0, 0.15);
}
```

**配色原则：** 页面纯白底，文字仅使用 `#051A24` / `#0D212C` / `#273C46` 三个深色层级。**无额外彩色点缀**——视觉层次完全通过字体对比（PP Mondwest 衬线 vs PP Neue Montreal 无衬线）、阴影深度和间距来建立。按钮主色为 `#051A24` 深色实心，次级为白底。整体保持极致克制，让内容本身成为视觉焦点。

### 2.2 字体

```css
/* PP Neue Montreal — 正文字体，从 Webflow CDN 加载 */
@font-face {
  font-family: 'PP Neue Montreal';
  src: url('https://assets.website-files.com/6009ec8cda7f305645c9d91b/60176f9bb43e36419997ecfe_PPNeueMontreal-Book.otf') format('opentype');
  font-weight: 400;
  font-display: swap;
}
@font-face {
  font-family: 'PP Neue Montreal';
  src: url('https://assets.website-files.com/6009ec8cda7f305645c9d91b/60176f9b39c5673e51a86f5a_PPNeueMontreal-Medium.otf') format('opentype');
  font-weight: 500;
  font-display: swap;
}

/* PP Mondwest — 衬线 accent 字体，本地加载 */
@font-face {
  font-family: 'PP Mondwest';
  src: url('/PPMondwest-Regular.woff2') format('woff2');
  font-weight: 400;
  font-display: swap;
}
```

```css
body {
  font-family: 'PP Neue Montreal', 'Noto Sans SC', system-ui, -apple-system, sans-serif;
  color: #051A24;
  background: #FFFFFF;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* 衬线字体用于标题中的 accent 词汇 */
.font-mondwest {
  font-family: 'PP Mondwest', 'Noto Serif SC', serif;
}

/* 等宽字体用于标签/代码 */
.font-mono {
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
}
```

**字体使用规则：**
- **正文**：PP Neue Montreal（400），中文回退 Noto Sans SC
- **标题中的强调词**：PP Mondwest（400）衬线，中文回退 Noto Serif SC
- **标签/编号/代码**：JetBrains Mono 等宽
- 全局 `tracking-tight`（-0.01em），标题 `tracking-tight`（-0.02em）

### 2.3 按钮系统（Button 组件）

按钮是设计的关键表达。全部 `rounded-full`，使用多层 box-shadow 制造精致悬浮感。

**Primary（主按钮 — 深色实心）：**
```css
.btn-primary {
  background: #051A24;
  color: #FFFFFF;
  border-radius: 9999px;
  padding: 12px 28px;                /* px-7 py-3 */
  font-size: 14px;
  font-weight: 500;
  box-shadow:
    0 1px 2px 0 rgba(5, 26, 36, 0.1),
    0 4px 4px 0 rgba(5, 26, 36, 0.09),
    0 9px 6px 0 rgba(5, 26, 36, 0.05),
    0 17px 7px 0 rgba(5, 26, 36, 0.01),
    0 26px 7px 0 rgba(5, 26, 36, 0),
    inset 0 2px 8px 0 rgba(255, 255, 255, 0.5);
  transition: all 0.3s ease;
}
.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow:
    0 2px 4px 0 rgba(5, 26, 36, 0.15),
    0 8px 8px 0 rgba(5, 26, 36, 0.12),
    0 18px 10px 0 rgba(5, 26, 36, 0.07),
    0 28px 12px 0 rgba(5, 26, 36, 0.03),
    inset 0 2px 8px 0 rgba(255, 255, 255, 0.6);
}
```

**Secondary（次要按钮 — 白底 + 精致阴影）：**
```css
.btn-secondary {
  background: #FFFFFF;
  color: #051A24;
  border-radius: 9999px;
  padding: 12px 28px;
  font-size: 14px;
  font-weight: 500;
  box-shadow:
    0 0 0 0.5px rgba(0, 0, 0, 0.05),
    0 4px 30px rgba(0, 0, 0, 0.08);
  transition: all 0.3s ease;
}
.btn-secondary:hover {
  transform: translateY(-1px);
  box-shadow:
    0 0 0 0.5px rgba(0, 0, 0, 0.08),
    0 8px 40px rgba(0, 0, 0, 0.12);
}
```

**Tertiary（幽灵按钮 — 纯文字链接）：**
```css
.btn-tertiary {
  background: transparent;
  color: #051A24;
  border-radius: 9999px;
  padding: 8px 20px;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.3s ease;
}
.btn-tertiary:hover {
  background: rgba(5, 26, 36, 0.04);
  color: #0D212C;
}
```

**按钮尺寸变体：**
| 尺寸 | padding | 字号 |
|------|---------|------|
| sm | `px-5 py-2` | text-xs (12px) |
| md（默认） | `px-7 py-3` | text-sm (14px) |
| lg | `px-10 py-4` | text-base (16px) |

### 2.4 卡片系统

**基础卡片：**
```css
.card {
  background: #FFFFFF;
  border-radius: 32px;        /* md:rounded-[40px] */
  box-shadow:
    0 4px 16px rgba(0, 0, 0, 0.08);
  transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}
.card:hover {
  transform: translateY(-8px);
  box-shadow:
    0 12px 40px rgba(0, 0, 0, 0.12);
}
```

**深色卡片：**
```css
.card-dark {
  background: #051A24;
  color: #F6FCFF;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.1),
    0 4px 16px rgba(5, 26, 36, 0.2);
}
```

### 2.5 阴影层级

```css
--shadow-xs: 0 1px 2px rgba(0, 0, 0, 0.04);
--shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.06);
--shadow-md: 0 4px 16px rgba(0, 0, 0, 0.08);
--shadow-lg: 0 8px 32px rgba(0, 0, 0, 0.1);
--shadow-xl: 0 16px 48px rgba(0, 0, 0, 0.14);
```

---

## 三、项目文件结构

```
src/
├── App.tsx                          # 根组件（导航 + 页面路由 + 页脚）
├── main.tsx                         # 入口
├── index.css                        # 全局样式 + Tailwind + CSS 变量 + 字体 + 动画
│
├── components/
│   ├── layout/
│   │   ├── Navbar.tsx               # 顶部导航（白底毛玻璃 + 动画下划线）
│   │   └── Footer.tsx               # 页脚
│   │
│   ├── ui/
│   │   ├── Button.tsx               # 按钮（primary/secondary/tertiary + sm/md/lg）
│   │   ├── Card.tsx                 # 通用卡片
│   │   ├── TagPill.tsx              # 标签胶囊
│   │   ├── Divider.tsx              # 细线分隔符
│   │   ├── SearchBox.tsx            # 圆形搜索框（聚焦扩展）
│   │   └── EmptyState.tsx           # 空状态提示
│   │
│   ├── effects/
│   │   └── CountUp.tsx              # 数字跳动动画
│   │
│   ├── sections/                    # 首页各区块
│   │   ├── HeroSection.tsx          # Hero（居中窄栏 + 关键词衬线强调）
│   │   ├── AboutSection.tsx         # 社团简介（双栏）
│   │   ├── MembersSection.tsx       # 成员风采（四列卡片网格）
│   │   ├── ProjectsSection.tsx      # 作品展示（纵向堆叠 + 全宽图片）
│   │   ├── AwardsSection.tsx        # 比赛奖项（年份分组）
│   │   └── JoinSection.tsx          # 加入社团 CTA（居中 + 交互特效）
│   │
│   └── pages/                       # 子页面
│       ├── AboutPage.tsx
│       ├── MembersPage.tsx
│       ├── ProjectsPage.tsx
│       ├── ProjectDetailPage.tsx
│       ├── AwardsPage.tsx
│       ├── AwardDetailPage.tsx
│       ├── BlogPage.tsx
│       ├── OpenSourcePage.tsx
│       ├── JoinPage.tsx
│       ├── RecruitmentPage.tsx
│       ├── TimelinePage.tsx
│       ├── OnboardingPage.tsx
│       └── YujiPage.tsx
│
├── hooks/
│   ├── useInViewAnimation.ts        # IntersectionObserver 滚动触发
│   └── useCountUp.ts                # 数字递增
│
├── data/                            # 默认数据
│   ├── members.ts
│   ├── projects.ts
│   ├── awards.ts
│   └── pages.ts
│
├── types/
│   └── index.ts
│
└── assets/
    └── logo.png
```

---

## 四、全局布局

### 4.1 顶部导航栏（Navbar）

```
┌──────────────────────────────────────────────────────────┐
│  [Logo]  星雨作坊    关于  成员  项目  奖项  博客       │
│                     开源  加入  时间线  入门  雨记        │
└──────────────────────────────────────────────────────────┘
```

**规格：**
- 固定顶部 `sticky top-0 z-50`
- 布局：`flex items-center justify-between px-6 lg:px-10 h-16 max-w-[1400px] mx-auto`
- **Logo**：图片 logo（w-8 h-8）+ "星雨作坊"（text-lg font-medium，PP Neue Montreal 500，text-[#051A24]）
- **导航链接**：`hidden md:flex items-center gap-8`
  - 每个链接：text-sm font-medium text-[#273C46]，hover:text-[#051A24] transition-colors
  - 当前活跃路由：text-[#051A24] font-medium + 底部 2px 下划线（`::after` 伪元素，scale-x 0→1，0.3s ease）
- **移动端**：汉堡菜单按钮（lucide Menu），点击展开全屏白色抽屉

**视频感知的毛玻璃效果（融合 prompt2）：**

Navbar 根据滚动位置动态切换背景：

| 位置 | 背景 | 说明 |
|------|------|------|
| **Hero 区域**（scrollY = 0） | `bg-white/20 backdrop-blur-md` + 无底部边框 | 半透明毛玻璃，透过视频背景，与 prompt2 导航一致 |
| **过渡区间**（0 < scrollY < Hero 高度） | 平滑过渡到 `bg-white/80` | `requestAnimationFrame` 根据滚动比例动态插值 |
| **内容区域**（scrollY ≥ Hero 高度） | `bg-white/80 backdrop-blur-md border-b border-[var(--border)]` | 接近纯白，确保在白色内容区可见 |
| **滚动超过 50px** | `bg-white/95 shadow-sm` | 进一步加深，明确分隔 |

通过 `useEffect` + `scroll` 事件 + CSS 变量 `--navbar-opacity` 实现平滑过渡：
```typescript
// Navbar 透明度随滚动变化
const [navOpacity, setNavOpacity] = useState(0);
useEffect(() => {
  const onScroll = () => {
    const heroH = window.innerHeight;
    const progress = Math.min(window.scrollY / heroH, 1);
    setNavOpacity(progress);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  return () => window.removeEventListener('scroll', onScroll);
}, []);
// CSS: background: rgba(255,255,255, ${0.2 + navOpacity * 0.75})
```

### 4.2 页脚（Footer）

```
┌──────────────────────────────────────────────────────────┐
│  星雨作坊                    快速链接       联系方式      │
│  学生开发社团                关于我们       GitHub        │
│  © 2026 星雨作坊            成员风采       Email          │
│                             项目作品       Bilibili        │
│                             开源精神                       │
└──────────────────────────────────────────────────────────┘
```

**规格：**
- 布局：`max-w-[1200px] mx-auto px-6 py-16`，grid `grid-cols-1 md:grid-cols-3 gap-12`
- 左侧：logo + 简介（text-sm text-[#273C46] leading-relaxed max-w-xs）
- 中间：链接列（text-sm text-[#273C46]，每行 hover:text-[#051A24] transition-colors）
- 右侧：带 lucide 图标的联系方式
- 底部：`border-t border-[var(--border)] mt-12 pt-6 text-xs text-[#273C46]`，flex justify-between

### 4.3 线条小狗桌宠（LineDogPet）

固定定位 SVG 小狗（`fixed z-[100]`），约 `w-12 h-12`：

- **随机走动**：页面加载 3s 后开始，在视口内随机移动。`requestAnimationFrame` 平滑移动，到达目标后休息 2~6 秒
- **行走动画**：上下弹跳（`translateY` ±2px）+ 前后腿交替
- **自动转身**：`scaleX(-1)` 根据移动方向翻转
- **滚动靠边**：用户滚动时小狗移到最近侧边并停止；停止滚动 2s 后恢复
- **骰子导航**：点击弹出菜单，投骰子随机跳转到 8 个页面之一
- **菜单自适应**：根据小狗在视口中的位置，菜单自动选择弹出方向
- **待机动画**：眨眼、耳朵抖动、尾巴摇摆

---

## 五、首页各区块详细规格

### 5.1 Hero 区域（HeroSection）

Hero 使用**全屏循环背景视频**作为视觉底层（来自 prompt2），视频上方叠加半透明白色层，之上为 prompt1 风格的居中窄栏文字内容。视频提供全部视觉深度和氛围感，不做额外装饰性渐变或光斑。

**层级结构（从底到顶）：**

```
┌──────────────────────────────────────────────────────┐
│  Layer 0 (z-0): 全屏 <video>                          │
│    absolute inset-0 w-full h-full object-cover        │
│    autoPlay loop muted playsInline                    │
│                                                       │
│  Layer 1 (z-10): 白色遮罩层                            │
│    absolute inset-0 bg-white/70                       │
│    → 保留视频氛围，同时确保深色文字可读                   │
│                                                       │
│  Layer 2 (z-20): 文字内容（居中窄栏）                    │
│    relative flex flex-col items-center text-center     │
│    max-w-[500px] px-6                                 │
│    pt-24 md:pt-32 pb-24                               │
└──────────────────────────────────────────────────────┘
```

**视频元素规格：**

```html
<video
  autoPlay
  loop
  muted
  playsInline
  className="absolute inset-0 w-full h-full object-cover z-0"
>
  <source src="/hero-bg.mp4" type="video/mp4" />
</video>
```

视频素材建议：社团活动现场花絮、编码/创作过程特写、校园环境空镜等低调沉稳的短片。整体色调偏暗或中性，避免过于鲜亮跳跃，与 prompt1 的克制风格统一。

**白色遮罩层：**
```css
.hero-overlay {
  position: absolute;
  inset: 0;
  z-index: 10;
  background: rgba(255, 255, 255, 0.7);
  /* 视频透过 30%，形成微妙的动态纹理感，但文字对比度不受影响 */
}
```

**文字内容（z-20，相对定位在遮罩之上）：**
容器：`relative z-20 max-w-[500px] mx-auto px-6 pt-24 md:pt-32 pb-24 flex flex-col items-center text-center`

1. **社团标签**：font-mono text-xs md:text-sm text-[#273C46] mb-3，动画延迟 0.1s — "XINGYU STUDIO"

2. **主标题**（两行，含 PP Mondwest 衬线 accent）：
   - text-[36px] md:text-[44px] lg:text-[48px] leading-[1.1] text-[#051A24] tracking-tight
   - 第一行："用代码点亮**创想**，" — "创想"用 `<span className="font-mondwest">` 包裹
   - 第二行："让**热爱**掷地有声。" — "热爱"用 PP Mondwest
   - 动画延迟 0.2s

3. **描述文字**：text-sm md:text-base text-[#0D212C] leading-relaxed max-w-[420px] mx-auto mt-5 md:mt-6
   - 两个段落，`flex flex-col gap-5`
   - 动画延迟 0.3s

4. **双按钮**：`flex flex-col sm:flex-row gap-3 md:gap-4 justify-center mt-6 md:mt-8`，动画延迟 0.4s
   - "了解我们" — btn-primary
   - "加入社团" — btn-secondary

5. **滚动指示器**：底部 mt-16，ChevronDown 图标弹跳（`animate-bounce`），text-[#273C46]/40

**视频回退方案：** 若视频加载失败或不支持自动播放，Hero 回退为纯白背景（`bg-white`），遮罩层自动隐藏，文字内容保持不变。通过 `<video>` 的 `onError` 事件和 CSS `@supports` 查询实现。

**动画方案（fadeInUp）：**
```css
@keyframes fadeInUp {
  0% { opacity: 0; transform: translateY(30px); }
  100% { opacity: 1; transform: translateY(0); }
}
.animate-fade-in-up {
  animation: fadeInUp 0.8s ease-out forwards;
  opacity: 0;
}
```
每个文字元素设置 `animationDelay`：0.1s / 0.2s / 0.3s / 0.4s。Hero 区域不使用 IntersectionObserver（首屏即触发），直接在 `onMount` 时应用动画类。

---

### 5.2 社团简介（AboutSection）

**布局：** `max-w-[1100px] mx-auto px-6 py-20 md:py-28`

**左右双栏（`grid-cols-1 lg:grid-cols-2 gap-16 items-center`）：**

**左侧文字区：**
- **标签**：font-mono text-xs text-[#273C46] tracking-widest uppercase mb-3 — "ABOUT US"
- **标题**：text-[28px] md:text-[36px] leading-[1.15] text-[#051A24] tracking-tight
  - "一个由<span class="font-mondwest">学生</span>打造的"
  - "<span class="font-mondwest">创造者</span>社群"
- **描述**：text-sm md:text-base text-[#0D212C] leading-relaxed mt-5 space-y-4
- **数据指标行**：flex gap-10 mt-8
  - 每个指标：数字（text-[28px] font-medium text-[#051A24] font-mondwest，CountUp 动画）+ 标签（text-xs text-[#273C46] mt-1）
  - 指标：成立年份 / 成员数 / 获奖数 / 项目数

**右侧图片区：**
- 社团合影/活动图：`w-full rounded-[32px] md:rounded-[40px] object-cover shadow-lg`
- 使用 useInViewAnimation 触发入场

---

### 5.3 成员风采（MembersSection）

**布局：** `max-w-[1200px] mx-auto px-6 py-20 md:py-28`

**标题区（居中）：**
- 标签：font-mono text-xs text-[#273C46] tracking-widest uppercase — "TEAM"
- 标题：text-[28px] md:text-[36px] text-[#051A24]
  - "我们的<span class="font-mondwest">成员</span>"

**成员卡片网格：**
- `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-12`
- 每张卡片（Card 组件，`rounded-[32px]`，white bg，hover 上浮 `-8px`）：
  - 头像：`w-20 h-20 rounded-full object-cover mx-auto mt-8`
  - 姓名：text-lg font-medium text-[#051A24] mt-4
  - 角色/组别：text-sm text-[#273C46]
  - 技能标签行：flex flex-wrap gap-2 justify-center mt-3 px-6，TagPill 组件
  - 社交图标行：flex gap-3 mt-4 mb-8 justify-center（GitHub / Blog / Mail，hover:text-[#051A24] transition-colors，默认 text-[#273C46]/50）
- 悬停时：卡片上浮 `translateY(-8px)` + 阴影加深至 `shadow-lg`

**底部 CTA：** 居中 mt-12，"查看全部成员 →" btn-tertiary

---

### 5.4 作品展示（ProjectsSection）

**布局：** 全宽 `py-20 md:py-28`，`max-w-[1100px] mx-auto px-6`

**标题区（居中）：**
- 标签："WORKS"
- 标题："我们的<span class="font-mondwest">作品</span>"

**纵向堆叠（`flex flex-col gap-20 md:gap-28 mt-12`）：**

3 个项目条目，每个结构如下：

```
┌──────────────────────────────────────────────────────┐
│                                                      │
│          [项目名 — PP Mondwest 衬线]                  │
│          [描述 — text-sm text-[#0D212C]/70]          │
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │              全宽项目截图/封面                   │  │
│  │              rounded-2xl shadow-lg              │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
└──────────────────────────────────────────────────────┘
```

- 文字块左偏移：`ml-16 md:ml-32`
- 项目名：text-2xl md:text-3xl font-mondwest font-medium text-[#051A24]
- 描述：text-sm md:text-base text-[#0D212C]/70 mt-1 max-w-md
- 图片：`w-full rounded-[24px] md:rounded-[32px] object-cover shadow-lg mt-6`
  - 不同项目图片高度不同以产生节奏变化（h-[300px] / h-[400px] / h-[350px]）
- 每个条目独立使用 IntersectionObserver 触发 fadeInUp

**底部 CTA：** 居中 mt-16，"查看全部作品 →" btn-tertiary

---

### 5.5 比赛奖项（AwardsSection）

**布局：** `max-w-[1000px] mx-auto px-6 py-20 md:py-28`

**标题区（居中）：**
- 标签："HONORS"
- 标题："比赛<span class="font-mondwest">奖项</span>"

**年份分组（`space-y-16 mt-12`）：**
- 每个年份组：
  - 年份标题：text-2xl font-medium text-[#051A24] mb-6，左侧深色竖线装饰（`w-1 h-6 bg-[#051A24] rounded-full inline-block mr-3`）
  - 奖项卡片列表：`grid grid-cols-1 md:grid-cols-2 gap-4`
  - 每张卡片（Card，`rounded-[24px]`，p-6）：
    - flex justify-between items-start
    - 左侧：奖项名（font-medium text-[#051A24]）+ 获奖者（text-sm text-[#273C46] mt-1）
    - 右侧：级别标签 TagPill + 日期（text-xs text-[#273C46]/60 mt-2）

**底部 CTA：** 居中 mt-12，"查看全部奖项 →" btn-tertiary

---

### 5.6 加入社团 CTA（JoinSection）

**布局：** 全宽 `py-32 md:py-48`，居中

**大型白色容器：** `max-w-3xl mx-auto rounded-[40px] bg-white shadow-lg px-8 py-32 md:py-48 text-center`

**鼠标跟随特效：**
- 鼠标在容器内移动时，在光标位置生成小型浮动图标（lucide 图标如 Code、Star、Zap 等），带随机旋转（-10°~+10°），1000ms 内淡出并缩小消失，每 80ms 生成一个
- 使用 `onMouseMove` + `requestAnimationFrame` 实现

**内容（z-10 相对定位，不受特效影响）：**
- 标题：text-[36px] md:text-[48px] lg:text-[56px] font-mondwest text-[#051A24] leading-[1.05]
  - "加入<span class="font-mondwest">我们</span>"
- 描述：text-sm md:text-base text-[#0D212C] max-w-md mx-auto mt-6 leading-relaxed
- CTA 按钮：mt-10，btn-primary lg，文字："立即报名"

---

## 六、子页面详细规格

### 6.1 关于我们（AboutPage）

**布局：** `max-w-[900px] mx-auto px-6 py-24`

- 页面标题：text-[36px] md:text-[44px] font-medium text-[#051A24]，含 PP Mondwest 关键词
- 富文本内容区（Markdown 渲染）：prose 风格，text-[#0D212C] leading-relaxed
- 数据指标行（同首页）
- 场地照片墙：`grid grid-cols-2 md:grid-cols-3 gap-4 mt-12`，每张图 `rounded-2xl object-cover` hover 时 scale(1.02)

### 6.2 成员展示页（MembersPage）

**布局：** `max-w-[1200px] mx-auto px-6 py-24`

**顶部筛选栏（sticky top-16 z-40，白底毛玻璃 py-4）：**
- 组别胶囊标签：flex gap-3 flex-wrap
  - 默认：bg-white text-[#273C46] border border-[var(--border)] rounded-full px-4 py-1.5 text-sm
  - 选中：bg-[#051A24] text-white border-transparent
  - 组别："全部"、"前端组"、"后端组"、"设计组"、"算法组"、"产品组"
- 搜索框：rounded-full border px-4 py-2 text-sm placeholder:text-[#273C46]/40，聚焦宽度 200px→280px（transition-all duration-300）

**成员网格：** 同首页 MembersSection，`PAGE_SIZE = 12`，加载更多按钮

**详情弹窗（Modal）：** 点击卡片打开居中 Modal（`max-w-[400px] rounded-[32px]`），大尺寸头像 + 完整信息 + 作品列表

### 6.3 项目画廊（ProjectsPage）

**布局：** `max-w-[1200px] mx-auto px-6 py-24`

**筛选 + 搜索：** 同 MembersPage 模式。分类："全部"、"Web 应用"、"小程序"、"AI/算法"、"工具库"、"游戏"

**项目卡片网格：** `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8`
- 每张（Card，`rounded-[32px]`，overflow-hidden）：
  - 封面图：`w-full h-52 object-cover`
  - 内容区：p-6
  - 项目名：text-xl font-medium text-[#051A24]
  - 描述：text-sm text-[#273C46] mt-2 line-clamp-2
  - 技术栈标签行：flex gap-2 mt-4 flex-wrap
  - 底部分隔线 + GitHub 统计行（Star/Fork 图标+数字）+ "查看详情 →" text-sm font-medium text-[#051A24] hover:opacity-70 transition-opacity

**底部奖项入口：** 分隔线 + 部分奖项展示 + "查看全部奖项 →" 链接

### 6.4 项目详情页（ProjectDetailPage）

**布局：** `max-w-[1100px] mx-auto px-6 py-24`

- 封面大图：`w-full h-[400px] md:h-[500px] object-cover rounded-[32px] shadow-lg`
- 双栏（`grid-cols-1 lg:grid-cols-[1fr_320px] gap-12 mt-12`）：
  - **左栏**：项目名（text-3xl font-medium text-[#051A24]）+ 标签行 + Markdown 正文 + 截图集（`grid grid-cols-2 gap-4`）
  - **右栏**（sticky top-24）：Card（`rounded-[24px]` p-6）含 GitHub 链接、演示链接、团队成员、时间线、相关项目

### 6.5 奖项列表页（AwardsPage）

**布局：** `max-w-[900px] mx-auto px-6 py-24`

**类别筛选：** "全部"、"国家级"、"省级"、"校级"、"其他"

**年份分组：** 同首页 AwardsSection，展示全部

### 6.6 奖项详情页（AwardDetailPage）

**布局：** `max-w-[900px] mx-auto px-6 py-24`

双栏布局：左栏（奖项信息 + 描述）+ 右栏（证书图片轮播、相关项目）

### 6.7 博客动态（BlogPage）

**布局：** `max-w-[900px] mx-auto px-6 py-24`

**分类筛选：** "全部"、"技术分享"、"活动记录"、"心得总结"、"公告通知"

**文章卡片列表（`space-y-8`）：**
- 每张卡片（Card，`rounded-[32px]`，flex row p-0 overflow-hidden）：
  - 左侧日期块：`w-20 flex-shrink-0 flex flex-col items-center justify-center bg-[#051A24] text-white`
    - 日期数字：text-2xl font-mondwest
    - 月份：text-xs text-[#E0EBF0]
  - 右侧内容：p-6 flex-1
    - 标题：text-xl font-medium text-[#051A24] hover:opacity-70 transition-opacity（链接到详情）
    - 摘要：text-sm text-[#273C46] mt-2 line-clamp-2
    - 标签 + 作者行：flex gap-3 mt-3 text-xs text-[#273C46]/60

### 6.8 开源仓库（OpenSourcePage）

**布局：** `max-w-[1000px] mx-auto px-6 py-24`

仓库卡片列表，每张（Card，`rounded-[32px]`）：仓库名 + 描述 + 语言色标 + Star/Fork 计数 + 贡献者头像行

### 6.9 加入申请（JoinPage）

**布局：** `max-w-[600px] mx-auto px-6 py-24`

**三步表单 + 步骤指示器：**
- 顶部三个圆形步骤标记（编号 1/2/3），步骤间连接线
  - 当前步骤：bg-[#051A24] text-white
  - 已完成：bg-[#0D212C] text-white + 勾选图标
  - 未完成：bg-white border border-[var(--border)] text-[#273C46]

**Step 1 — 基本信息：** 姓名、学号、年级专业、邮箱、手机
**Step 2 — 意向选择：** 意向组别（卡片式 radio group）+ 技能自述（textarea）
**Step 3 — 动机陈述：** 申请动机（textarea，必填 ≥ 10 字）+ 作品链接（选填）

**验证：** blur 实时验证，错误时 input 底部红色提示（text-xs text-red-500）。当前步骤全部合法才可进入下一步。底部按钮："上一步"（btn-tertiary）+ "下一步/提交"（btn-primary）。

### 6.10 招新信息页（RecruitmentPage）

**布局：** `max-w-[800px] mx-auto px-6 py-24`

Markdown 渲染（招新要求、流程、FAQ），底部 CTA 卡片（Card，`rounded-[32px]`，居中 text-center p-10）："准备好加入我们了吗？" + "立即报名" btn-primary

### 6.11 时间线页（TimelinePage）

**布局：** `max-w-[700px] mx-auto px-6 py-24`

垂直时间线：中间竖线（`absolute left-1/2 w-px h-full bg-[var(--border)]`），事件交替左右排列。每个事件节点：时间圆点（`w-3 h-3 rounded-full bg-[#051A24]`）+ 日期 + 事件卡片（Card，`rounded-[24px]`）。IntersectionObserver 触发，奇数从右滑入，偶数从左滑入。

### 6.12 新手指南页（OnboardingPage）

**布局：** `max-w-[800px] mx-auto px-6 py-24`

手风琴步骤卡片列表，每步一张 Card（`rounded-[32px]`）：步骤编号（text-4xl font-mondwest text-[#051A24]/10 作为背景装饰）+ 标题 + 详细说明，可折叠展开。

### 6.13 雨记协作板（YujiPage）

**布局：** `max-w-[900px] mx-auto px-6 py-24`

共享白板式布局，Card 容器（`rounded-[32px]` p-8 md:p-12）内渲染 Markdown 协作内容，简约卡片式分段。

---

## 七、全局动画系统

### 7.1 useInViewAnimation Hook

```typescript
function useInViewAnimation(options?: {
  threshold?: number;       // 默认 0.1
  rootMargin?: string;      // 默认 '0px 0px -50px 0px'
  triggerOnce?: boolean;    // 默认 true（只触发一次）
}): { ref: RefObject<HTMLDivElement>; isInView: boolean }
```

所有 section 统一使用该 hook：
```tsx
const { ref, isInView } = useInViewAnimation({ threshold: 0.15 });
<div ref={ref} className={isInView ? 'animate-fade-in-up' : 'opacity-0'}>
  {/* 内容 */}
</div>
```

### 7.2 CSS 关键帧

```css
/* ===== 核心入场动画 ===== */

/* 淡入上移 — 默认入场效果 */
@keyframes fadeInUp {
  0% { opacity: 0; transform: translateY(30px); }
  100% { opacity: 1; transform: translateY(0); }
}
.animate-fade-in-up {
  animation: fadeInUp 0.8s ease-out forwards;
  opacity: 0;
}

/* 淡入缩放 */
@keyframes fadeInScale {
  0% { opacity: 0; transform: scale(0.95); }
  100% { opacity: 1; transform: scale(1); }
}
.animate-fade-in-scale {
  animation: fadeInScale 0.6s ease-out forwards;
  opacity: 0;
}

/* 从左滑入 — 时间线等使用 */
@keyframes slideInLeft {
  0% { opacity: 0; transform: translateX(-40px); }
  100% { opacity: 1; transform: translateX(0); }
}
.animate-slide-in-left {
  animation: slideInLeft 0.7s ease-out forwards;
  opacity: 0;
}

/* 从右滑入 */
@keyframes slideInRight {
  0% { opacity: 0; transform: translateX(40px); }
  100% { opacity: 1; transform: translateX(0); }
}
.animate-slide-in-right {
  animation: slideInRight 0.7s ease-out forwards;
  opacity: 0;
}

/* ===== 循环动画 ===== */

/* 上下浮动 */
@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}
.animate-float { animation: float 3s ease-in-out infinite; }
.animate-float-delayed { animation: float 3s ease-in-out 0.5s infinite; }
.animate-float-slow { animation: float 5s ease-in-out infinite; }

/* 弹跳箭头 — 滚动指示器 */
@keyframes bounceArrow {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(8px); }
}
.animate-bounce-arrow { animation: bounceArrow 1.5s ease-in-out infinite; }
```

### 7.3 Staggered 延迟工具类

```css
.delay-100 { animation-delay: 0.1s; }
.delay-200 { animation-delay: 0.2s; }
.delay-300 { animation-delay: 0.3s; }
.delay-400 { animation-delay: 0.4s; }
.delay-500 { animation-delay: 0.5s; }
.delay-600 { animation-delay: 0.6s; }
.delay-700 { animation-delay: 0.7s; }
.delay-800 { animation-delay: 0.8s; }
```

---

## 八、数据模型

```typescript
// 成员
interface Member {
  id: string;
  name: string;
  avatar: string;
  role: string;
  group: 'frontend' | 'backend' | 'design' | 'algorithm' | 'product';
  skills: string[];
  github?: string;
  blog?: string;
  email?: string;
  bio?: string;
  grade: string;
  isAlumni: boolean;
}

// 项目
interface Project {
  id: string;
  slug: string;
  name: string;
  coverImage: string;
  category: 'web' | 'miniapp' | 'ai' | 'tools' | 'game';
  techStack: string[];
  description: string;
  content: string;          // Markdown
  githubUrl?: string;
  demoUrl?: string;
  stars: number;
  forks: number;
  screenshots: string[];
  team: { name: string; avatar: string; role: string }[];
  startDate: string;
  endDate?: string;
  status: 'active' | 'completed' | 'archived';
}

// 奖项
interface Award {
  id: string;
  slug: string;
  name: string;
  level: 'national' | 'provincial' | 'school' | 'other';
  category: string;
  winner: string;
  issuer: string;
  date: string;
  description?: string;
  certificateImages: string[];
  relatedProject?: string;
}

// 博客文章
interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;          // Markdown
  category: 'tech' | 'event' | 'summary' | 'announcement';
  tags: string[];
  author: { name: string; avatar: string };
  date: string;
  coverImage?: string;
}
```

---

## 九、响应式断点

| 断点 | 宽度 | 主要变化 |
|------|------|----------|
| 默认 | < 640px | 单列，汉堡菜单，Hero 文字缩小至 32px，卡片全宽，`rounded-[24px]` |
| sm | ≥ 640px | Hero 文字 40px，卡片 2 列，按钮可并排 |
| md | ≥ 768px | 导航链接显示，卡片 2-3 列，双栏布局，`rounded-[32px]` |
| lg | ≥ 1024px | 完整导航，卡片 3-4 列，侧边栏启用，`rounded-[40px]` |
| xl | ≥ 1280px | 最大宽度约束生效 |

---

## 十、实施顺序

1. **Phase 1 — 基础框架**：项目搭建、CSS 变量 / 字体引入 / 全局样式、Button / Card / TagPill 组件、Navbar / Footer
2. **Phase 2 — 首页**：HeroSection → AboutSection → MembersSection → ProjectsSection → AwardsSection → JoinSection
3. **Phase 3 — 列表页**（统一模式）：MembersPage → ProjectsPage → AwardsPage → BlogPage → OpenSourcePage
4. **Phase 4 — 详情页**：ProjectDetailPage → AwardDetailPage
5. **Phase 5 — 功能页**：JoinPage → RecruitmentPage → TimelinePage → OnboardingPage → YujiPage
6. **Phase 6 — 特效打磨**：LineDogPet → CountUp → 响应式微调 → prefers-reduced-motion → 性能优化
