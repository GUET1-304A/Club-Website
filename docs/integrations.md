# Storage, OCR, and AI integrations

Docker Compose forwards the OSS, OCR, AI, and `PUBLIC_BASE_URL` variables from
the Compose environment into the backend container. Copy `.env.example` to
`.env`, fill only the integrations you enable, and keep real credentials out of
version control. Rebuild the backend image after dependency changes.

Uploads use the local `UPLOAD_FOLDER` by default and continue to return
`/uploads/<filename>` URLs. Set `OSS_ENABLED=true` only after all Aliyun OSS
values are present: `OSS_PROVIDER=aliyun`, `OSS_ACCESS_KEY_ID`,
`OSS_ACCESS_KEY_SECRET`, `OSS_BUCKET`, and `OSS_ENDPOINT`. `OSS_PREFIX` is
optional. Set `OSS_PUBLIC_BASE_URL` when uploaded objects are served through a
custom domain; otherwise the service builds the standard bucket endpoint URL.

Aliyun support is optional and its `oss2` dependency is included in
`backend/requirements.txt`. Rebuild the backend image after enabling the
integration or updating dependencies.

If object storage is enabled without a complete configuration, upload routes
return `503 {"error":"not_configured"}` rather than silently writing to a
different storage backend.

Certificate OCR is opt-in. Set `OCR_ENABLED=true` plus `OCR_ENDPOINT`,
`OCR_API_KEY`, and `OCR_MODEL`. Each of those values falls back to the matching
`AI_BASE_URL`, `AI_API_KEY`, and `AI_MODEL` setting. The endpoint must be
OpenAI-chat-completions compatible and support vision content. For each OCR
request, the backend reads the managed certificate image from local storage or
OSS and sends its bytes to the provider as a Data URL. The OCR provider never
needs to fetch `/uploads/...` directly, so `PUBLIC_BASE_URL` is not required
for certificate OCR. It may remain blank unless another application feature
needs an externally visible base URL.

`POST /api/member/certificates/<id>/ocr` processes only certificates owned by
the authenticated member. It persists provider-returned text in `ocr_text` and
returns `503 {"error":"not_configured"}` when OCR is disabled or incomplete.
It never creates placeholder OCR text.
