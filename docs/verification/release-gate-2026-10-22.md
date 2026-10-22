# 正式提交与发布门禁（2026-10-22）

## 本轮授权与起点

- 用户在上线准备完成后要求“完成下一步”，本轮执行完整正式提交、正式提交上的 CheckOnly、推送触发并核对 GitHub 托管 CI。没有授权正式部署，本轮不调用 Workbench 上传/远端发布，不覆盖生产数据。
- 起点为 `main / 73e635c19b88ce117e67c7a849deb96c837229c2`，102 个待发布文件、暂存区空；`git fetch origin` 成功，HEAD 与 origin/main 左右提交数为0/0，无远端分叉。
- 应用、测试、CI、配置与已通过完整预检的隔离快照 `0a46a38db15e8ce74ebb55c8038ad96293040186` 内容一致，仅 AGENTS 和上轮复审交接的收尾文字不同。上轮的本地/隔离验收证据见 `launch-preparation-2026-10-22.md`。
- 正常开发 frontend:3000 / backend:5000 保持运行，后端 healthy。视觉保留纯图标 Dock、更多分组、所有公开页视频及避让主体的边缘代码装饰。
- GitHub 连接器对该私有仓库返回404；现有 Git SSH 与 HTTPS credential helper 可访问目标仓库，后续只将凭据放在进程内请求头，不输出或保存 token。

## 执行与验证记录

正式代码提交：`63ef45cc8fc1fc5c90e6771e057dd0684265452d`，103 个文件（新增本轮交接后由102变为103），提交信息 `feat: prepare public site and guarded production releases`。暂存路径检查没有环境文件、证书、数据库、上传文件、运行配置或依赖目录；常见私钥/PAT/云AccessKey模式检查未发现匹配。没有跳过 Git hooks 或修改作者身份。

- 原目录 Windows PowerShell5.1 `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/deploy-prod.ps1 -CheckOnly` 完整通过，报告 SHA 为63ef45c：Node24 npm ci/check、35项前端测试、audit 0、build/postbuild；后端211 passed、3项POSIX在Windows跳过、435条既有警告。46条既有前端lint警告仍保留。此前Linux214项验证的后端源码没有变化。
- 首次 npm ci 因原有本地3001 Vite进程持有 lightningcss DLL 而EPERM失败，未绕过该阶段。核对进程完整命令及监听端口后，仅暂时停该预览并完整重跑成功；Docker3000/5000未停止。3001恢复情况见收尾记录。
- `git push origin main` 成功，远端从73e635c快进到63ef45c，未force push。仓库仅新增前后端检查workflow，没有自动部署job。
- 托管 CI 已由 push 触发并**全部成功**：[Public site checks / 39784098737](https://github.com/GUET1-304A/Club-Website/actions/runs/39784098737)。前端check和后端backend两个job均success，真实Linux后端日志为214 passed、435条既有警告、无跳过；前端35测试、audit 0及构建通过。已下载两个job日志到本地验收目录，不依靠旧隔离结果替代托管CI。
- 日志位于 `$env:TEMP/xingyu-release-gate-20261022/`，含 code-checkonly.log（首次文件锁失败）、code-checkonly-retry.log（正式代码提交全通过）、按SHA命名的CI状态JSON及只读线上检查结果；不保存API token。

## 线上只读核对结果

- 实际安装目录 `/srv/304aistudio`，Compose项目 `304aistudio`；Docker26.1.3、Compose2.27.0，bash/flock/tar/sha256sum存在。旧后端healthy且无主机端口暴露；没有启动、停止或重建任何线上容器。
- 运行配置与根目录现有Compose解析结果一致：production、debug=false、`sqlite:////app/data/xingyu_cms.db`、`/app/uploads`、PUBLIC_BASE_URL=`https://304aistudio.cn`、OSS=false。实际数据卷为 `304aistudio_db_data_prod` / `304aistudio_upload_data_prod`，与新流程预期一致；已配置的秘密文件都存在。
- 域名 `https://304aistudio.cn/health` 在默认受信CA和主机名校验下200；证书包含apex/www，过期时间2027-01-17 08:23:43 UTC（北京时间16:23:43）。证书私钥权限0600，证书与.env为0644（仅记录元数据，未输出任何密钥值）。
- 线上不存在 current-release，属于第一次从旧流程升级；首次发布要保留旧镜像ID和旧Compose，不能假设存在previous-release。
- Workbench真实只读命令验证：成功命令payload exit_code=0且CLI退出0；人工构造的 `exit 23` payload与CLI均返回23，确认失败码可传回本地包装脚本。未执行上传、构建、备份或发布。
- **正式发布前置阻塞：服务器默认Python3为3.6.8，未找到python3.9/3.10/3.11/3.12/3.13/3.14命令。发布/恢复工具要求宿主Python3.9+，当前不能直接发布。** 本轮没有安装软件或修改服务器配置。需要在正式发布窗口前配置受支持的 `python3`（至少3.9），核对版本后再执行新发布流程；不能删除版本要求或临时用3.6强行运行。仅安装另一个名称的解释器还不够，现有远端脚本调用的是`python3`。

## 收尾与下一会话入口

- 代码发布候选为 `63ef45cc8fc1fc5c90e6771e057dd0684265452d`，已在原目录CheckOnly与GitHub托管CI通过；其后的收尾提交仅更新本文件与AGENTS，不改应用/测试/CI/配置。收尾HEAD由 `git log -1` 获取，仍在main；收尾提交会再次跑CheckOnly并显式触发同一只读检查workflow，结果可从 [workflow运行列表](https://github.com/GUET1-304A/Club-Website/actions/workflows/frontend.yml) 按HEAD SHA核对，运行日志保存在上述临时目录。
- 本地3001预览在最终npm ci完成后恢复为原参数 `--host 127.0.0.1 --port 3001 --strictPort`；恢复结果在最终回复中给出。正常Docker3000/5000全程运行。
- 新会话先核对 `git status -sb`、HEAD对应的最新workflow及Docker状态，再处理服务器Python3.9+前置条件。Python宿主升级或发布必须在用户另行授权的服务器变更/发布窗口执行；本轮没有动线上软件、配置、数据和容器。

## 正式发布仍需完成

- 另行核对实际 ECS/Workbench 项目名、根目录 .env、秘密文件权限、线上域名与证书、业务数据路径和挂载；不得使用临时验收项目名/证书/凭据。
- GitHub 托管 CI 和 CheckOnly 均针对实际提交检查，不以旧隔离 SHA 代替。工作区必须干净，发布门禁与存储门禁不能绕过。
- 用户另行授权发布窗口后才执行 `scripts/deploy-prod.ps1`，完成构建、旧数据备份与恢复演练、启动、内外 HTTP 版本验收；保留旧镜像、源码目录和备份。
- 已完成现有线上TLS/health和Workbench退出码的只读核对；尚未执行新版本Workbench/ECS部署、发布后版本/readiness/TLS验收、线上真实备份与恢复切流、真实账号完整业务流程、真实手机/Safari/弱网与外部服务验收；这些结论不能从本地通过外推。
