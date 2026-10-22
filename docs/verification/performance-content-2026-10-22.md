# 性能、真实内容与搜索优化（2026-10-22）

分支 `main`，HEAD `73e635c`，本轮和此前修改均尚未提交。下一轮保留这些工作区修改，不要reset。前一轮记录见 `data-navigation-2026-10-22.md`；既有外观决策见 `public-style-2026-10-22.md`。

## 用户结论与范围

用户要求继续优化。已告知本轮处理背景视频性能、开源页真实数据、搜索展示和前端自动检查。保留原版Dock/更多分组、全站公开页面视频、避让主体的侧边装饰，不重新尝试液态玻璃或限制视频只在首页。

## 完成内容

### 背景视频

- `frontendnew/public/hero-bg.mp4` 从 **14,142,575字节降为1,399,809字节，减少90.10%**。仍保留12.04秒、24fps、完整原始场景与循环，分辨率从1924×1076变为1600×894，H.264/yuv420p无音轨，MP4使用faststart。原始资源仍可从提交73e635c恢复。
- 通过临时安装的 `imageio-ffmpeg 0.6.0` 所带FFmpeg7.1编码。仅安装在 `$env:TEMP/xingyu-video-tools`，未修改项目依赖或系统全局Python。
- 编码参数：`-map 0:v:0 -vf scale=1600:-2 -c:v libx264 -preset slow -crf 26 -pix_fmt yuv420p -an -movflags +faststart`。中间输出和同帧截图在 `$env:TEMP/xingyu-video-qa`。
- 目视对比3秒处原版与压缩版的960px宽截图，画面基本一致；完整压缩视频解码退出0，无错误。
- 新增 `BackgroundVideo.tsx`：配置首次加载完成或失败后，在浏览器空闲时加载视频，避免先加载默认资源再重复加载自定义资源；先显示海报，初始隐藏标签暂缓加载，页面隐藏时暂停，重新显示时恢复；自动播放拒绝/资源失败保留海报。移动端、减少动画、省流规则仍由App原有逻辑决定。
- index.html预加载41,644字节的海报，提高JS内容加载期间的背景可见性。
- 新增媒体测试：默认视频小于4MiB、moov在mdat之前、海报小于120KiB，防止后续意外加入过大资源。

### 开源页

- 移除3个示例仓库和写死的Star/Fork数字；使用共享 `projects` 缓存读取已发布项目的githubUrl。
- 当前真实数据中6个项目有5个仓库链接，页面显示这5项的名称、owner/repo、说明和技术栈；仓库链接直达对应GitHub，内部「项目介绍」走SPA。
- 仓库地址规范化为https，去除.git/查询/片段；排除资料页、深层链接、非GitHub域名、凭据和自定义端口，重复仓库只显示一次。
- 页面没有请求GitHub API、没有承诺实时Star数，也没有确认仓库许可证或可访问性。源码入口来自后台配置。
- 接入DataState，空数据有明确空态，失败沿用前一轮可重试提示。

### 搜索

- 搜索面板使用主题变量，支持深色背景、可见的焦点与悬停；加宽面板，标题最多2行，摘要最多2行，避免长标题被单行截断。
- 分类显示中文；项目按技术栈、成员按技能、博客按标签加入关键词检索。相同标题/简介不重复展示，改为显示技术栈摘要。
- NFKC规范化全角输入，大小写无关；多个空白分隔词都需要匹配。完整标题/前缀/标题包含优先于正文，等分结果保持后台顺序。
- 保留原生链接、上下方向键/回车/Escape操作，输入法组合期间不处理方向键，点击外部使用pointerdown兼容触摸。

### 自动检查与文档

- `.github/workflows/frontend.yml` 在前端相关push/PR及手动触发时运行Node24的 `npm ci`、`npm run check`、`npm test`、`npm run build`。
- 只读contents权限，15分钟超时、同分支新任务取消旧任务，npm锁文件缓存；两个官方action固定完整提交SHA，通过 `git ls-remote` 核实v4标签对应提交。没有部署步骤或密钥要求。
- 使用PyYAML BaseLoader解析，核对触发器、步骤、只读权限与40位action提交固定，检查通过。GitHub托管环境尚未运行，因为没有提交/推送。
- 用真实前端说明替换模板README，记录Node版本、Docker使用、缓存、开源数据来源和媒体预算。

## 已执行的检查

```powershell
docker compose --env-file .env.local up -d --no-deps --build frontend
docker compose --env-file .env.local exec -T frontend npm run check
docker compose --env-file .env.local exec -T frontend npm test
docker compose --env-file .env.local exec -T frontend npm run build
npm test --prefix frontendnew
git diff --check
```

- 本地与Docker **22/22测试通过**，其中7项为本轮新增（仓库3、搜索3、媒体预算1）。
- 类型检查通过，lint仍为 **46条已有警告、0错误**；生产构建通过。
- Docker前端已重建并在3000运行；后端未重建或修改，5000保持健康。HEAD请求确认实际提供的新视频长度为1,399,809字节。
- `git diff --check` 无空白错误，只有Windows LF/CRLF转换提示。

## 浏览器验证

- CUA背景标签访问3000开源页，5个项目仓库地址与公开API数据一致；没有示例仓库和伪造统计。
- 视频readyState4、paused=false、videoWidth1600，src为本地hero-bg.mp4；场景和全站视频继续保留。
- 搜索 `ＡＩ Python` 仅命中AI科研&办公助手；AI搜索能命中技术栈含AI Agent的当空项目；标题优先顺序和中文分类正常。
- 切换深色检查搜索面板、摘要、分类，截图可读；检查完成还原为浅色。
- 临时3002代理只改响应：模拟后台配置自定义视频404，页面移除失败video并保留海报，内容和仓库仍可访问；请求计数没有先加载默认hero-bg.mp4。再模拟项目空数组，页面显示「公开仓库整理中，欢迎先浏览我们的项目。」。
- 正常3000页无浏览器error日志。模拟404产生的资源日志属于预期故障测试。
- 截图目录：`C:/Users/wy339/.codex/visualizations/2026/10/22/01a1621f-3b13-7770-91ff-cd67db560e10/style-review/`，本轮 `open-source-real-projects.jpg`、`search-refined-dark.jpg`。

## 未验证与后续接续

- GitHub托管CI未触发；没有提交、推送或部署。
- 没有验证所有外链仓库的公开状态/许可证，也未引入GitHub实时统计同步。
- 没有真实手机触控/弱网性能数据、没有完成真实浏览器后台标签暂停恢复的端到端检查；页面可见性处理通过代码检查，播放与资源失败回退通过浏览器验证。此前390px视口覆盖工具未生效的问题仍见前一轮文档，不应把桌面截图当作移动端验收。
- 未执行后端pytest，本轮未修改后端；真实后台保存→其他标签的端到端仍未验证。
- 下一步可处理页面独立标题/分享信息与SEO、专属fetchPage的错误/缓存处理、后台真实联动验收。不要将这些记成已完成。
- 临时代理位于 `$env:TEMP/xingyu-public-qa`，本轮node进程已停止，测试标签已关闭；3002不是交付入口。
