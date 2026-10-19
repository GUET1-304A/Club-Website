# QQ 互联登录配置

登录页已经提供 QQ 登录入口。后端未配置 QQ 应用凭据时，按钮会显示为不可用，
不会伪造登录成功。

## 1. 在 QQ 互联创建网站应用

1. 登录 QQ 互联开发者平台，创建“网站应用”。
2. 网站地址填写 `https://304aistudio.cn`。
3. 回调地址填写 `https://304aistudio.cn/api/auth/qq/callback`。
4. 记录 `APP ID` 和 `APP Key`。

QQ 互联后台配置的回调地址必须与服务器配置完全相同，包括协议和路径。

## 2. 配置生产环境

在服务器 `/srv/304aistudio/.env` 中增加：

```bash
QQ_LOGIN_ENABLED=true
QQ_APP_ID=你的QQ互联APPID
QQ_REDIRECT_URI=https://304aistudio.cn/api/auth/qq/callback
QQ_APP_KEY_FILE=/srv/304aistudio/secrets/qq_app_key.txt
```

创建密钥文件：

```bash
printf '你的QQ互联APPKey' > /srv/304aistudio/secrets/qq_app_key.txt
chmod 600 /srv/304aistudio/secrets/qq_app_key.txt
```

重新创建后端容器：

```bash
cd /srv/304aistudio
docker compose -p 304aistudio -f docker-compose.prod.yml -f docker-compose.prod.tls.yml up -d --force-recreate backend
```

## 3. 登录与绑定规则

- 已绑定 QQ 的成员：QQ 授权成功后直接进入成员门户。
- 首次使用 QQ：需要输入管理员已录入的学号/邮箱、真实姓名和账号密码。
  - 已有密码的成员：验证现有密码后绑定。
  - 尚未激活的成员：同时设置登录密码并完成绑定。
- 未在成员表中的 QQ 用户不会被自动创建为正式成员，避免绕过社团审核。

## 4. 自检

```bash
curl -sS https://304aistudio.cn/api/auth/qq/status
```

配置正确时应返回 `"enabled": true`。浏览器打开 `/login`，点击“QQ 登录”，
应跳转到 QQ 授权页；取消授权会回到登录页并显示错误提示。
