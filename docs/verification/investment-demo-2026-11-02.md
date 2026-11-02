# 投资管理系统演示入口正式发布

日期：2026-11-02（北京时间）。用户明确确认启用演示域名、将台式机 9012 服务接入官网、
配置登录启动项及正式发布，并接受证书扩展时短暂停止官网前端。

## 实际访问与版本

- 官网模块：`https://304aistudio.cn/projects`。
- 固定入口：`GET /api/demos/investment/launch` → `/projects/investment/` →
  `https://investment.304aistudio.cn/`。不接受调用方提供的跳转地址。
- 运行应用版本：`5351cfc6a91b2472bc352baf87d49d61ef5865c3`。
- 当前发布目录：`/srv/304aistudio/releases/5351cfc6a91b2472bc352baf87d49d61ef5865c3-investment20261102`。
- `previous-release` 保留原 `993c555…-a1fb9e2a1f1b4ed183b72cef7ceb7e12` 发布目录。
- 发布包 SHA256：`71106b372ff8716653a4d8ed75fe11e1b50b35e0f3d0ba2d506abc507ca09611`，云端校验一致。

## 已验证

- 完整 `scripts/deploy-prod.ps1 -CheckOnly` 对上述应用提交通过：前端 35 项，
  后端 214 项通过、Windows 下 5 项跳过，依赖审计 0 漏洞，构建通过。
- 对应 [GitHub CI 41410497725](https://github.com/GUET1-304A/Club-Website/actions/runs/41410497725)
  的前后端任务均通过。
- 真实 Nginx 镜像的 `nginx -t` 通过。
- 正式执行原 `scripts/deploy-remote.sh`，未跳过存储校验或备份恢复演练。
  备份位于 `/srv/304aistudio/backups/20261102T083857Z-b750272e`；隔离恢复验证 21 表、4 个上传文件通过。
- 服务器正式 smoke 通过：24 页面、4 个资源、2 类详情；1 类空集合按设计跳过。
- 浏览器真实点击官网按钮，最终地址与登录页标题正确；已保存模块和登录页截图于本地 `.local/`。
- 独立公网 HTTP 检查：两次跳转均 302、演示 `/health` 为 200、未登录 `/api/me` 为 401。
- 官网前后端健康，继续挂载原业务卷；同机 hospital 项目的容器仍保持原有运行状态。

## 运行资产

- DNS：`investment.304aistudio.cn` 的 A 记录指向原服务器 `39.101.66.98`。
- 证书覆盖 apex、www 和 investment，保持 ECDSA 类型；到期时间为
  2027-01-31 15:32:58（北京时间）。原证书名称、存储位置及既有续期任务保持一致。
- 台式机服务仍为 `127.0.0.1:9012`。未迁移投资系统代码、数据库、附件或运行环境。
- 专用 `investment-relay` 用户强制公钥认证及 nologin；只允许远程 Unix socket 转发。
  OpenSSH 8 的共享权限门禁使用 `AllowTcpForwarding remote`，同时以 `PermitListen none`
  拒绝全部 TCP 监听目标，禁止本地 TCP 转发、PTY、代理转发。
- Nginx 仅挂载 `/srv/304aistudio/investment-relay` 并连接 `relay.sock`。
  没有新增公网应用端口。
- Windows 任务 `304-Investment-Relay` 使用当前用户登录触发、有限权限及隐藏窗口。
  长期进程仅转发 9012，具有保活、断线重连和单实例互斥。
- 私钥和核验过的服务器公钥位于本机忽略目录 `.local/relay/`；未提交私钥或配置中的秘密值。
- 发布包传输及签发专用的临时 SSH 通道、回环代理和 HTTP 服务均已关闭。

## 实际问题与验证范围

- Workbench 文件传输会话曾过期，最终发布包改由一次性受限 SSH 通道传输，校验哈希后部署。
- 服务器直连 Let's Encrypt ACME 读取超时。本次签发使用了只允许连接该签发机构的临时代理，
  保持正常 TLS 验证，签发结束即关闭；没有永久开放通用代理。
  日常续期尚未做联网 dry-run，仍需核对届时的出网连通性；不要将证书已生效说成续期已验收。
- 本机通用外网 smoke 曾因网络读取超时失败；www 脚本还因首页 canonical 使用主域名而报错。
  本轮未改动既有 canonical 逻辑，也未将这两次脚本结果报告为通过。
  服务器完整验收与上述独立客户入口检查均已通过。
- 本轮未使用投资系统账号实际登录，未验证登录后的业务办理、真实客户并发或 AI 外部供应商。
  只验证入口、真实登录页、静态资源实际渲染及未登录鉴权，不冒充业务全流程验收。
- 台式机、投资服务和隧道需要保持运行；计划任务在 Windows 用户登录后启动，不等于未登录开机服务。

## 接续

后续先核对这里记录的运行应用 SHA，再读实际 `current-release`。仅补录运维脚本与文档时，
Git HEAD 可以高于运行镜像 SHA。网站回退继续采用生产更新手册和保留的发布目录；不删除业务卷。
