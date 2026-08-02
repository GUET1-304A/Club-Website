# Certificate OCR Portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make certificate OCR usable by an authenticated member in the certificate-management page.

**Architecture:** The existing Flask endpoint owns authentication, ownership checks, provider invocation, and persistence. `memberApi.ts` exposes one typed wrapper around that endpoint. `CertificateManager.tsx` owns per-certificate pending state, replaces the card with the returned certificate, and renders a collapsible result without altering certificate form state.

**Tech Stack:** React 19, TypeScript, Vite, Flask, pytest.

---

### Task 1: Expose the typed member OCR request

**Files:**

- Modify: `frontendnew/src/services/memberApi.ts` after `memberUploadCertificateImage`
- Verify: `frontendnew/package.json`

- [ ] **Step 1: Add the typed request wrapper**

```ts
export interface CertificateOcrResponse {
  success: boolean
  ocrText: string
  certificate: CertificateData
}

export async function memberRunCertificateOcr(certId: number): Promise<CertificateOcrResponse> {
  return memberRequest(`/member/certificates/${certId}/ocr`, { method: 'POST' })
}
```

- [ ] **Step 2: Type-check the public request contract**

Run: `npm run typecheck`

Expected: exit code `0`; the new call compiles with `CertificateData`.

### Task 2: Add a per-certificate OCR operation in the portal

**Files:**

- Modify: `frontendnew/src/components/member/CertificateManager.tsx` imports, state, certificate-card actions, and result section
- Verify: `frontendnew/src/components/member/CertificateManager.tsx`

- [ ] **Step 1: Import the request function and recognition icon**

```ts
import { ScanText, LoaderCircle } from 'lucide-react'
import { memberRunCertificateOcr } from '../../services/memberApi'
```

- [ ] **Step 2: Track only the card currently being recognised and add the request handler**

```ts
const [ocrPendingId, setOcrPendingId] = useState<number | null>(null)
const [expandedOcrId, setExpandedOcrId] = useState<number | null>(null)

const handleOcr = async (certificate: CertificateData) => {
  if (!certificate.images?.length) {
    toast('warning', '请先上传证书图片，再进行文字识别')
    return
  }
  setOcrPendingId(certificate.id)
  try {
    const result = await memberRunCertificateOcr(certificate.id)
    setCerts(items => items.map(item => item.id === certificate.id ? result.certificate : item))
    setExpandedOcrId(certificate.id)
    toast('success', '证书文字识别完成')
  } catch (error: unknown) {
    toast('error', (error as Error).message)
  } finally {
    setOcrPendingId(null)
  }
}
```

- [ ] **Step 3: Render the card action and persisted result**

Place this action before edit/delete. Disable while this certificate is in progress; use `重新识别` when `c.ocrText` exists.

```tsx
<button
  onClick={() => handleOcr(c)}
  disabled={ocrPendingId === c.id || !c.images?.length}
  title={c.images?.length ? (c.ocrText ? '重新识别文字' : '识别证书文字') : '请先上传证书图片'}
  className="p-2 rounded-xl hover:bg-[rgba(0,0,0,0.04)] text-[#273C46]/40 hover:text-[#051A24] transition-all disabled:opacity-40"
>
  {ocrPendingId === c.id ? <LoaderCircle className="w-3.5 h-3.5 animate-spin" /> : <ScanText className="w-3.5 h-3.5" />}
</button>
{c.ocrText && (
  <div className="mt-3 border-t border-[rgba(0,0,0,0.03)] pt-3">
    <button onClick={() => setExpandedOcrId(id => id === c.id ? null : c.id)} className="text-xs text-[#273C46]/60 hover:text-[#051A24]">
      {expandedOcrId === c.id ? '收起识别结果' : '查看识别结果'}
    </button>
    {expandedOcrId === c.id && <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-[#273C46]/60">{c.ocrText}</p>}
  </div>
)}
```

- [ ] **Step 4: Build the member portal**

Run: `npm run check && npm run build`

Expected: exit code `0`; the production bundle contains the typed OCR invocation.

### Task 3: Verify the API operation against the existing provider contract

**Files:**

- Verify: `backend/tests/test_business_integrations.py`
- Verify: `backend/routes/member.py`

- [ ] **Step 1: Run the existing negative and persistence coverage**

Run: `py -m pytest -q tests/test_business_integrations.py`

Expected: 3 passed: incomplete OSS configuration returns `503`, unconfigured OCR returns `503`, and configured OCR response is persisted.

- [ ] **Step 2: Commit only the portal implementation**

```powershell
git add -- frontendnew/src/services/memberApi.ts frontendnew/src/components/member/CertificateManager.tsx
git commit -m "feat: add certificate OCR portal action"
```
