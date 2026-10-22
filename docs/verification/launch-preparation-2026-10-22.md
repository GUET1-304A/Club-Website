# 上线准备复审与隔离验收（2026-10-22）

> 最新进展见 `python-host-2026-10-22.md` 与《生产更新手册》：已补齐正式提交/托管CI和宿主Python解阻；旧版03:00定时备份实际存在，异地副本及真实恢复未验。下文保留本阶段当时的验证记录。

## 范围与实际状态

- 用户要求审查全部待发布改动、修复问题、补齐本地/隔离验收并更新交接；明确不正式部署、不覆盖生产数据。没有向 GitHub 推送、向线上上传或操作线上数据。
- 原仓库 `main`，HEAD `73e635c19b88ce117e67c7a849deb96c837229c2`；全部既有与本轮修改保留在未提交工作区。未修改原仓库分支、提交或暂存区。
- 正常开发容器 `xingyu-frontend` / `xingyu-backend` 保持运行，入口 3000 / 5000，后端 healthy；本轮没有重启正常开发后端，没有对其数据库发出写请求。
- 实际读取根 AGENTS.md、release-recovery 交接及 deployment.md，审查 Git diff 与未跟踪新增源码、测试、CI、部署配置。覆盖公开页/UI、共享缓存与导航、元数据/生产 HTML、依赖锁、Docker/Nginx、发布门禁及备份恢复链路。

## 本轮修复

1. **TLS 容器健康检查**：原 HTTP 探测会被 308 重定向至 HTTPS 本机地址，引发证书名称/信任错误，生产 `up --wait` 无法通过。TLS 配置新增只监听 `127.0.0.1:8080` 的 readiness 入口，TLS override 使用该入口；公共 HTTP 继续重定向，公共 HTTPS smoke 继续正常校验证书，没有 `--no-check-certificate`。
2. **阻止意外切换业务存储**：prepare-compose 在构建/停旧后端前核对实际旧容器的 DATABASE_URL、UPLOAD_FOLDER、数据卷/绑定挂载及最深覆盖挂载。改数据库文件、上传路径、卷名或隐藏嵌套挂载会拒绝发布；拒绝多后端写入者。备份/升级对已启用 OSS 的旧实例明确拒绝，不能把本地文件快照误认为完整对象存储备份。
3. **CMS 缓存失效**：公开页卸载后仍保留失效订阅，修复同标签跳到后台保存、60 秒内返回公开页仍显示旧缓存；保留 HMR 清理。真实隔离库下已验证卸载→保存→重新显示及另一标签同步刷新。
4. **详情 URL 元数据**：中文路径与浏览器百分号编码路径统一后匹配详情覆盖；服务端 canonical/sitemap 正确编码字面百分号，避免 `%20` 等 slug 被解释成其他资源。
5. **扩大验收/CI**：smoke 覆盖全部 15 个公开页、三个私有入口、三类真实详情和三类缺失详情。CI 后端任务改为全量测试，容器安装 Git、Docker CLI 和 Compose（测试只解析配置，不需要 Docker daemon）。`compose.release.json` 加入 Git ignore。
6. **缺失头像**：浏览器检查发现没有作者头像时的空 src React 错误；博客列表跳过缺失头像，成员头像使用现有本地占位图并处理加载失败。

视觉不改版：原版纯图标 Dock（7 个直达入口+更多）、“探索与合作/成长与记录”分组、所有公开页面的视频背景，以及避开主体、裁掉页脚区域的边缘代码装饰均保留。移动端/减少动画/省流沿用原海报降级。

## 验证结果与证据

### 完整门禁与测试

- 基线原目录后端：`python -m pytest backend/tests -q`，203 passed、3 Windows POSIX skipped、435 条既有警告。
- 修复后隔离源码副本提交 `be49c3f6fceccd918e5e2901113c1d548c9babe4`，完整 `release.py preflight` 成功：Node24 npm ci/check、35 项前端测试、audit 0 vulnerabilities、build/postbuild；Windows Python3.14 后端 211 passed、3 POSIX skipped。原仓库未提交；副本提交仅用于验证 clean-main 门禁。
- Python3.12 Linux 全量：214 passed，无跳过、435 条既有警告；包括 Windows 跳过的远端 Bash build/smoke/orphan 失败用例。首次基础 Python 镜像缺少 Git/Docker CLI 导致两项环境失败，安装 `git docker-cli docker-compose` 后完整重跑通过，CI 使用同一命令。
- 前端仍有 46 条既有 lint 警告，0 error；未扩大清理旧警告。
- 原仓库 Windows PowerShell5.1 `scripts/deploy-prod.ps1 -CheckOnly` 退出 1，明确报告 tracked/untracked changes；没有进入 push/upload/远端执行。该结果是有效门禁，不能绕过。
- PowerShell Parser、`git diff --check` 和现有生产交付契约测试通过。
- 最后头像修复和 CI/文档调整后的最终快照/检查结果见下方收尾追加，不能把早期副本哈希当作最终正式发布 SHA。

### 实际生产配置、TLS 与业务写入（均隔离）

- 本轮项目名 `xingyu-launch-prep`，源码、随机测试秘密文件、两天有效的本地测试证书均在 `$env:TEMP/xingyu-launch-prep-20261022/`。没有读取/打印真实 `.env.local` 密钥。
- 使用实际生产 Compose+TLS override，经 prepare-compose 解析，保持生产模式、无 demo 成员、文件秘密挂载、独立业务卷。只将测试端口映射到回环 3080/3443，未暴露真实后端端口。
- 两个生产镜像构建、`up -d --no-build --wait --wait-timeout 120` 通过。TLS frontend health 使用内部 8080，无证书豁免。
- HTTPS 客户端仅信任本轮测试 CA，正常验证 IP SAN/证书；公共 HTTP smoke：25 个页面检查、4 个入口资源、3 类实际详情，emptyCollectionsSkipped=0，sitemap/robots/安全头/readiness/版本一致通过。
- 在隔离库真实登录 bootstrap 管理员、创建项目/奖项/公开博客/草稿、保存研究页、提交留言和报名并从后台读取；无 token 写入被 401 拒绝。草稿页面 404，不泄漏标题/正文。测试工具最初将创建成功的 201 写成 200、并使用过短报名动机，修正验收工具后通过；期间重复留言 429/短动机 400 均是正确业务保护。
- 对现有隔离容器执行 prepare-compose：相同实际存储接受；改变 DATABASE_URL 则拒绝。损坏包与错误版本 smoke 均非零退出，原始备份未覆盖。

### 备份、恢复与恢复后的真实启动

- `recovery.py ... backup` 真正停/重启隔离后端，源挂载只读、无网络 helper 备份；21 张表和 `qa/中文证明.txt` 文件一致校验、无网络临时恢复通过。
- 首个验收包：`backups/20261022T121746Z-addf5438`，记录源镜像/源版本、文件哈希和表行数；仅含本轮虚构测试数据。
- 使用全新命名卷 `xingyu-launch-prep-restored-db`、`xingyu-launch-prep-restored-uploads` 还原，独立 `xingyu-launch-restore` 后端真实启动。readiness、原 bootstrap 管理员登录、项目/公开博客/CMS 备份时快照、留言/报名后台读取、中文上传文件字节全部通过。
- 恢复环境共享构建产物卷为只读；没有挂载正常开发或生产业务卷。初次恢复 Compose 继承了 QA 网络名，已改为独立 `xingyu-launch-restore_default` 并重建为 healthy；这是测试拓扑修正，不涉及业务数据。
- 此处比仅离线行数/哈希验证更进一步，但仍不代表真实生产账号、真实业务数据和线上切流已经验证。

### 浏览器与视觉

- 回环 3005 的临时 UI 代理：页面/源模块由正常 3000 Vite 提供，所有 API/上传请求只送到本轮隔离 TLS 后端并验证测试 CA；其余非 GET/HEAD 请求拒绝。正常 5000 数据库不接收测试写入。
- 使用真实 `usePageData`、`adminSavePage` 模块：初始内容→卸载公开页→真实保存→重新显示，立即变为新内容；另一真实研究页标签由“跨标签保存前”自动变为“保存后新版本”，未刷新标签。
- 1280px 桌面：Dock 为纯图标，更多菜单含两个分组；研究页主体 x=85..1185，装饰分别 x=16..69 和 x=1201..1254，均在主体外。视频 readyState=4、正常播放。
- 全部 15 个公开路由逐页检查视频节点存在、无横向溢出、无 alert；四个异步页面另等待 h1 完成后复核标题。最初 343px 移动视口无视频节点/无装饰，符合既有降级逻辑。
- 截图与 UI 结果：`C:/Users/wy339/.codex/visualizations/2026/10/22/01a16377-0481-7903-a4b9-b26356523a76/release-preparation/`。
- 空 src 错误已定位并修复；修复后浏览器回归结果见收尾追加。

## 可复现命令与材料

```powershell
# 脏工作区应失败，且不推送/上传/部署
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/deploy-prod.ps1 -CheckOnly

# 全量门禁必须在完整提交后的干净 main 执行
python scripts/release.py preflight --repo . --report "$env:TEMP/release-final.release-report.json"

# 隔离构建/启动；compose.json 含测试运行配置，不应提交或共享
docker compose -p xingyu-launch-prep -f "$env:TEMP/xingyu-launch-prep-20261022/compose.json" build
docker compose -p xingyu-launch-prep -f "$env:TEMP/xingyu-launch-prep-20261022/compose.json" up -d --no-build --wait --wait-timeout 120
python scripts/recovery.py --project xingyu-launch-prep -f "$env:TEMP/xingyu-launch-prep-20261022/compose.json" backup --output "$env:TEMP/xingyu-launch-prep-20261022/backups"
git -c core.safecrlf=false diff --check
```

QA 目录包含 source/（独立 Git）、runtime/（仅测试凭据/证书）、compose.json、build.log、preflight.log、preflight-result.json、linux-tests-complete.log、http-result.json、negative-result.json、restore-runtime-result.json、backups/ 与 corrupt-backup/。本轮原项目未生成运行配置或备份包。

## 尚未验证与正式发布下一步

- **尚未执行**：GitHub 托管 CI、真实 Workbench/ECS 上传及远端返回封装、真实域名/TLS/反代连通性、线上备份、真实数据恢复切流、真实账号端到端流程、真实手机/Safari/弱网/GPU性能、社交平台真实抓取、OSS/OCR/AI/邮件/飞书/QQ 等外部服务。
- **正式发布前必须做**：核对实际服务器 Compose 项目名、根目录 `.env`、证书域名/有效期、秘密文件权限、真实存储路径/挂载及内容配置；不要沿用测试项目名/测试凭据/测试证书。新存储门禁若拒绝，调查差异并做独立迁移，不能删门禁。
- 将全部要发布的源码、脚本、测试、CI 和文档形成完整提交；不把运行配置/数据/秘密放进 Git。保持 clean main，然后在该正式 SHA 上运行 `-CheckOnly` 和托管 CI。这次临时副本通过不能代替正式提交的门禁结果。
- 用户另行授权正式发布后，才运行 `scripts/deploy-prod.ps1`。它会构建、备份/恢复演练、启动、内外 HTTP 版本验收；保留旧镜像、源码目录和备份，按 deployment.md 处理失败。不得直接解压覆盖旧安装、删除业务卷或自动恢复覆盖数据。
- 日常定时/异地备份尚未配置；当前本地 SQLite/上传、单写入者适配器不覆盖对象存储/外部数据库，也不能用镜像回滚自动撤销迁移或新写入。

## 收尾追加

- 最终隔离源码提交 **`0a46a38db15e8ce74ebb55c8038ad96293040186`**（仅在 QA/source 的独立 Git 中；不是原仓库提交）。使用 Windows PowerShell5.1 实际执行该副本的 `scripts/deploy-prod.ps1 -CheckOnly`，完整退出0：前端35测试、check/build/postbuild、audit 0；后端211 passed/3 Windows POSIX skipped/435既有警告。日志 `final-checkonly.log`。Linux214项验证的后端源码与此最终快照相同。
- 最终两个生产镜像按该 SHA 重建，先 build，再对旧隔离后端备份/恢复演练，再 `up --no-build --wait` 升级；backend/frontend 均 healthy。新增包 `backups/20261022T123816Z-77731e66` 仍记录升级前的 be49 源镜像/版本，这符合备份旧版本的设计。
- 最终 HTTPS smoke 再次通过25页面检查、4入口资源、3类详情、0空集合跳过，结果 `final-http-result.json`。Nginx `-t` 通过；存在两条既有 `listen ... http2` 弃用提示，没有语法错误。CI YAML解析通过，部署契约6项通过，PowerShell Parser和diff空白检查通过。
- Windows挂载未及时刷新Vite转换缓存，已执行 `docker compose --env-file .env.local restart frontend`；正常开发后端未重启。之后新建浏览器标签验证博客列表与详情 `img[src=""]` 为0、error日志空；最终CMS卸载→保存→返回也重新通过、error日志空。临时UI工具需使用当前Vite带版本hash的React依赖URL，避免工具自己载入两份React；已修正工具后才记录最终结果。
- 最终清理：3005临时UI代理已停止；本轮临时验收浏览器标签已关闭，正常3000作品预览保留。本轮 `xingyu-launch-prep` / `xingyu-launch-restore` 两个项目的3个容器、2个网络及5个测试数据卷均删除；按 `docker ps`/`docker volume ls`/`docker network ls --filter name=xingyu-launch` 复核无残留。本轮测试镜像、备份包、源副本与日志保留便于复核。此前阶段的其它项目/资源未动。
- 最终原仓库仍 **main / `73e635c19b88ce117e67c7a849deb96c837229c2`**，暂存区为空，所有修改未提交；正常3000前端运行、5000后端healthy。本文件的收尾记录及AGENTS摘要在快照验证后追加，应用/测试/CI源码未再改变。
- 当前结论：**本轮可在本地和隔离环境完成的上线准备已完成；正式发布尚被原仓库未提交门禁拦住，线上专项仍待发布窗口验证。** 下一会话先读本文件和AGENTS.md，核对实际Git/Docker状态后从“完整正式提交→CheckOnly→托管CI→另行授权的发布窗口”继续。
