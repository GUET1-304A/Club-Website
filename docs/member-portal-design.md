# 星雨作坊 · 社团内部成员网站设计方案

> 基于 main 分支已有功能（项目管理、通知中心、资源中心、证书OCR、AI智能体）和当前前端设计系统的完整设计方案。

---

## 一、信息架构

```
/member                          ← 成员门户入口
├── /member/login                ← 成员登录页
├── /member/dashboard            ← 个人工作台（首页）
├── /member/projects             ← 我的项目列表
│   └── /member/projects/:id     ← 项目详情（Kanban看板）
├── /member/tasks                ← 我的任务（跨项目聚合）
├── /member/resources            ← 资源中心 / 知识库
├── /member/certificates         ← 证书管理（上传+OCR识别）
├── /member/notifications        ← 通知中心
├── /member/directory            ← 成员通讯录
└── /member/profile              ← 个人资料与设置
```

---

## 二、设计系统对齐

### 色彩变量（继承 Admin 面板）

| Token | 值 | 用途 |
|-------|-----|------|
| `--bg-primary` | `#f8f7f5` | 主背景 |
| `--bg-card` | `#ffffff` | 卡片/侧栏背景 |
| `--text-primary` | `#051A24` | 主文字 |
| `--text-secondary` | `#273C46` | 次要文字 |
| `--text-muted` | `#273C46/50` | 弱化文字 |
| `--border-subtle` | `rgba(0,0,0,0.05)` | 分割线 |
| `--accent` | `#051A24` | 强调色/Active状态 |
| `--danger` | `#ef4444` | 危险操作 |

### 字体
- 标题：`'PP Neue Montreal', 'Noto Sans SC', sans-serif` (weight 500)
- 正文：系统默认 sans-serif
- Mono：等宽字体用于代码/ID

### 圆角系统
- 按钮/输入框: `rounded-2xl` (16px)
- 卡片: `rounded-[22px]` ~ `rounded-[24px]`
- 头像: `rounded-xl` (12px)
- 标签: `rounded-full`

### 阴影
- 卡片: `shadow-sm`
- 侧栏: `shadow-lg shadow-[#051A24]/10`
- Hover提升: `hover:shadow-xl`

---

## 三、页面设计

### 3.1 成员登录页 `/member/login`

**布局**: 居中卡片式

```
┌──────────────────────────────────────────────┐
│  bg: #f8f7f5 (warm light gray)               │
│                                              │
│         ┌─────────────────────┐              │
│         │    [Logo 星雨作坊]    │              │
│         │   成员门户           │              │
│         │                     │              │
│         │  ┌─────────────────┐│              │
│         │  │ 学号/邮箱        ││              │
│         │  └─────────────────┘│              │
│         │  ┌─────────────────┐│              │
│         │  │ 密码             ││              │
│         │  └─────────────────┘│              │
│         │                     │              │
│         │  [ 登 录 ] (btn)    │              │
│         │                     │              │
│         │  没有账号？联系管理员 │              │
│         └─────────────────────┘              │
│                                              │
└──────────────────────────────────────────────┘
```

**交互细节**:
- 登录成功后存储 `userToken` 到 localStorage
- 错误状态: 抖动动画 + 红色提示文字
- 加载态: 按钮显示 spinner

---

### 3.2 成员布局框架 `MemberLayout`

**与 AdminLayout 相同的结构，但侧栏导航内容不同**：

```
┌──────┬────────────────────────────────────────┐
│ Side │  Main Content Area                     │
│ bar  │                                        │
│      │                                        │
│ 240px│                                        │
│      │                                        │
│      │                                        │
└──────┴────────────────────────────────────────┘
```

**侧栏导航组**：

| 分组 | 导航项 | 图标 |
|------|--------|------|
| 概览 | 工作台 `/member/dashboard` | `LayoutDashboard` |
| 项目 | 我的项目 `/member/projects` | `FolderGit2` |
| | 我的任务 `/member/tasks` | `CheckSquare` |
| 资源 | 资源中心 `/member/resources` | `FolderOpen` |
| | 证书管理 `/member/certificates` | `Award` (Trophy) |
| 成员 | 通讯录 `/member/directory` | `Users` |
| 通知 | 通知中心 `/member/notifications` | `Bell` |
| 设置 | 个人资料 `/member/profile` | `Settings` |

**底部操作区**：
- "查看网站" → 打开 `/` 新标签
- "退出登录" → 清除 token，跳转 `/member/login`

**折叠态**: 与 AdminLayout 一致，收起后只显示图标 + hover tooltip

---

### 3.3 个人工作台 `/member/dashboard`

**顶部**：
```
┌──────────────────────────────────────────────────────┐
│  早上好/下午好/晚上好，[成员姓名]                        │
│  今天是 2026年7月7日 星期二                            │
│                                                      │
│  [我的待办: 5]  [进行中: 3]  [本周完成: 12]  [通知: 2] │
└──────────────────────────────────────────────────────┘
```

**统计卡片行**（3列）：

```
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ 🔥 进行中    │ │ ✅ 已完成    │ │ 📅 本周截止  │
│    3 个项目  │ │   12 个任务  │ │    5 个任务  │
│   → 查看     │ │   → 查看    │ │   → 查看    │
└─────────────┘ └─────────────┘ └─────────────┘
```

**下方两栏布局**：

```
┌──────────────────────────┐ ┌──────────────────────┐
│ 📋 我的待办任务 (前5条)    │ │ 📢 最新公告 (前3条)    │
│                          │ │                      │
│  ☐ 完成登录页面设计       │ │ · 2026春季招新公告     │
│    项目: Campus Hub      │ │ · ICPC 2025 参赛回顾  │
│    截止: 2026-07-10      │ │ · React 19 新特性    │
│                          │ │                      │
│  ☐ 修复导航栏bug         │ │                      │
│    项目: Design Collab   │ │                      │
│    截止: 2026-07-08      │ │                      │
│                          │ │                      │
│  → 查看全部任务           │ │ → 查看更多公告         │
└──────────────────────────┘ └──────────────────────┘
```

**快捷入口**：
```
[新建任务] [上传证书] [浏览资源] [查看项目]
```

---

### 3.4 我的项目列表 `/member/projects`

**顶部筛选栏**：
```
[🔍 搜索项目...]  [全部] [Web] [小程序] [AI] [工具] [游戏]
```

**项目卡片网格**（2-3列）：

```
┌──────────────────────────┐ ┌──────────────────────────┐
│ [封面图]                  │ │ [封面图]                  │
│                          │ │                          │
│ Campus Hub               │ │ AI 智能写作助手           │
│ Web · React, TypeScript  │ │ AI · Python, FastAPI     │
│                          │ │                          │
│ ████████████░░░ 75%     │ │ ██████░░░░░░░░ 40%      │
│ 3/4 里程碑完成            │ │ 2/5 里程碑完成            │
│                          │ │                          │
│ 👤 陈星宇 · 5人团队       │ │ 👤 王思远 · 3人团队       │
│ [进行中]                 │ │ [进行中]                 │
└──────────────────────────┘ └──────────────────────────┘
```

**卡片 Hover**: 上浮 4px + 阴影加深

---

### 3.5 项目 Kanban 看板 `/member/projects/:id`

**顶部项目信息栏**：
```
┌──────────────────────────────────────────────────────┐
│  ← 返回    Campus Hub  [进行中]                       │
│  Web · 2025.09 ~ 至今  ·  团队: 5人                   │
│  [GitHub] [Demo]                                      │
│                                                      │
│  [看板] [里程碑] [周报] [设置]   ← Tab切换             │
└──────────────────────────────────────────────────────┘
```

**Kanban 看板**（4列可拖拽）：

```
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│ 📝 待办   │ │ 🔄 进行中 │ │ 👀 待审核 │ │ ✅ 已完成 │
│ 3        │ │ 2        │ │ 1        │ │ 5        │
├──────────┤ ├──────────┤ ├──────────┤ ├──────────┤
│┌────────┐│ │┌────────┐│ │┌────────┐│ │┌────────┐│
││ 任务A  ││ ││ 任务C  ││ ││ 任务E  ││ ││ 任务F  ││
││ 🟡 中  ││ ││ 🔴 高  ││ ││ 🟢 低  ││ ││ 🟡 中  ││
││ 👤 赵  ││ ││ 👤 林  ││ ││ 👤 孙  ││ ││ 👤 周  ││
││ 📅7/10 ││ ││ 📅7/5  ││ ││ 📅7/8 ││ ││ 📅done ││
│└────────┘│ │└────────┘│ │└────────┘│ │└────────┘│
│┌────────┐│ │┌────────┐│ │          │ │┌────────┐│
││ 任务B  ││ ││ 任务D  ││ │          │ ││ 任务G  ││
││ 🟢 低  ││ ││ 🟡 中  ││ │          │ ││ 🟡 中  ││
││ 👤 陈  ││ ││ 👤 王  ││ │          │ ││ 👤 赵  ││
││ 📅7/15 ││ ││ 📅7/6 ││ │          │ ││ 📅done ││
│└────────┘│ │└────────┘│ │          │ │└────────┘│
│          │ │          │ │          │ │          │
│[+ 添加]  │ │[+ 添加]  │ │[+ 添加]  │ │[+ 添加]  │
└──────────┘ └──────────┘ └──────────┘ └──────────┘
```

**任务卡片设计**：
- 白色卡片 + 细边框 + 小圆角
- 左上角：优先级色点（🔴高 🟡中 🟢低）
- 标题：`font-medium text-[#051A24]`
- 底部：负责人头像 + 截止日期
- 拖拽时：轻微旋转 + 阴影 + 半透明

**里程碑时间线**（Tab切换）：

```
 ──●────────────●────────────○────────────○──→
   v1.0          v1.5         v2.0         v3.0
   已完成        进行中        待开始        待开始
   2025-10      2026-01      2026-04      2026-08
```

---

### 3.6 我的任务 `/member/tasks`

**顶部筛选**：
```
[🔍 搜索任务...]  [全部项目 ▼]  [全部状态 ▼]  [优先级 ▼]
```

**任务列表**（表格/列表混合）：

```
┌─────────────────────────────────────────────────────────┐
│  ☐  完成登录页面响应式适配                    🔴 高优先级  │
│     项目: Campus Hub · 截止: 2026-07-10                 │
├─────────────────────────────────────────────────────────┤
│  ☑  编写 API 文档 - 成员模块                  🟡 中优先级  │
│     项目: AI Writer · 截止: 2026-07-05  ✓ 已完成        │
├─────────────────────────────────────────────────────────┤
│  ☐  设计资源中心图标系统                      🟢 低优先级  │
│     项目: Design Collab · 截止: 2026-07-15              │
└─────────────────────────────────────────────────────────┘
```

**空状态**: EmptyState 组件 — 图标 + "暂无待办任务" + "去项目看板看看"

---

### 3.7 资源中心 `/member/resources`

**顶部**：
```
[🔍 搜索资源...]  [+ 上传]  [新建文件夹]
```

**左侧文件夹树 + 右侧文件列表**：

```
┌──────────┬──────────────────────────────────────┐
│ 📁 全部   │  ← 返回上级  / 开发文档 / 前端       │
│ 📁 开发   │                                      │
│   📁 前端 │  ┌──────┐ ┌──────┐ ┌──────┐        │
│   📁 后端 │  │📄    │ │📄    │ │📄    │        │
│ 📁 设计   │  │React │ │CSS   │ │TS    │        │
│ 📁 产品   │  │指南  │ │规范  │ │配置  │        │
│ 📁 竞赛   │  │.md   │ │.md   │ │.md   │        │
│ 🗑 回收站 │  │      │ │      │ │      │        │
│          │  └──────┘ └──────┘ └──────┘        │
│          │                                      │
│          │  ┌──────┐ ┌──────┐                 │
│          │  │📄    │ │📁    │                  │
│          │  │组件  │ │Hooks │                   │
│          │  │文档  │ │      │                   │
│          │  │.md   │ │      │                   │
│          │  └──────┘ └──────┘                 │
└──────────┴──────────────────────────────────────┘
```

**文件操作**（右键/悬浮菜单）：
- 预览、下载、分享链接、重命名、移动到、删除
- 版本历史（侧边抽屉展示）
- 评论（底部评论区）

---

### 3.8 证书管理 `/member/certificates`

**顶部**：
```
证书管理    [+ 上传证书（OCR识别）]
```

**证书列表**（卡片网格 2-3 列）：

```
┌─────────────────────┐ ┌─────────────────────┐
│ [证书缩略图]         │ │ [证书缩略图]         │
│                     │ │                     │
│ ICPC 亚洲区银奖      │ │ Web应用开发大赛      │
│ 国家级 · ACM        │ │ 一等奖 · CCF         │
│ 👤 陈星宇、王思远    │ │ 👤 星雨作坊前端组     │
│ 📅 2025-12          │ │ 📅 2025-10           │
│                     │ │                     │
│ [查看] [编辑] [删除] │ │ [查看] [编辑] [删除] │
└─────────────────────┘ └─────────────────────┘
```

**上传弹窗**（包含 OCR 进度）：
```
┌──────────────────────────────────────┐
│  上传证书                            │
│                                      │
│  ┌──────────────────────────────┐    │
│  │   拖拽图片到此处               │    │
│  │   或 点击上传                  │    │
│  │   支持 JPG/PNG, ≤10MB         │    │
│  └──────────────────────────────┘    │
│                                      │
│  🔍 AI识别中...                      │
│  ████████████████░░░░ 80%           │
│                                      │
│  识别结果：                           │
│  名称: 全国大学生数学建模竞赛          │
│  级别: 省级                          │
│  获奖者: 陈星宇、林雨晴                │
│  颁发机构: 中国工业与应用数学学会       │
│  日期: 2024-09                       │
│                                      │
│  [确认归档] [手动修改]                │
└──────────────────────────────────────┘
```

---

### 3.9 通知中心 `/member/notifications`

**顶部筛选**：
```
[🔔 全部] [未读(3)] [已读]
[全部标记为已读]
```

**通知列表**：

```
┌──────────────────────────────────────────────────────┐
│  🔵  新的任务分配                         2分钟前      │
│      你被分配到任务「完成登录页面设计」                 │
│      项目: Campus Hub · 截止: 2026-07-10             │
├──────────────────────────────────────────────────────┤
│     任务状态更新                           1小时前     │
│     任务「修复导航栏bug」已标记为完成                  │
│     项目: Design Collab                             │
├──────────────────────────────────────────────────────┤
│  🔵  项目里程碑达成                         昨天       │
│     Campus Hub v1.5 里程碑已完成                     │
├──────────────────────────────────────────────────────┤
│     新公告发布                             3天前      │
│     「2026 春季招新公告」已发布                       │
└──────────────────────────────────────────────────────┘
```

**通知铃铛**（全局导航栏右上角）：
- 未读红点 + 数字角标
- 点击展开下拉面板（最近5条通知）
- 底部"查看全部"跳转到通知中心

---

### 3.10 成员通讯录 `/member/directory`

**顶部搜索**：
```
[🔍 搜索成员...]  [全部] [产品组] [设计组] [开发组] [内容组]
```

**成员卡片网格**（3-4 列）：

```
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  [头像]       │ │  [头像]       │ │  [头像]       │
│              │ │              │ │              │
│  陈星宇       │ │  林雨晴       │ │  赵子涵       │
│  负责人/产品   │ │  副社长/后端   │ │  前端组长      │
│              │ │              │ │              │
│  React Vue   │ │  Go Docker   │ │  TS React    │
│  Node Python │ │  Python K8s  │ │  Next Tailwind│
│              │ │              │ │              │
│  🐙 GitHub   │ │  📧 Email    │ │  🐙 📝 Blog  │
│  2022级      │ │  2022级      │ │  2023级      │
└──────────────┘ └──────────────┘ └──────────────┘
```

---

### 3.11 个人资料 `/member/profile`

**布局**：左侧导航 + 右侧表单

```
┌────────────┬────────────────────────────────────┐
│  个人资料   │  ┌─────────────────────────────┐   │
│  账号安全   │  │  [头像]  更换               │   │
│  通知偏好   │  │                             │   │
│            │  │  姓名:  [陈星宇            ] │   │
│            │  │  学号:  [2022001           ] │   │
│            │  │  邮箱:  [xingyu@example.com] │   │
│            │  │  手机:  [13800138000       ] │   │
│            │  │  年级:  [2022级        ▼  ] │   │
│            │  │  组别:  [产品组        ▼  ] │   │
│            │  │                             │   │
│            │  │  GitHub: [https://...     ] │   │
│            │  │  博客:   [https://...     ] │   │
│            │  │                             │   │
│            │  │  技能:   [React] [Vue] [+]  │   │
│            │  │                             │   │
│            │  │  简介:                      │   │
│            │  │  [热爱前端与开源...      ]   │   │
│            │  │                             │   │
│            │  │  [保存修改]                 │   │
│  ──────────┤  └─────────────────────────────┘   │
│  账号安全   │  ┌─────────────────────────────┐   │
│            │  │  修改密码                     │   │
│            │  │  当前密码: [              ]   │   │
│            │  │  新密码:   [              ]   │   │
│            │  │  确认密码: [              ]   │   │
│            │  │  [更新密码]                   │   │
│  ──────────┤  └─────────────────────────────┘   │
│  通知偏好   │  ┌─────────────────────────────┐   │
│            │  │  ☑ 任务分配通知               │   │
│            │  │  ☑ 项目更新通知               │   │
│            │  │  ☐ 公告推送（飞书）           │   │
│            │  │  ☑ 周报提醒                   │   │
│            │  └─────────────────────────────┘   │
└────────────┴────────────────────────────────────┘
```

---

## 四、组件清单

### 新建组件（需实现）

| 组件名 | 路径 | 说明 |
|--------|------|------|
| `MemberLayout` | `components/member/MemberLayout.tsx` | 成员门户布局框架（侧栏+顶栏） |
| `MemberLogin` | `components/member/MemberLogin.tsx` | 成员登录页 |
| `MemberDashboard` | `components/member/MemberDashboard.tsx` | 个人工作台 |
| `MemberProjects` | `components/member/MemberProjects.tsx` | 项目列表 |
| `ProjectKanban` | `components/member/ProjectKanban.tsx` | Kanban 看板视图 |
| `TaskCard` | `components/member/TaskCard.tsx` | 可拖拽任务卡片 |
| `MilestoneTimeline` | `components/member/MilestoneTimeline.tsx` | 里程碑时间线 |
| `MemberTasks` | `components/member/MemberTasks.tsx` | 任务聚合列表 |
| `ResourceCenter` | `components/member/ResourceCenter.tsx` | 资源中心主页 |
| `FileExplorer` | `components/member/FileExplorer.tsx` | 文件浏览器（树+列表） |
| `CertificateManager` | `components/member/CertificateManager.tsx` | 证书管理 |
| `CertificateUpload` | `components/member/CertificateUpload.tsx` | 证书上传+OCR |
| `NotificationCenter` | `components/member/NotificationCenter.tsx` | 通知中心 |
| `NotificationBell` | `components/member/NotificationBell.tsx` | 导航栏通知铃铛 |
| `MemberDirectory` | `components/member/MemberDirectory.tsx` | 成员通讯录 |
| `MemberProfile` | `components/member/MemberProfile.tsx` | 个人资料页 |
| `ProfileEditor` | `components/member/ProfileEditor.tsx` | 资料编辑表单 |

### 复用组件（已有）

| 组件 | 来源 | 复用场景 |
|------|------|---------|
| `Card` | `components/ui/Card.tsx` | 统计卡片、项目卡片 |
| `TagPill` | `components/ui/TagPill.tsx` | 筛选标签 |
| `EmptyState` | `components/ui/EmptyState.tsx` | 空数据提示 |
| `Divider` | `components/ui/Divider.tsx` | 内容分割 |
| `Markdown` | `components/ui/Markdown.tsx` | 资源预览、公告 |
| `ConfirmDialog` | `components/admin/ConfirmDialog.tsx` | 确认弹窗 |
| `Toast` | `components/admin/Toast.tsx` | 提示消息 |
| `Logo` | `components/ui/Logo.tsx` | 侧栏Logo |
| `SearchModal` | `components/ui/SearchModal.tsx` | 搜索弹窗 |

---

## 五、API 端点设计

### 成员认证（新增）

| 方法 | 端点 | 说明 |
|------|------|------|
| POST | `/api/member/login` | 成员登录，返回 userToken |
| GET | `/api/member/me` | 获取当前成员信息 |
| PUT | `/api/member/me` | 更新个人资料 |
| PUT | `/api/member/me/password` | 修改密码 |

### 项目管理（部分已有，需新增用户端鉴权）

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/member/projects` | 我的项目列表 |
| GET | `/api/member/projects/:id` | 项目详情+看板数据 |
| GET | `/api/member/projects/:id/tasks` | 项目任务列表 |
| POST | `/api/member/projects/:id/tasks` | 创建任务 |
| PUT | `/api/member/tasks/:id` | 更新任务（含拖拽状态变更） |
| PUT | `/api/member/tasks/:id/status` | 快捷状态变更 |
| DELETE | `/api/member/tasks/:id` | 删除任务 |

### 资源中心（新增）

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/member/resources` | 浏览资源（支持 folder_id） |
| POST | `/api/member/resources/upload` | 上传文件 |
| POST | `/api/member/resources/folders` | 创建文件夹 |
| PUT | `/api/member/resources/:id` | 重命名/移动 |
| DELETE | `/api/member/resources/:id` | 删除（移到回收站） |
| GET | `/api/member/resources/:id/versions` | 版本历史 |
| POST | `/api/member/resources/:id/share` | 生成分享链接 |

### 通知中心（新增）

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/member/notifications` | 获取通知列表 |
| GET | `/api/member/notifications/unread-count` | 获取未读数 |
| PUT | `/api/member/notifications/:id/read` | 标记已读 |
| PUT | `/api/member/notifications/read-all` | 全部已读 |

### 证书管理（新增）

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/member/certificates` | 我的证书列表 |
| POST | `/api/member/certificates/upload` | 上传证书图片 |
| POST | `/api/member/certificates/:id/ocr` | 触发OCR识别 |
| PUT | `/api/member/certificates/:id` | 编辑证书信息 |
| DELETE | `/api/member/certificates/:id` | 删除证书 |

---

## 六、路由与鉴权

### 路由注册（App.tsx 修改）

```typescript
// 新增 case:
case 'member':
  return (
    <ToastProvider>
      <MemberRouter parts={parts} />
    </ToastProvider>
  )

function MemberRouter({ parts }: { parts: string[] }) {
  if (parts[1] === 'login') return <MemberLogin />
  // 其他路由需要登录保护
  switch (parts[1]) {
    case undefined:
    case '':
    case 'dashboard':
      return <MemberDashboard />
    case 'projects':
      if (parts[2]) return <ProjectKanban projectId={parts[2]} />
      return <MemberProjects />
    case 'tasks':
      return <MemberTasks />
    case 'resources':
      return <ResourceCenter />
    case 'certificates':
      return <CertificateManager />
    case 'notifications':
      return <NotificationCenter />
    case 'directory':
      return <MemberDirectory />
    case 'profile':
      return <MemberProfile />
    default:
      return <MemberDashboard />
  }
}
```

### 鉴权流程

```
/member/* 访问
    │
    ├─ /member/login → 直接渲染
    │
    └─ 其他路径
        │
        ├─ localStorage 有 userToken？
        │   ├─ 是 → GET /api/member/me 验证
        │   │   ├─ 有效 → 渲染 MemberLayout + 页面
        │   │   └─ 无效 → 清除 token → 跳转 /member/login
        │   └─ 否 → 跳转 /member/login
```

### 前端鉴权 API（services/memberApi.ts）

```typescript
function memberRequest<T>(url: string, options?: RequestInit): Promise<T> {
  const token = getUserToken()
  if (!token) throw new Error('未登录')
  // 与 adminApi 相同的模式，但使用不同的 token key
}

export function getUserToken(): string | null {
  return localStorage.getItem('member_token')
}
```

---

## 七、数据库扩展（新增表）

### 资源/知识库

```sql
-- 资源文件夹
CREATE TABLE resource_folders (
    id INTEGER PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    parent_id INTEGER REFERENCES resource_folders(id),
    created_by INTEGER REFERENCES members(id),
    created_at DATETIME,
    updated_at DATETIME
);

-- 资源文件
CREATE TABLE resources (
    id INTEGER PRIMARY KEY,
    folder_id INTEGER REFERENCES resource_folders(id),
    name VARCHAR(300) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_type VARCHAR(50),      -- md/pdf/docx/image/...
    file_size INTEGER,
    version INTEGER DEFAULT 1,
    uploaded_by INTEGER REFERENCES members(id),
    is_deleted BOOLEAN DEFAULT 0,
    created_at DATETIME,
    updated_at DATETIME
);

-- 文件版本历史
CREATE TABLE resource_versions (
    id INTEGER PRIMARY KEY,
    resource_id INTEGER REFERENCES resources(id),
    version INTEGER NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    uploaded_by INTEGER REFERENCES members(id),
    created_at DATETIME
);

-- 资源分享
CREATE TABLE resource_shares (
    id INTEGER PRIMARY KEY,
    resource_id INTEGER REFERENCES resources(id),
    share_code VARCHAR(50) UNIQUE NOT NULL,
    expires_at DATETIME,
    created_by INTEGER REFERENCES members(id),
    created_at DATETIME
);

-- 资源评论
CREATE TABLE resource_comments (
    id INTEGER PRIMARY KEY,
    resource_id INTEGER REFERENCES resources(id),
    member_id INTEGER REFERENCES members(id),
    content TEXT NOT NULL,
    created_at DATETIME
);
```

### 通知

```sql
CREATE TABLE notifications (
    id INTEGER PRIMARY KEY,
    member_id INTEGER REFERENCES members(id),
    type VARCHAR(50) NOT NULL,  -- task_assigned/status_change/milestone/announcement
    title VARCHAR(200) NOT NULL,
    body TEXT,
    link VARCHAR(500),          -- 跳转链接
    is_read BOOLEAN DEFAULT 0,
    created_at DATETIME
);
```

### 证书

```sql
CREATE TABLE certificates (
    id INTEGER PRIMARY KEY,
    member_id INTEGER REFERENCES members(id),
    name VARCHAR(300) NOT NULL,
    level VARCHAR(20),           -- national/provincial/school/other
    category VARCHAR(50),
    winner VARCHAR(200),
    issuer VARCHAR(200),
    date VARCHAR(20),
    description TEXT,
    images JSON,                 -- 证书图片URL列表
    ocr_text TEXT,               -- OCR识别原始文本
    ocr_structured JSON,         -- OCR结构化结果
    related_project VARCHAR(100),
    status VARCHAR(20) DEFAULT 'pending',  -- pending/verified/rejected
    created_at DATETIME,
    updated_at DATETIME
);
```

### 成员扩展字段

```sql
ALTER TABLE members ADD COLUMN password_hash VARCHAR(255);     -- 成员登录密码
ALTER TABLE members ADD COLUMN phone VARCHAR(30);              -- 手机号
ALTER TABLE members ADD COLUMN student_id VARCHAR(50);         -- 学号（唯一标识）
ALTER TABLE members ADD COLUMN notification_prefs JSON;        -- 通知偏好设置
ALTER TABLE members ADD COLUMN last_login_at DATETIME;         -- 最后登录时间
```

---

## 八、实现路线

### Phase 1：基础设施（2-3天）
- [ ] 后端：Member 模型扩展（密码、学号等字段）
- [ ] 后端：成员认证 API（`/api/member/login`, `/api/member/me`）
- [ ] 前端：`MemberLayout` 布局框架
- [ ] 前端：`MemberLogin` 登录页
- [ ] 前端：鉴权 hook（`useMemberAuth`）
- [ ] 前端：路由注册（`/member/*`）

### Phase 2：核心功能（3-4天）
- [ ] 前端：`MemberDashboard` 工作台
- [ ] 前端：`MemberDirectory` 通讯录
- [ ] 前端：`MemberProfile` 个人资料（查看/编辑）
- [ ] 后端：成员资料编辑 API

### Phase 3：项目管理（4-5天）
- [ ] 后端确认：Milestone/Task API 支持用户端鉴权
- [ ] 前端：`MemberProjects` 项目列表
- [ ] 前端：`ProjectKanban` 看板视图（含拖拽）
- [ ] 前端：`MemberTasks` 任务聚合
- [ ] 前端：`TaskCard` 可拖拽卡片组件

### Phase 4：资源与证书（4-5天）
- [ ] 后端：资源中心 CRUD API + 文件系统
- [ ] 后端：证书管理 API + OCR 集成
- [ ] 前端：`ResourceCenter` + `FileExplorer`
- [ ] 前端：`CertificateManager` + OCR 上传

### Phase 5：通知与收尾（2-3天）
- [ ] 后端：通知系统 API
- [ ] 前端：`NotificationCenter` + `NotificationBell`
- [ ] 集成测试 + 端到端验证

---

## 九、设计原则

1. **视觉一致性**: 与 Admin 面板共享色彩、字体、圆角、阴影系统
2. **渐进增强**: 先实现核心流程，再添加 AI/OCR 等高级功能
3. **移动适配**: 侧栏在小屏自动折叠 + 汉堡菜单（与 AdminLayout 一致）
4. **性能优先**: 列表虚拟滚动、图片懒加载、API 响应缓存
5. **错误友好**: 每个页面都有加载骨架屏、空状态、错误重试状态
