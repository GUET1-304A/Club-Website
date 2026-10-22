# 发布前检查、HTTP验收与恢复演练（2026-10-22）

> 后续复审与最新结论见 `launch-preparation-2026-10-22.md`：补齐真实生产 TLS 健康检查、实际存储一致性门禁、全量 Linux 测试和恢复后应用启动验收。本文件以下记录是前一阶段，不覆盖后续文档。

## 授权与当前状态

- 用户批准上一条建议：优先落实发布前自检、发布后自动验收、备份恢复演练。本轮先在本地与隔离Docker验证，未向线上上传、推送或部署。
- 原仓库仍在 `main`，HEAD `73e635c`；此前与本轮修改均未提交，未覆盖用户已有改动。当前发布门禁拒绝脏工作区是预期结果，不能为方便上线而跳过。
- 保留全部已确认视觉方向：原版Dock和更多分组、所有公开页视频、避开主体的边缘装饰。本轮没有UI改版。

## 做过什么

- `scripts/release.py`：标准库CLI，检查完整Git状态（含未跟踪文件）、main分支、HEAD关键交付文件；Node24下npm ci/check/test/audit/build，Python后端全量测试，再次核对工作区/提交。原始HTTP验收检查真实版本、公开页/现有详情、私有入口noindex、真正404、API、入口资源、sitemap/robots；不虚构空集合内容，明确报告跳过数量。
- `scripts/deploy-prod.ps1`：保留现有Workbench/ECS传输方式，新增CheckOnly/Project/FirstDeploy；严格检查远端参数语法，生成唯一归档并校验SHA256，不再用tail掩盖构建失败；先完成本地门禁再允许push/upload。上传内容固定为通过检查的提交。
- `scripts/deploy-remote.sh`：flock串行发布；新源码进入独立 `releases/SHA-token/`。从旧安装根目录解析.env/证书/秘密文件/业务卷路径，用新源码构建按提交号命名的镜像；先构建，再短暂停后端备份和恢复演练，之后up --wait和HTTP验收。成功后原子更新current-release并保存previous-release。保留旧容器镜像ID；失败不自动恢复数据。FirstDeploy也不能跳过已有孤立数据卷。
- `scripts/recovery.py`：显式指定Compose项目/文件，发现原后端容器、镜像和持久化挂载；暂停单一写入者，以旧镜像、只读业务挂载和无网络helper备份，finally恢复原先运行的后端。备份目录加排他锁，故障残留锁需人工核对。随后使用无业务卷、只读备份、临时文件系统、无网络容器恢复校验。
- `backend/maintenance.py`：不导入Flask，SQLite backup API生成一致快照，打包上传文件；记录原镜像/版本、SHA256、表行数和每个文件哈希。恢复只允许新目录，校验数据库完整性、表行数、文件内容，拒绝损坏包、路径穿越、链接和重复条目。
- `backend/services/readiness.py` 和 `/health/ready`：检查数据库SELECT1、构建清单、前后端相同构建版本及引用的入口JS/CSS文件；失败503且不暴露内部连接信息。原 `/health` 保留存活语义，避免共享清单初始化造成前后端启动依赖循环。
- 两个生产Dockerfile/Compose/postbuild接入构建版本；前端生产healthcheck改查readiness。后端版本烘焙进镜像，前端清单随其构建携带版本。
- CI接入发布相关测试，POSIX失败路径在Linux执行；根目录ignore排除备份/发布目录，shell脚本强制LF。部署文档改为新流程，移除原来直接清空业务卷的恢复示例，明确恢复演练与实际数据切换的边界。

## 验过什么

### 自动检查

- 首次原目录全量 `python -m pytest backend/tests -q`：202通过（当时新增12个测试），435条既有警告。
- 随后补充备份失败finally恢复和3个POSIX远端失败注入测试；原目录针对发布/部署测试最终19通过、3个POSIX测试在Windows跳过。
- 临时只读源码挂载的Python3.12 Linux容器运行 `test_frontend_delivery.py`、`test_deployment_contract.py`、`test_release_operations.py`：49通过，包含Windows跳过的全部POSIX测试。最后补充保留旧镜像ID逻辑后，再直接执行最新源码中的3个POSIX失败用例，build/smoke/orphan均通过。
- 完整预检在**隔离源码副本**执行：从当前已跟踪/未跟踪且非忽略的文件复制，临时Git提交 `2c2454b9930195d9349d56bc67b1e087724de83f`，不改变原仓库。结果：npm ci/check、34项前端测试、审计0、build/postbuild、203项后端测试通过；Windows跳过3项已在Linux通过的POSIX测试。完整预检退出0并写JSON报告。
- Windows PowerShell5.1实际运行原仓库 `deploy-prod.ps1 -CheckOnly`：按预期因脏工作区退出1，未调用push/upload/远端exec。另用PowerShell Parser确认脚本无语法错误；Workbench仅调用exec --help，未调用实机命令。
- Bash语法检查、CI YAML解析、git diff --check通过；仍有46条既有前端lint警告，后端435条既有JWT测试密钥/SQLAlchemy旧API警告。

### Docker业务存储隔离验收

- 新建明确命名项目 `xingyu-release-qa`，回环3004端口，独立qa_db/qa_uploads/qa_bundle卷，测试版本为40个a。生产Nginx和Gunicorn健康启动，up --wait通过。
- 仅在隔离库写入项目、奖项、公开博客各1，以及一个中文路径上传文件；未写真实业务库或上传目录。
- `release.py smoke` 通过：11个页面、4个入口资源、3类实际详情，空集合跳过0；备份前后均再次通过。
- `recovery.py backup` 真实暂停/恢复隔离后端，以只读挂载创建备份；无网络、无业务卷的新容器恢复成功：21张表的行数一致、1个文件哈希一致。最后一次包包含源镜像和40个a的源版本。
- 复制验收包并追加损坏字节后，rehearse非零退出、明确checksum mismatch；原始包与业务卷未覆盖。smoke传40个b则非零退出、version mismatch，不将旧版本报告成成功。
- 真实Compose配置解析使用独立占位秘密文件验证：新源码build context和新nginx配置路径正确，原运行目录证书/秘密文件路径与原项目数据卷名称保持，镜像按提交号命名；配置未输出真实秘密。

## 文件、命令与下一步

```powershell
# 原仓库：脏工作区时应拒绝；此开关不会上传/推送/部署
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/deploy-prod.ps1 -CheckOnly
python -m pytest backend/tests/test_release_operations.py backend/tests/test_deployment_contract.py -q
git diff --check

# 只读验收某个已部署版本
python scripts/release.py smoke --base-url https://304aistudio.cn --revision FULL_COMMIT_SHA --attempts 3
```

隔离验收材料位于 `$env:TEMP/xingyu-release-qa/`：`compose.json`、`backups/`、`corrupt-backup/`、`preflight-copy/`、`preflight-result.json`、`runtime-config/`、`compose-source/`。这些只含验收数据/占位配置，不可作为生产凭据。临时Git提交只属于preflight-copy，不是原项目提交。

最近两个真实验收包：`backups/20261022T114028Z-e2632423` 和 `backups/20261022T114729Z-3fcf16dc`。第二个记录源镜像/版本；损坏包是独立副本，勿误选。

已执行隔离项目的 `down --volumes`，两个验收容器、隔离网络和三个验收卷均已删除，报告/验收包保留便于核对；正常3000前端与5000健康后端保持运行。当前运行的开发后端未重启，本轮新readiness已通过独立生产镜像验证，开发实例需正常重启后才加载新路由。

下一步先review全部工作区改动并形成完整提交，再在真实部署配置上跑CheckOnly/托管CI，核对实际项目名与域名。发布操作使用新脚本，根目录.env、secrets和证书必须保留；新发布目录及镜像在稳定前不要清理。不要直接运行旧的解压覆盖/清空卷恢复流程。

## 尚未验证与限制

- 未向线上上传/部署，没有实测Workbench远端失败时的具体输出封装、线上TLS/域名连通性；外部HTTP版本验收仍会拦截旧版本。脚本参数/本地行为、远端Bash失败逻辑、真实Docker构建和备份恢复已分别验证。
- 未做真实业务数据恢复切流、线上备份、真实账号完整业务流程、真实手机/弱网，未触发GitHub托管CI。
- 此备份适配器支持绝对路径SQLite和本地上传、单一后端写入者；外部数据库、OSS对象存储需要独立原生备份方案。发布前备份已自动化，日常定时/异地备份未设置。
- 恢复演练证明数据可校验恢复，不等于完整认证/业务流程可用；实际恢复必须到新空卷并另行验证业务，不自动覆盖生产数据。回滚镜像不能自动撤销迁移或用户新写入。
- 每次备份会短暂停后端，属于维护窗口；现有共享前端卷仍是单发布者部署，不支持并发发布/多副本写入。
- 435条既有后端警告和46条既有前端警告未在本轮扩展清理。

此前阶段入口：`server-metadata-2026-10-22.md`，再往前见根AGENTS.md。
