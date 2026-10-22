# 内容页与页面信息优化（2026-10-22）

分支 `main`，HEAD `73e635c`；此前与本轮工作区修改均未提交。保留原Dock/更多分组、公开页全站视频与避让正文的装饰。

## 范围与已做

- 用户继续要求优化，本轮落实独立页面标题/描述/分享信息，以及五个专属CMS页面的共享缓存、错误提示、清空语义与后台失效通知。
- 新增 `pageContent.ts` 内容结构校验、`usePageData.ts`（复用60秒resourceCache）、`PageDataNotice.tsx`；接入about/research/cooperation/onboarding/recruitment。成功空数组不再回填默认列表；失败保留上次成功内容或明确标注默认说明；404表示未配置。
- 后台页面写入通知带具体slug，创建/导入失效全部页面，沿用同标签事件/跨标签storage通道；配置独立刷新不误刷新所有页面。
- 联系页改用共享config，去除第二次fetchSiteConfig和前端虚构地址/手机号兜底。关于页不再把Unsplash库存照片当作活动剪影；招新默认提示去掉过期春季状态。入门手风琴改为可键盘操作的真实按钮。
- 新增 `metadata.ts` 与 `useMetadata.ts`：按路由/详情生成title、description、canonical、OG/Twitter信息；私有/未知/缺失详情noindex，切换路由不残留旧详情信息，canonical不带查询/片段。生产域名可用VITE_PUBLIC_SITE_URL覆盖。
- 新增postbuild脚本为15个公开静态页面和3个登录/门户入口输出独立HTML头信息，以及sitemap.xml/robots.txt。构建不请求后台，不导出用户内容。动态项目/博客/奖项目前仍在客户端更新具体内容，完整的动态链接抓取预览需要后续服务端输出，不能记成全站SSR。

## 验证结果

- 本地与Docker `npm test` 均34/34通过，包含12项本轮新增校验/通知/元数据测试。
- 本地/Docker `npm run check` 通过，仍为46条已有lint警告、0错误。初次类型检查发现metadata label可能undefined，已修复并重跑通过。
- Docker已重建前端，Node24生产构建与postbuild成功：输出18个路由HTML、sitemap.xml、robots.txt。后端保持健康，未修改后端。
- 读取构建产物检查research/projects/login的独立标题、唯一canonical和应用资源引用；检查sitemap恰含15个公开静态路由、不含login，全部通过。`git diff --check`无空白错误，仅Windows换行提示。

命令：

```powershell
npm run check --prefix frontendnew
npm test --prefix frontendnew
docker compose --env-file .env.local up -d --no-deps --build frontend
docker compose --env-file .env.local exec -T frontend npm run check
docker compose --env-file .env.local exec -T frontend npm test
docker compose --env-file .env.local exec -T frontend npm run build -- --logLevel warn
git diff --check
```

## 浏览器与通知联动验收

- 3000研究页正常显示4个方向、无alert，标题「研究方向 · 星雨作坊」，canonical为正式域名/research，robots为index/follow。
- 项目详情加载后标题变为「AI科研&办公助手 · 星雨作坊」，description来自该项目，canonical含正确slug，og:title只有1个。进入不存在路由后为「页面未找到」且noindex；回到作品页后恢复作品标题和index。
- 在隔离3003响应代理中，研究页与PageDataNotice两个消费者只发送1次config和1次页面请求；503明确提示默认说明和重试，切回正常响应后重试恢复4个方向且清除alert。
- 代理提供一个测试按钮，导入真实adminSavePage；使用仅在3003有效的假token，PUT被代理拦截并返回模拟成功，其他所有真实写入请求被405拒绝。按钮调用真实authRequest/notify逻辑，经storage通知另一个标签刷新内容：切换空数组后方向数变0，再切换正常响应后恢复4项。真实数据库/账号/内容未改动。
- 模拟directions为错误对象，界面显示格式错误并保留默认说明，无渲染崩溃。模拟页面404显示「尚未配置」状态，非服务错误alert。
- 联系页正常加载表单，配置总计数验证该次全页打开只新增1次config请求，没有再独立fetchSiteConfig。
- 入门页首项真实按钮用Enter从expanded=true切至false，再切回true；无浏览器error日志。
- 截图：`C:/Users/wy339/.codex/visualizations/2026/10/22/01a1621f-3b13-7770-91ff-cd67db560e10/style-review/research-content-error.jpg` 与同目录 `onboarding-keyboard-metadata.jpg`。

## 下一步与尚未验证

- 本轮代码与本地验收已完成，仍在main/73e635c工作区，未提交。上线前应先核对后台示例地址、招新说明等真实内容，再做真实手机/弱网和GitHub托管CI/部署验收。
- 静态分享HTML使用构建时源码基础配置，运行时改后台不会立即改磁盘HTML，需要重新构建。动态详情仍需服务端渲染/生成才能让不执行JS的分享抓取器读到真实标题与封面；sitemap目前不含动态slug。
- 未进行真实手机/弱网、真实权限账号下保存到数据库后的跨标签验收；本轮验证的是模拟HTTP成功→真实前端保存函数→真实跨标签storage→数据重取链路。
- 未触发GitHub托管CI/生产部署，未进行后端pytest，也未启动生产nginx端到端环境。生产未知路由仍使用原SPA fallback，真正的HTTP404响应不在本轮范围；客户端404/noindex已验证。
- 临时测试服务在 `$env:TEMP/xingyu-content-qa`，本轮node进程已停止、测试标签已关闭；3003不是交付入口。正式本地入口保持3000。

本轮未新增依赖；前端使用Node24原生执行postbuild导入的纯TS模块。

已有长期记录见 `performance-content-2026-10-22.md`、`data-navigation-2026-10-22.md` 与 `public-style-2026-10-22.md`。
