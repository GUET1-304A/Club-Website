# 数字生命 AIRI 演示接入

官网项目页在投资系统模块之后显示“数字生命 AIRI”。按钮在新标签页请求
`/api/demos/airi/launch`，固定跳转至 `/projects/airi/`，再进入
`https://airi.304aistudio.cn/`。用户输入受邀演示密码后进入舞台。

## 数据流与权限

浏览器 HTTPS/WSS → 官网 Nginx → 专用 SSH Unix socket → 台式机 4176 密码网关
→ 台式机 4173 AIRI 生产预览及已有语音、视觉网关。模型推理与私人配置仍在台式机。
摄像头和麦克风来自访客正在使用的设备，权限由浏览器询问。

用户在 2026-11-05 明确选择密码保护，只向受邀者开放。AIRI 原本没有演示登录，
会同步台式机模型配置，因此禁止直接公开现有回环入口。新增网关在转发任何接口、资源
和 WebSocket 前验签会话，密码以 scrypt 哈希保存，会话为 8 小时的签名 Secure/HttpOnly Cookie。
登录限制错误尝试次数，拒绝其他来源，去除演示 Cookie 后才进入原宿主。
原视觉开发者权限和 hosted 账号检查继续由 AIRI 自己处理。

邀请者持有密码后可访问演示及其共享模型配置。不要公开密码。
`.local/airi-demo/演示访问信息.txt` 仅存于台式机，私钥、签名密钥和配置均被 Git 忽略。
公网不开放项目管理 5174、视觉 18765、任意 TCP 转发、Vite 开发工具或工作区源码。
新入口使用当前生产构建及 Vite preview 的宿主插件，不转发开发服务器。

## 配置与运行

1. DNS 为 `airi.304aistudio.cn` 增加原服务器 A 记录。
2. 创建独立 Ed25519 公私钥，核验既有服务器主机公钥后保存 known_hosts。
3. 服务器执行 `scripts/setup-airi-relay.sh 公钥文件`。
   专用账号 `airi-relay` 只有远程 Unix socket 能力，`PermitListen none` 拒绝所有 TCP 监听。
4. 将 AIRI 加入既有 HTTPS 证书，同时保留主域、www 和 investment。
   `scripts/extend-airi-certificate.sh` 停机前检查签发网络，并在失败时恢复前端。
5. 按生产更新手册完成对应提交的完整本地门禁、GitHub CI、备份恢复演练及正式部署。
6. 当前用户登录任务 `304-AIRI-Demo` 执行 `scripts/start-airi-demo.ps1`。
   复用已有生产预览或启动缺失的 4173，拒绝覆盖其他服务或开发服务器。
   密码网关与 SSH 在后台运行，SSH 断线后重连。

投资系统使用独立账号、socket 和任务。新增接入不覆盖其配置。
停用 AIRI 时停止 `304-AIRI-Demo`，保留私人文件和原业务卷。
密码轮换须更换哈希及签名密钥，再重启任务，原会话随之撤销。

## 验证与边界

发布门禁包括网关的真实回环 HTTP/WebSocket 测试，以及两类固定跳转测试。
上线后验证真实卡片新标签页、受邀登录、未登录配置拒绝、静态资源、语音握手及投资入口。
真实摄像头、人脸识别和外部模型对话须单独记录，不用握手成功代替业务或设备验收。

当前进度见 [2026-11-05 验证记录](verification/airi-demo-2026-11-05.md)。
