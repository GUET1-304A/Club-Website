# 正式生产发布交接（2026-10-22）

## 授权、版本与边界

- 用户明确要求“可以更新服务器上的旧版项目了”，授权本次正式发布。发布前 `main / 993c555eeb823427a37e1e71af727b337a301d05` 与 `origin/main` 相同，工作区干净。
- 交付版本固定为 `993c555eeb823427a37e1e71af727b337a301d05`。本文件如在发布后另行提交，Git 最新文档提交可能更新，但**线上应用版本仍为这个固定提交**；不能把文档提交误报成线上版本。
- 服务器为 `cn-wulanchabu / i-0jlhp604zk2b4ddh7683`，项目 `304aistudio`，安装根 `/srv/304aistudio`，域名 `https://304aistudio.cn` 和 `https://www.304aistudio.cn`。服务器不直连 GitHub，按项目 Workbench 发布脚本上传归档。

## 发布前已确认

- 对该固定提交的[GitHub CI 运行 39795264082](https://github.com/GUET1-304A/Club-Website/actions/runs/39795264082)：`check` 与 `backend` 均 success；托管 Linux 后端 **216 passed**，前端 **35 passed**，依赖审计 0。
- 原目录完整 `scripts/deploy-prod.ps1 -CheckOnly` 曾通过。本次正式脚本又自行完整运行前端 npm ci/check/test/audit/build、后端全量测试和 Git 干净状态检查，不使用跳过发布门禁的手动 Compose 更新。
- 原服务器后端容器 `b85c1959b074543380a62d1a4da24d240f3fd3c738ede10acad69b5fbb508eb2` healthy，前端 `55c952900a5fbb2df631c2885c5498c535530a66625636ba8da2186feaac5f43` 运行；旧镜像分别为 `sha256:7a8e12bc03ae3be511688d54a3fbbab9175a3c6ae3d8332dae8c3a6384636294` 与 `sha256:04f4b179fc2b3aa037e1f4ccb0d285b8f97d31dbfd7f6b9704221fff364f8399`。数据库卷 `304aistudio_db_data_prod` 挂 `/app/data`，上传卷 `304aistudio_upload_data_prod` 挂 `/app/uploads`；旧 `current-release` 尚不存在。磁盘可用约 16.5 GB、旧 HTTPS `/health` 200。
- `/usr/bin/python3.11` 为 3.11.13；系统默认 `python3` 仍 3.6.8。旧 `.env`、秘密文件、证书、旧 Compose 与原卷均保留。

## 实际发布与验收

- 本地执行 `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/deploy-prod.ps1`，退出码 0。固定提交归档上传并在服务器核对 SHA-256；发布脚本选择 `/usr/bin/python3.11`，在独立目录构建版本镜像。
- 发布目录：`/srv/304aistudio/releases/993c555eeb823427a37e1e71af727b337a301d05-a1fb9e2a1f1b4ed183b72cef7ceb7e12`。`current-release` 已原子指向此目录；首次由旧流程升级，因此 `previous-release` 指针尚不存在。发布目录的 `previous-backend-image.txt` / `previous-frontend-image.txt` 与发布前旧镜像 ID 匹配，旧根目录 Compose 保留。
- 升级前暂停单一旧后端写入者，使用旧镜像及只读业务挂载备份，再恢复旧后端。新备份 `/srv/304aistudio/backups/20261022T145504Z-35f1ecac`：manifest 记载旧来源 `legacy/unknown`、**21 张表和 4 个上传文件**；无网络、无生产卷的隔离恢复演练通过。发布后再次核对数据库和上传压缩包 SHA-256 均与 manifest 相同。
- 新容器均 running/healthy。后端镜像 `304aistudio-backend:993c555eeb823427a37e1e71af727b337a301d05`，前端镜像同版本；后端仍挂原数据库/上传卷，新增 `304aistudio_frontend_bundle_prod` 仅承载构建的前端资源。Compose 对两个旧业务卷给出“already exists but was not created by Docker Compose”提示，已核对它们仍是原卷、没有创建替代业务卷。
- 服务端与本机外部网络各完成 `scripts/release.py smoke --revision 993c555eeb823427a37e1e71af727b337a301d05`：均通过 **24 页面、4 个入口资源、2 类现有详情**；1 类公开集合为空并按设计报告跳过。覆盖真正 404、私有入口 noindex、公开 API、动态 sitemap/robots、详情分享元数据和真实版本。
- 发布后两个域名的 HTTPS `/health/ready` 均 200，版本为上述固定提交，数据库与前端检查均 `ok`，证书验证使用系统默认可信根和域名校验。浏览器实看线上首页在移动宽度正常渲染顶部菜单、Hero 文案与背景画面；未做真实手机全流程。
- 本地 Docker 3000/5000 保持运行，3001 Vite 在预检时临时停用并已恢复，HTTP 200。原本地业务库未写入。

## 证据、恢复与未验

- 本地执行日志与只读服务器核对摘要位于 `$env:TEMP/xingyu-release-gate-20261022/`：`production-deploy-993c555.log`、`predeploy-server-baseline.json`、`postdeploy-server-result.json`。仓库忽略的 `docs/verification/2026-10-22.release-report.json` 记录最终运行摘要。日志可能含内部路径，分享前检查内容；均不应包含真实秘密值。
- 本次没有回滚。首次旧版升级无 previous-release 指针；旧镜像 ID 与旧 Compose 已保存。镜像回退须先核对数据库结构兼容性，新备份的真实恢复/数据切流必须在另一个获授权窗口以**新空卷**执行，不覆盖当前生产卷；详见 `docs/deployment.md`。
- 尚未验证真实管理员/成员业务写入、上传新文件后的端到端读取、真实手机与弱网、飞书/邮件/QQ 等外部集成、旧 03:00 cron 备份的实际恢复和异地副本。1 类空集合没有真实详情可验；待内容存在后再验。对这些事项不得因 HTTP smoke 通过而宣称已完成。
- 新会话先读本文件、根 `AGENTS.md` 和 `docs/生产更新手册.md`，核对实际 `current-release`、容器健康、原业务卷和备份。后续变更仍执行完整发布门禁；不要清理旧镜像、发布目录、备份或业务卷。
