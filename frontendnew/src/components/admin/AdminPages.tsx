import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Plus, Edit3, Trash2, FileText, Code2, LayoutTemplate, Upload, Image as ImageIcon, LoaderCircle, Link2 } from 'lucide-react'
import AdminLayout from './AdminLayout'
import AdminModal, { Field, Input, Textarea } from './AdminModal'
import ConfirmDialog from './ConfirmDialog'
import { useToast } from './Toast'
import { adminListPages, adminCreatePage, adminSavePage, adminDeletePage, adminUpload } from '../../services/adminApi'
import type { AdminPage } from '../../services/adminApi'

export default function AdminPages() {
  const { toast } = useToast()
  const [pages, setPages] = useState<AdminPage[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<AdminPage | null>(null)
  const [form, setForm] = useState({ slug: '', title: '', content: '{}' })
  const [jsonError, setJsonError] = useState('')
  const [editorMode, setEditorMode] = useState<'visual' | 'json'>('visual')
  const [confirmDelete, setConfirmDelete] = useState<AdminPage | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => { setLoading(true); setPages(await adminListPages().catch(() => [])); setLoading(false) }, [])
  useEffect(() => { load() }, [load])

  const openCreate = () => { setEditing(null); setForm({ slug: '', title: '', content: '{}' }); setJsonError(''); setEditorMode('visual'); setShowModal(true) }
  const openEdit = (p: AdminPage) => { setEditing(p); setForm({ slug: p.slug, title: p.title, content: JSON.stringify(p.content, null, 2) }); setJsonError(''); setEditorMode('visual'); setShowModal(true) }

  const parsedContent = useMemo<Record<string, unknown> | null>(() => {
    try {
      const parsed = JSON.parse(form.content)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : null
    } catch {
      return null
    }
  }, [form.content])

  const updateVisualContent = (next: Record<string, unknown>) => {
    setForm(current => ({ ...current, content: JSON.stringify(next, null, 2) }))
    setJsonError('')
  }

  const handleSave = async () => {
    if (!form.slug.trim() || !form.title.trim()) { toast('warning', '请填写 slug 和标题'); return }
    let contentObj: Record<string, unknown> = {}
    try { contentObj = JSON.parse(form.content) } catch { setJsonError('JSON 格式错误'); return }
    try {
      if (editing) { await adminSavePage(editing.slug, { title: form.title, content: contentObj }); toast('success', '页面已更新') }
      else { await adminCreatePage({ slug: form.slug, title: form.title, content: contentObj }); toast('success', '页面已创建') }
      setShowModal(false); load()
    } catch (e: unknown) { toast('error', (e as Error).message) }
  }

  const handleDelete = async () => {
    if (!confirmDelete) return; setDeleting(true)
    try { await adminDeletePage(confirmDelete.slug); toast('success', '页面已删除'); setConfirmDelete(null); load() }
    catch (e: unknown) { toast('error', (e as Error).message) } finally { setDeleting(false) }
  }

  function renderContent() {
    if (loading) return <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{Array.from({ length: 4 }).map((_, i) => (<div key={i} className="card p-5 animate-pulse" style={{ borderRadius: 20 }}><div className="h-4 w-32 bg-[#f0ece6] rounded-lg mb-2" /><div className="h-3 w-20 bg-[#f0ece6] rounded-md" /></div>))}</div>
    if (pages.length === 0) return <div className="flex flex-col items-center py-20 text-center"><div className="w-16 h-16 rounded-2xl bg-[#f0ece6] flex items-center justify-center mb-4"><FileText className="w-7 h-7 text-[#273C46]/20" /></div><p className="text-sm text-[#273C46]/50">暂无自定义页面</p><button onClick={openCreate} className="btn-primary text-xs px-4 py-2 mt-4 inline-flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" /> 创建页面</button></div>
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {pages.map((p) => (
          <div key={p.slug} className="card p-5 flex items-start justify-between group hover:translate-y-[-2px] transition-all duration-300" style={{ borderRadius: 22 }}>
            <div className="min-w-0">
              <div className="flex items-center gap-2.5"><div className="w-9 h-9 rounded-xl bg-[#f0ece6] flex items-center justify-center shrink-0"><FileText className="w-4 h-4 text-[#273C46]/30" /></div><h3 className="font-semibold text-[#051A24] text-sm">{p.title}</h3></div>
              <p className="text-xs text-[#273C46]/30 mt-2 font-mono ml-[46px]">/{p.slug}</p>
              <p className="text-[10px] text-[#273C46]/25 mt-1 ml-[46px]">{p.updated_at ? new Date(p.updated_at).toLocaleString('zh-CN') : ''}</p>
            </div>
            <div className="flex gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => openEdit(p)} aria-label={`编辑${p.title}`} className="p-2 rounded-xl hover:bg-[rgba(0,0,0,0.04)] text-[#273C46]/40 hover:text-[#051A24] transition-all"><Edit3 className="w-4 h-4" /></button>
              <button onClick={() => setConfirmDelete(p)} aria-label={`删除${p.title}`} className="p-2 rounded-xl hover:bg-red-50 text-[#273C46]/30 hover:text-red-500 transition-all"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <AdminLayout>
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div><h1 className="text-[28px] font-medium text-[#051A24] tracking-tight" style={{ fontFamily: "var(--font-sans)", fontWeight: 500 }}>页面管理</h1><p className="text-sm text-[#273C46]/50 mt-1">{pages.length} 个自定义页面</p></div>
          <button onClick={openCreate} className="btn-primary text-sm px-5 py-2.5 flex items-center gap-2 shadow-lg shadow-[#051A24]/10"><Plus className="w-4 h-4" /> 新建页面</button>
        </div>
        {renderContent()}

        <AdminModal open={showModal} title={editing ? '编辑页面' : '新建页面'} onClose={() => setShowModal(false)} maxWidth="max-w-3xl">
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <Field label="Slug" className="col-span-1"><Input value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} placeholder="about" disabled={!!editing} /></Field>
              <Field label="页面标题" className="col-span-2"><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="关于我们" /></Field>
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-[#273C46]/60">页面内容</p>
                <p className="text-[10px] text-[#273C46]/35 mt-0.5">可视化模式适合日常修改，JSON 模式适合复杂结构。</p>
              </div>
              <div className="flex rounded-full border border-white/70 bg-white/40 p-1">
                <button
                  type="button"
                  onClick={() => setEditorMode('visual')}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-colors ${editorMode === 'visual' ? 'bg-white text-[#051A24] shadow-sm' : 'text-[#273C46]/55'}`}
                >
                  <LayoutTemplate className="h-3.5 w-3.5" /> 可视化
                </button>
                <button
                  type="button"
                  onClick={() => setEditorMode('json')}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-colors ${editorMode === 'json' ? 'bg-white text-[#051A24] shadow-sm' : 'text-[#273C46]/55'}`}
                >
                  <Code2 className="h-3.5 w-3.5" /> JSON
                </button>
              </div>
            </div>
            {jsonError && <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-2xl px-4 py-3"><div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />{jsonError}</div>}
            {editorMode === 'visual' ? (
              parsedContent ? (
                <VisualContentEditor value={parsedContent} onChange={updateVisualContent} />
              ) : (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                  当前内容不是合法的 JSON 对象，请切换到 JSON 模式修正后再使用可视化编辑。
                </div>
              )
            ) : (
              <Field label="内容 (JSON)">
                <Textarea value={form.content} onChange={e => { setForm({ ...form, content: e.target.value }); setJsonError('') }} placeholder='{"key": "value"}' rows={14} className="font-mono text-xs" />
              </Field>
            )}
            <button onClick={handleSave} className="btn-primary w-full py-3 text-sm font-medium">{editing ? '保存修改' : '创建页面'}</button>
          </div>
        </AdminModal>

        <ConfirmDialog open={!!confirmDelete} title="删除页面" message={`确定要删除页面「${confirmDelete?.title}」吗？`} variant="danger" confirmLabel="删除" onConfirm={handleDelete} onCancel={() => setConfirmDelete(null)} loading={deleting} />
      </div>
    </AdminLayout>
  )
}

const PAGE_FIELD_LABELS: Record<string, string> = {
  title: '标题',
  intro: '简介',
  description: '描述',
  extra: '补充描述',
  requirements: '要求',
  process: '流程',
  faq: '常见问题',
  question: '问题',
  answer: '回答',
  step: '步骤',
  steps: '步骤',
  items: '条目',
  directions: '方向',
  name: '名称',
  tagline: '副标题',
  content: '内容',
  techFields: '技术领域',
  scenarios: '应用场景',
  type: '类型',
  details: '详情',
  cta_title: '行动区标题',
  cta_note: '行动区说明',
  cta_button: '按钮文字',
}

function pageFieldLabel(key: string): string {
  return PAGE_FIELD_LABELS[key] || key.replace(/_/g, ' ')
}

function emptyLike(value: unknown): unknown {
  if (Array.isArray(value)) return []
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, emptyLike(item)]),
    )
  }
  if (typeof value === 'number') return 0
  if (typeof value === 'boolean') return false
  return ''
}

function isImageArrayKey(key?: string): boolean {
  if (!key) return false
  return key === 'images' || key === 'photos' || key === 'gallery' || /Images$/.test(key)
}

function isSingleImageKey(key?: string): boolean {
  if (!key) return false
  return key === 'image' || /image|avatar|logo|cover|banner/i.test(key)
}

function VisualContentEditor({
  value,
  onChange,
}: {
  value: Record<string, unknown>
  onChange: (value: Record<string, unknown>) => void
}) {
  return (
    <div className="max-h-[56vh] overflow-y-auto rounded-2xl border border-white/70 bg-white/32 p-4">
      <VisualObjectFields value={value} onChange={onChange} />
    </div>
  )
}

function VisualObjectFields({
  value,
  onChange,
}: {
  value: Record<string, unknown>
  onChange: (value: Record<string, unknown>) => void
}) {
  const entries = Object.entries(value)
  if (entries.length === 0) {
    return <p className="py-5 text-center text-xs text-[#273C46]/40">当前对象为空，可切换到 JSON 模式添加字段。</p>
  }

  return (
    <div className="space-y-4">
      {entries.map(([key, item]) => (
        <VisualValueEditor
          key={key}
          label={pageFieldLabel(key)}
          keyName={key}
          value={item}
          onChange={next => onChange({ ...value, [key]: next })}
        />
      ))}
    </div>
  )
}

function VisualValueEditor({
  label,
  keyName,
  value,
  onChange,
}: {
  label: string
  keyName?: string
  value: unknown
  onChange: (value: unknown) => void
}) {
  if (keyName && isImageArrayKey(keyName) && Array.isArray(value)) {
    return (
      <VisualImageArrayField
        label={label}
        keyName={keyName}
        value={value.filter((item): item is string => typeof item === 'string')}
        onChange={next => onChange(next)}
      />
    )
  }

  if (keyName && isSingleImageKey(keyName) && (typeof value === 'string' || value == null)) {
    return (
      <VisualImageField
        label={label}
        keyName={keyName}
        value={value == null ? '' : String(value)}
        onChange={next => onChange(next)}
      />
    )
  }

  if (Array.isArray(value)) {
    return (
      <div className="rounded-2xl border border-white/65 bg-white/35 p-3">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <span className="text-xs font-medium text-[#051A24]">{label}</span>
            {keyName && <code className="ml-2 text-[9px] text-[#273C46]/35">{keyName}</code>}
          </div>
          <button
            type="button"
            onClick={() => onChange([...value, emptyLike(value[0])])}
            className="inline-flex items-center gap-1 rounded-full border border-white/70 bg-white/55 px-2.5 py-1 text-[10px] text-[#273C46]/65 transition-colors hover:bg-white"
          >
            <Plus className="h-3 w-3" /> 添加一项
          </button>
        </div>
        <div className="space-y-3">
          {value.length === 0 && <p className="text-[11px] text-[#273C46]/35">暂无条目</p>}
          {value.map((item, index) => (
            <div key={index} className="flex items-start gap-2 rounded-xl border border-white/55 bg-white/25 p-3">
              <div className="min-w-0 flex-1">
                <VisualValueEditor
                  label={`第 ${index + 1} 项`}
                  value={item}
                  onChange={next => onChange(value.map((current, i) => i === index ? next : current))}
                />
              </div>
              <button
                type="button"
                onClick={() => onChange(value.filter((_, i) => i !== index))}
                className="mt-0.5 rounded-lg p-1.5 text-[#273C46]/30 transition-colors hover:bg-red-50 hover:text-red-500"
                aria-label={`删除第 ${index + 1} 项`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (value && typeof value === 'object') {
    return (
      <div className="rounded-2xl border border-white/65 bg-white/28 p-3">
        <div className="mb-3">
          <span className="text-xs font-medium text-[#051A24]">{label}</span>
          {keyName && <code className="ml-2 text-[9px] text-[#273C46]/35">{keyName}</code>}
        </div>
        <VisualObjectFields
          value={value as Record<string, unknown>}
          onChange={next => onChange(next)}
        />
      </div>
    )
  }

  if (typeof value === 'boolean') {
    return (
      <label className="flex items-center gap-2 rounded-xl px-1 py-1.5 text-sm text-[#273C46]">
        <input
          type="checkbox"
          checked={value}
          onChange={event => onChange(event.target.checked)}
          className="rounded border-[rgba(0,0,0,0.2)]"
        />
        {label}
        {keyName && <code className="text-[9px] text-[#273C46]/35">{keyName}</code>}
      </label>
    )
  }

  if (typeof value === 'number') {
    return (
      <Field label={`${label}${keyName ? ` · ${keyName}` : ''}`}>
        <Input
          type="number"
          value={value}
          onChange={event => onChange(Number(event.target.value))}
        />
      </Field>
    )
  }

  const text = value == null ? '' : String(value)
  const multiline = text.includes('\n') || text.length > 90
  return (
    <Field label={`${label}${keyName ? ` · ${keyName}` : ''}`}>
      {multiline ? (
        <Textarea
          value={text}
          onChange={event => onChange(event.target.value)}
          rows={Math.min(7, Math.max(3, Math.ceil(text.length / 70)))}
        />
      ) : (
        <Input value={text} onChange={event => onChange(event.target.value)} />
      )}
    </Field>
  )
}

function VisualImageField({
  label,
  keyName,
  value,
  onChange,
}: {
  label: string
  keyName: string
  value: string
  onChange: (value: string) => void
}) {
  const { toast } = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const upload = async (file?: File) => {
    if (!file) return
    setUploading(true)
    try {
      const result = await adminUpload(file)
      onChange(result.url)
      toast('success', '图片已上传')
    } catch (error: unknown) {
      toast('error', (error as Error).message || '图片上传失败')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-[#273C46]/60">
        {label} <code className="ml-1 text-[9px] font-normal text-[#273C46]/35">{keyName}</code>
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex h-24 w-full shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/70 bg-white/45 sm:w-40">
          {value ? (
            <img src={value} alt="页面图片预览" className="h-full w-full object-cover" />
          ) : (
            <ImageIcon className="h-7 w-7 text-[#273C46]/25" />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <input
            value={value}
            onChange={event => onChange(event.target.value)}
            placeholder="图片 URL"
            className="admin-glass-control w-full rounded-xl border border-white/60 px-4 py-2.5 text-sm text-[#051A24] placeholder:text-[#273C46]/35 focus:outline-none"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              className="btn-secondary inline-flex items-center gap-1.5 px-3 py-2 text-xs disabled:opacity-50"
            >
              {uploading ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              {uploading ? '上传中...' : '上传图片'}
            </button>
            {value && (
              <button
                type="button"
                onClick={() => onChange('')}
                className="rounded-full px-3 py-2 text-xs text-[#273C46]/55 transition-colors hover:bg-red-50 hover:text-red-500"
              >
                清除
              </button>
            )}
          </div>
        </div>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={event => void upload(event.target.files?.[0])}
      />
    </div>
  )
}

function VisualImageArrayField({
  label,
  keyName,
  value,
  onChange,
}: {
  label: string
  keyName: string
  value: string[]
  onChange: (value: string[]) => void
}) {
  const { toast } = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [url, setUrl] = useState('')

  const upload = async (files: FileList | null) => {
    if (!files?.length) return
    setUploading(true)
    const uploaded: string[] = []
    try {
      for (const file of Array.from(files)) {
        const result = await adminUpload(file)
        uploaded.push(result.url)
      }
      if (uploaded.length) {
        onChange([...value, ...uploaded.filter(item => !value.includes(item))])
        toast('success', `已上传 ${uploaded.length} 张图片`)
      }
    } catch (error: unknown) {
      toast('error', (error as Error).message || '图片上传失败')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const addUrl = () => {
    const next = url.trim()
    if (!next) return
    if (value.includes(next)) {
      toast('warning', '该图片地址已存在')
      return
    }
    onChange([...value, next])
    setUrl('')
  }

  return (
    <div className="rounded-2xl border border-white/65 bg-white/35 p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <span className="text-xs font-medium text-[#051A24]">{label}</span>
          <code className="ml-2 text-[9px] text-[#273C46]/35">{keyName}</code>
          <span className="ml-2 text-[10px] text-[#273C46]/35">{value.length} 张</span>
        </div>
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
          className="btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] disabled:opacity-50"
        >
          {uploading ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          {uploading ? '上传中...' : '上传图片'}
        </button>
      </div>

      {value.length > 0 ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {value.map((src, index) => (
            <div key={`${src}-${index}`} className="group relative aspect-video overflow-hidden rounded-xl border border-white/70 bg-white/45">
              <img src={src} alt={`图片 ${index + 1}`} className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => onChange(value.filter((_, itemIndex) => itemIndex !== index))}
                className="absolute right-1.5 top-1.5 rounded-full bg-black/45 p-1.5 text-white opacity-0 backdrop-blur-sm transition-opacity hover:bg-red-500 group-hover:opacity-100"
                aria-label={`删除第 ${index + 1} 张图片`}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex h-24 w-full flex-col items-center justify-center rounded-xl border border-dashed border-[#273C46]/15 bg-white/25 text-[#273C46]/35 transition-colors hover:border-[#273C46]/25 hover:bg-white/40"
        >
          <ImageIcon className="mb-1.5 h-6 w-6" />
          <span className="text-[11px]">点击上传活动图片</span>
        </button>
      )}

      <div className="mt-3 flex gap-2">
        <input
          value={url}
          onChange={event => setUrl(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter') {
              event.preventDefault()
              addUrl()
            }
          }}
          placeholder="或粘贴图片 URL"
          className="admin-glass-control min-w-0 flex-1 rounded-xl border border-white/60 px-3 py-2 text-xs text-[#051A24] placeholder:text-[#273C46]/35 focus:outline-none"
        />
        <button
          type="button"
          onClick={addUrl}
          disabled={!url.trim()}
          className="btn-secondary inline-flex items-center gap-1 px-3 py-2 text-[11px] disabled:opacity-40"
        >
          <Link2 className="h-3 w-3" /> 添加
        </button>
      </div>

      <input
        ref={fileRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={event => void upload(event.target.files)}
      />
    </div>
  )
}
