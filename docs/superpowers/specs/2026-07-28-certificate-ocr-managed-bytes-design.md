# 证书 OCR 受控字节传输设计

## 目标

第三方 OCR 提供商只接收由后端从受控存储读取的证书图片字节，不再接收或访问成员保存的 URL。成员门户的 OCR 操作、认证和结果展示保持不变。

## 架构

`StorageService` 新增受控图片读取接口：

- 本地存储仅接受 `/uploads/<filename>`，使用受限文件名和上传根目录内的路径读取。
- OSS 仅依据服务端配置及其对象键读取；不使用 URL 发起网络请求，也不信任 URL 的 Host、查询参数或 DNS。
- 读取结果包含受限图片 MIME 类型和字节内容；大小不得超过既有 `MAX_CONTENT_LENGTH`。

`OcrService` 将受控图片转换为 `data:<mime>;base64,...`，作为 OpenAI-compatible vision 请求中的 `image_url.url`。这样 OCR 提供商获取的是请求体中的图片，而不是任何可解析的外部地址。

## 数据流

1. 成员请求现有 `POST /api/member/certificates/<id>/ocr`。
2. 路由验证成员与证书归属，要求证书图片引用受控存储对象。
3. `StorageService` 返回图片字节和 MIME；无对象、类型错误或超限返回安全的业务错误，且不调用 OCR。
4. `OcrService` 生成 Data URL，调用已配置的 OCR 提供商，保存 `Certificate.ocr_text` 并返回更新后的证书。

## 错误与安全边界

- 缺少图片、非受控引用、文件不存在、类型不支持或超限：`422 invalid_certificate_images`，不调用 OCR。
- OSS 未配置、读取组件不可用或对象存储读取失败：安全的 `503 not_configured` 或 `502 ocr_failed`，不泄露密钥或内部路径。
- 不进行 DNS 解析、URL 访问、请求 Host 拼接或基于用户 URL 的远程下载。
- 仅允许 JPEG、PNG 与 WebP Data URL；每张图片的实际读取大小由现有上传上限约束。

## 验收

- 本地图片 OCR 的 provider 调用中只出现 `data:image/...;base64,`，不出现 `/uploads`、Host 或公网 URL。
- 非受控 URL 和不存在/超限图片在调用 OCR 前被拒绝。
- OSS 读取通过服务端对象键与凭据完成；提供商仍只接收 Data URL。
- 成员门户现有 OCR 成功、失败和持久化体验不变；后端测试、前端检查与构建通过。
