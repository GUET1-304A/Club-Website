# 数据与导航优化（2026-10-22）

分支 `main`，HEAD `73e635c`，修改尚未提交，保留此前的工作区样式修改。此前样式验证见 `public-style-2026-10-22.md`。

## 用户确认的范围与外观

用户「按照你的推荐来」后，本轮按已说明的优先级落实三项：区分加载失败和真实空数据；共享请求缓存与后台保存后的失效刷新；修复站内导航和搜索跳转。

继续保留原版纯图标 Dock + 更多分组、全部公开页面的视频背景、避让主体的侧边代码装饰。移动端/减少动画/省流模式继续沿用原有视频降级规则。不重新启用液态玻璃或常显文字导航。

## 已完成

- `src/store/resourceCache.ts` 按资源去重在途请求，缓存60秒；错误可强制重试，刷新失败保留上次成功内容；失效后旧响应不能覆盖新响应。
- `useSiteData.ts` 使用React共享订阅，按页面实际需要请求 config/projects/members/awards/blogPosts；进入页面、窗口获得焦点/可见时检查缓存期限，没有新增定时轮询。
- 移除成员/奖项/博客的演示数组兜底；成功空数组显示空态。配置保留基础文案兜底并单独提示错误，统计不回填演示数字。
- `DataState.tsx` 接入主要公开列表与首页区块：加载中、首次失败、刷新失败、真实空态可区分，错误支持重试。修复空成员导致 CircularCards 崩溃，以及 JoinSection 粒子持有初始空缩略图的问题。
- `api.ts` 保留HTTP状态的ApiError，公开GET/HEAD请求15秒超时。三个详情页通过usePublicDetail区分404和请求故障，并支持重试；slug切换重置页面状态。
- `adminApi.ts` 仅成功写入后发出受影响资源的失效通知；同标签CustomEvent + 同源其他标签localStorage通知。导入失效全部集合，成员/项目/奖项写入也刷新配置统计。仅广播资源名/版本，不传输内容或凭据。
- `navigation.ts` 与useClientNavigation保留查询/片段，同源普通左键才拦截；Ctrl/Cmd、其他修饰键、中键、下载、外链、API/uploads保留原生行为。Back/Forward使用独立历史key恢复滚动，等待懒加载内容布局后定位。
- 后台 `components/admin/router.ts` 订阅统一导航事件并复用navigate；首页键帽球和FolderGallery也使用共享导航，避免制造假的popstate。
- 搜索结果为真实链接，普通点击走SPA；支持大小写无关搜索、上下键、回车和Escape，关闭后焦点可返回搜索按钮。项目/博客跳转不再留下隐藏标题筛选；成员搜索显示可清除条件，并切回全部组别避免结果被原组别隐藏。
- 添加 `npm test`，使用Node24内置runner，无新增依赖。

## 命令与结果

在项目根目录执行，必须带环境文件，不输出其中密钥：

```powershell
docker compose --env-file .env.local up -d --build frontend
docker compose --env-file .env.local exec -T frontend npm run check
docker compose --env-file .env.local exec -T frontend npm test
docker compose --env-file .env.local exec -T frontend npm run build
docker compose --env-file .env.local ps
git diff --check
```

- Compose重建并启动成功；frontend 3000运行，backend 5000健康，保留原有数据库/上传卷。
- typecheck通过；lint **46 warnings、0 errors**。此前49条中的三个详情hook依赖警告随重构消除，其余为已有警告。
- Docker与本地 `frontendnew/` 下 `npm test` 均为 **15/15通过**。覆盖并发去重、真实空集合、部分失败、立即重试、旧数据保留、TTL、失效竞争、订阅清理、HTTP状态/超时、链接判断与写入/跨标签通知规则。
- 最终构建通过（Vite构建4.28秒）；`git diff --check` 无空白错误，仅提示Windows的LF/CRLF转换。

## 浏览器验收

使用CUA背景标签访问Docker。临时本地3002代理转发3000，只在响应侧模拟503或空集合，没有修改数据库、登录后台或保存真实内容。

- 初次首页五类接口各请求1次，多个消费者和StrictMode没有重复发同一集合请求。
- 正常项目搜索AI得到3个结果；方向键移动焦点，回车进入相应详情；Escape关闭后焦点返回触发按钮。
- 同一次SPA内先打开星讯智面，再打开AI科研&办公助手，详情标题正确更新。
- 返回项目列表恢复到滚动1088px处；Ctrl点击没有替换当前列表路由。新标签是否打开受内嵌浏览器行为限制，修饰键分支另有单元测试。
- 成员接口503显示「成员加载失败」和重试；切回正常响应后点击重试恢复成员。先选星绘组，再搜索穆天宇，结果切回全部并仅显示目标成员；清除后恢复12名首屏成员。
- 四个集合同时返回空数组，首页保持完整且无浏览器错误，不出现演示成员；博客显示「暂无匹配的文章」。
- 不存在项目详情的503显示「内容加载失败」；恢复正常后重试得到后端真实404，显示「项目未找到」。
- 正式3000地址正常项目搜索、视频仍在，浏览器没有error日志。
- 尝试390px视口覆盖，但内嵌浏览器仍报告1270px，因此**不计为移动端验收**；已reset覆盖配置。

截图绝对目录：`C:/Users/wy339/.codex/visualizations/2026/10/22/01a1621f-3b13-7770-91ff-cd67db560e10/style-review/`。
`members-request-error.jpg` 为模拟故障提示；`project-search-reliability.jpg` 为正式3000搜索效果。

## 未验证与后续入口

- 未对真实后台执行增删改/导入，因此真实权限账号下的保存→其他标签即时刷新的完整端到端未验；事件映射、通知和存储不可用降级有自动测试。
- 未执行后端pytest、真实手机触控、弱网设备性能评测；移动端既有样式的此前验证见样式文档。
- 页面专属fetchPage的静态文案兜底未全面重构；本轮缓存范围为五类公开集合/配置。
- 后续从视频资源压缩、开源项目数据接入、CI检查、SEO与运维配置继续，不应将它们记成已完成。
- Windows挂载源码有时不触发Vite：使用 `docker compose --env-file .env.local restart frontend` 后刷新。package.json/tests不在源码挂载列表，修改它们后重建前端镜像。
- 临时代理代码位于 `$env:TEMP/xingyu-public-qa`，验收后停掉对应node进程，3002不作为交付入口。交付预览仍为 `http://127.0.0.1:3000/`。
