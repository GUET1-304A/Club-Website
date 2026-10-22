# 星雨作坊前端

React 19 + TypeScript + Vite。请使用 Node.js 24，依赖由 `package-lock.json` 固定。

## 开发与检查

```sh
npm ci
npm run dev
npm run check
npm test
npm run build
```

开发地址为3000端口，`/api`、`/uploads` 和 `/health` 代理到后端5000。在项目根目录用Docker运行：

```sh
docker compose --env-file .env.local up -d --build
docker compose --env-file .env.local exec -T frontend npm run check
docker compose --env-file .env.local exec -T frontend npm test
docker compose --env-file .env.local exec -T frontend npm run build
```

不要输出或提交环境文件里的密钥。Windows源码热刷新失效时重启frontend；新增测试或修改package.json后重建镜像，因为它们不在源码挂载列表中。

GitHub Actions在前端/公开交付相关的push/PR上执行依赖安装、高危依赖审计、类型检查/lint、测试、生产构建，并用Python3.12检查公开HTML与部署契约；支持手动触发。配置见根目录 `.github/workflows/frontend.yml`。当前已有lint警告不阻断检查，新增错误会失败。该工作流不会部署网站。

## 数据与资源

- `useSiteData` 共享公开集合缓存，60秒后在进入页面或重新获得焦点时更新。失败和空数组分开处理；成功的后台写入通知同源标签失效。不要重新接入演示数组来掩盖失败。
- 开源页从后台已发布项目的 `githubUrl` 读取仓库，排除无仓库链接的项目并去重。技术栈来自后台；没有实时抓取GitHub统计，也不显示伪造的Star/Fork数。修改后台项目后，作品页和开源页使用同一份数据。
- `public/hero-bg.mp4` 是12.04秒、24fps、1600×894的H.264无音轨背景视频，约1.4MB，MP4元数据前置。原版可从提交 `73e635c` 恢复；不要拿压缩版反复转码，替换时从原始素材编码。
- 推荐从原始视频执行：`ffmpeg -i original.mp4 -map 0:v:0 -vf scale=1600:-2 -c:v libx264 -preset slow -crf 26 -pix_fmt yuv420p -an -movflags +faststart hero-bg.mp4`。
- `npm test` 会检查默认视频小于4MiB、MP4支持逐步播放、海报小于120KiB。自定义后台视频仍由内容维护者负责优化。
- 视频保留在全部公开页；先显示海报，配置就绪后利用空闲时间加载，页面隐藏时暂停，播放失败继续显示海报。移动端/减少动画/省流模式沿用海报降级。

本轮验收与未验证事项见根目录 `docs/verification/performance-content-2026-10-22.md`，前一轮数据/导航记录见 `docs/verification/data-navigation-2026-10-22.md`。

## 内容页与页面信息

关于、研究、合作、入门、招新使用 `usePageData` 共享缓存和重试提示。缺少字段使用默认说明，明确保存的空数组/空字符串保持为空；错误结构会显示格式错误，不使页面崩溃。页面保存只刷新对应slug，新增/导入刷新全部页面。

页面标题、描述、canonical、OG/Twitter标签随路由和具体详情更新。`VITE_PUBLIC_SITE_URL` 可设置正式站点的HTTP(S) origin，默认 `https://304aistudio.cn`；canonical不包含查询参数/片段。登录、管理后台、成员门户和不存在页面设为noindex。

`npm run build` 的postbuild步骤为15个公开静态页、3个登录/门户入口生成独立HTML头，并输出 `sitemap.xml`、`robots.txt` 和内部交付文件 `metadata.json`。独立静态托管仍使用构建时配置。

生产Docker使用共享构建卷：Nginx直接提供静态资源，Flask读取同一构建的模板和路由表，为HTML请求生成分享信息与状态码。项目、奖项和已发布博客的标题/摘要/封面在HTML响应中即可读取，草稿和缺失详情返回404/noindex；站点地图实时包含公开详情。后台编辑内容或站点名称后，下一次服务端请求即可生效。页面正文仍由React渲染，不是完整SSR。

生产部署请设置 `PUBLIC_BASE_URL`，Compose会同步传给前端构建的 `VITE_PUBLIC_SITE_URL`，避免浏览器和服务端的canonical域名不一致。修改域名需重建前端；构建清单不可用时返回503，可重试。详见根目录 `docs/deployment.md`。

发布流程现在先检查完整工作区和测试，再按提交号构建前后端；生产`/health/ready`验证数据库、前后端版本与入口资源。发布前自动备份SQLite/上传文件，并在无网络、无业务卷的临时容器中恢复校验。使用`powershell -File scripts/deploy-prod.ps1 -CheckOnly`可仅运行本地门禁；未提交文件会被明确拒绝，不会上传或上线。操作和限制见根目录部署文档。

本阶段验证记录见 `docs/verification/content-metadata-2026-10-22.md`。
