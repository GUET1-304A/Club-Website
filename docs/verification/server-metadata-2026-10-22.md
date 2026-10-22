# 公开HTML交付与依赖修复验收（2026-10-22）

## 本轮范围与用户确认

- 用户继续授权优化；在此前内容/元数据阶段上补齐生产HTTP交付，不调整视觉方向。
- 保留原版纯图标Dock放大和“更多”两组；视频贯穿公开页面；边缘代码装饰继续避让主体/页脚。不要恢复液态玻璃导航或仅首页视频。
- 分支 `main`，HEAD `73e635c`；本轮及此前修改全部保留在工作区，未提交、未推送、未上线。真实开发数据库、用户账号、内容未写入。

## 做过什么

- 新增 `backend/routes/frontend.py`，由app工厂注册公开HTML蓝图。API-only开发默认不启用；生产配置 `FRONTEND_METADATA_FILE=/app/frontend-dist/metadata.json`。
- 前端postbuild导出单一构建清单（模板、静态路由表、基础配置、域名），复用现有TS元数据规则，保留原18路由静态HTML产物。后端读取这一构建的模板，转义输出唯一title/description/canonical/OG/Twitter标签，脚本、样式和主题初始化不变。
- 所有生产HTML请求经Nginx交给Flask。公开项目、奖项与已发布博客的实际标题/摘要/封面在不执行JS时即可读取；静态页站点名及首页简介取当前后台配置。正文仍由React渲染，不是完整SSR。
- 缺失路由/详情、博客草稿返回HTML 404与noindex，不泄漏草稿标题/正文。登录/门户/后台入口200且noindex/nofollow。构建清单缺失/损坏返回503、noindex、Retry-After:30；API/health不受影响。
- sitemap实时列出15个公开静态路由和当前公开详情slug，博客只包含已发布项；robots使用相同域名。canonical去除查询参数，使用受控配置域名，不信任请求Host。
- 生产Compose新增 `frontend_bundle_prod`，前端发布、后端只读挂载。入口脚本先复制资源，再原子替换包含模板的清单，保留旧哈希资源以兼容升级前已打开的标签。单发布者设计，不支持多个前端实例同时写这个卷。
- Nginx HTTP/TLS/示例配置同步：API/uploads使用优先前缀避免被资源扩展名规则截获；缺失资源真实404；详情slug即使含`.js`仍做发布状态检查；哈希资源缓存一年。内部清单/隐藏临时文件不公开。
- `.gitattributes`固定Docker入口脚本LF；`.dockerignore`补排除`.env.*`，避免本地环境文件进入镜像上下文。
- 构建时发现4项高危依赖告警。执行无force的`npm audit fix`，保持package.json现有兼容版本范围，更新lock：Vite8.1.3→8.3.5、PostCSS8.5.31、nanoid3.3.20、source-map-js1.2.2、rolldown1.2.15。审计现为0。Windows曾提示无法删除被占用的旧rolldown临时目录，但安装退出0；随后本地和Linux构建均成功。未自动清理这些node_modules临时文件。
- GitHub工作流加入高危审计与Python3.12公开交付测试，扩展后端/部署文件触发范围；仍只读检查，不部署。部署文档与前端README已更新。

## 验过什么

### 自动检查

- `python -m pytest backend/tests -q`：190通过，435条已有警告（测试JWT短密钥、SQLAlchemy旧API等），99.57秒。本轮新增公开交付模块27项用例；包括草稿隐藏、真实状态、头信息转义、Host无关canonical、取消发布即时生效、HEAD、清单热更/失败与API边界。
- `python -m pytest backend/tests/test_frontend_delivery.py backend/tests/test_deployment_contract.py -q`：本地33通过；隔离Docker Python3.12、requirements-dev所约束的pytest8.4.2再次33通过。
- 本地和重建后的开发Docker `npm test`：34通过。
- 本地/Docker `npm run check`：通过，仍为46条已有lint警告、0错误。
- 本地 `npm run build` 和生产Docker镜像构建：Node24/Vite8.3.5通过，18路由HTML与清单/sitemap/robots均产出。未并行运行同一目录的typecheck/build。
- 重建后的Docker `npm audit --audit-level=high --registry=https://registry.npmjs.org/`：0 vulnerabilities。
- `git diff --check`：无空白错误，仅Windows换行提示。

### 生产交付隔离验收

测试环境使用独立Compose项目 `xingyu-seo-qa`、仅回环3004端口、单独DB/uploads/bundle卷，Nginx生产镜像与Gunicorn1worker/4threads。测试库只放验收项目、奖项、两篇公开文章和一篇草稿；没有操作3000/5000的真实数据。

- 7条公开入口/详情原始HTTP响应有独立标题、唯一canonical、index/follow，即使Host为`attacker.example`和查询中带token也不污染canonical。
- 10类缺失路由/详情/草稿/资源/API/内部文件均404；HTML404带noindex，API/uploads保留JSON404，资源不返回React shell；X-Frame-Options/nosniff等安全头保留。
- 4类私有SPA入口200且noindex/nofollow；GET和HEAD均正确，HEAD无body。
- sitemap共19个URL（15静态+项目+奖项+两篇公开文章），无草稿；robots引用正确域名。
- 视频Range请求返回206和64字节，哈希资源max-age=31536000。带扩展名的合法博客slug`seo-qa.js`200；更新构建后，旧`index-C-FKKyOS.js`仍200，证明历史哈希资源保留。
- 暂移隔离卷清单：详情503/noindex/Retry-After，API与health仍200；finally恢复后详情立即200。
- `nginx -t`的HTTP生产配置通过。TLS配置使用一天有效的临时自签名证书做语法检查通过；已有`listen ... http2`弃用警告保留。没有使用或替换真实证书，没有浏览器绕过证书警告。
- 用仅含占位秘密文件路径的临时env分别执行生产Compose、生产+TLS Compose的`config --quiet`，均通过，不输出真实环境。

### 浏览器

- 3004项目详情正常渲染，标题与原始HTTP匹配；视频src为`/hero-bg.mp4`，原版导航仍在。
- 直接打开草稿显示“文章未找到”、noindex；点击“返回博客列表”恢复“博客动态”、index，列出两篇公开文章而无草稿，浏览器error日志为空。
- 截图：`C:/Users/wy339/.codex/visualizations/2026/10/22/01a1621f-3b13-7770-91ff-cd67db560e10/style-review/production-draft-404.jpg`。

## 命令与下一步入口

```powershell
python -m pytest backend/tests -q
python -m pytest backend/tests/test_frontend_delivery.py backend/tests/test_deployment_contract.py -q
npm test --prefix frontendnew
npm run check --prefix frontendnew
npm run build --prefix frontendnew
docker compose --env-file .env.local up -d --no-deps --build frontend
docker compose --env-file .env.local exec -T frontend npm test
docker compose --env-file .env.local exec -T frontend npm run check
docker compose --env-file .env.local exec -T frontend npm audit --audit-level=high --registry=https://registry.npmjs.org/
git diff --check
```

隔离验收脚本/响应记录/Compose配置位于 `$env:TEMP/xingyu-seo-qa/`，`check-http.py`为只读HTTP断言，`http-results.json`保存响应摘要；Compose需显式`-p xingyu-seo-qa -f "$env:TEMP/xingyu-seo-qa/compose.json"`。不要把它与正常开发/生产卷混用。这里的临时私钥仅用于语法检查，勿用于部署。

已执行该隔离项目的`down --volumes`，删除两个验收容器、隔离网络及三个验收卷；临时脚本和报告保留，临时证书勿用于部署。日常预览继续使用3000；开发Vite仍有自己的SPA fallback，真正HTTP404和服务端分享标签属于生产Nginx/Gunicorn交付。

生产升级使用 `docker-compose.prod.yml` 同时重建前后端，并设置 `PUBLIC_BASE_URL`（Compose同步传给前端构建）。不要只换Nginx配置而遗漏新版后端、构建清单和共享卷。共享交付卷可重建，无需备份；数据库/上传卷仍需原流程备份。

## 还有哪些没验

- GitHub托管CI尚未触发；Python3.12同等测试命令已在本地隔离容器通过。
- 未部署线上，未使用线上TLS证书/域名做真实流量验收，未验证微信/QQ等第三方抓取器和它们自己的预览缓存。现在已具备无需JS的OG/Twitter输出，不代表各平台都已实测。
- 未做真实手机、弱网、无障碍读屏、多副本部署、长时间负载或大规模sitemap测试。
- 正文仍为客户端渲染；若需要完整正文搜索抓取，可在后续独立阶段评估SSR。不要在本阶段宣称已做全站SSR。
- 历史阶段尚未验证的真实账号后台保存→公开站点跨标签端到端仍未补做；本轮DB变更测试全部使用隔离库。

此前阶段记录：`content-metadata-2026-10-22.md`、`performance-content-2026-10-22.md`、`data-navigation-2026-10-22.md`、`public-style-2026-10-22.md`。
