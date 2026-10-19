import { useState, useEffect, useCallback } from 'react'
import { Plus, Edit3, Trash2, FileText } from 'lucide-react'
import AdminLayout from './AdminLayout'
import AdminModal, { Field, Input, Textarea } from './AdminModal'
import ConfirmDialog from './ConfirmDialog'
import { useToast } from './Toast'
import { adminListPages, adminCreatePage, adminSavePage, adminDeletePage } from '../../services/adminApi'
import type { AdminPage } from '../../services/adminApi'

export default function AdminPages() {
  const { toast } = useToast()
  const [pages, setPages] = useState<AdminPage[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<AdminPage | null>(null)
  const [form, setForm] = useState({ slug: '', title: '', content: '{}' })
  const [jsonError, setJsonError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<AdminPage | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => { setLoading(true); setPages(await adminListPages().catch(() => [])); setLoading(false) }, [])
  useEffect(() => { load() }, [load])

  const openCreate = () => { setEditing(null); setForm({ slug: '', title: '', content: '{}' }); setJsonError(''); setShowModal(true) }
  const openEdit = (p: AdminPage) => { setEditing(p); setForm({ slug: p.slug, title: p.title, content: JSON.stringify(p.content, null, 2) }); setJsonError(''); setShowModal(true) }

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
              <button onClick={() => openEdit(p)} className="p-2 rounded-xl hover:bg-[rgba(0,0,0,0.04)] text-[#273C46]/40 hover:text-[#051A24] transition-all"><Edit3 className="w-4 h-4" /></button>
              <button onClick={() => setConfirmDelete(p)} className="p-2 rounded-xl hover:bg-red-50 text-[#273C46]/30 hover:text-red-500 transition-all"><Trash2 className="w-4 h-4" /></button>
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

        <AdminModal open={showModal} title={editing ? '编辑页面' : '新建页面'} onClose={() => setShowModal(false)} maxWidth="max-w-xl">
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <Field label="Slug" className="col-span-1"><Input value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} placeholder="about" disabled={!!editing} /></Field>
              <Field label="页面标题" className="col-span-2"><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="关于我们" /></Field>
            </div>
            {jsonError && <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-2xl px-4 py-3"><div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />{jsonError}</div>}
            <Field label="内容 (JSON)">
              <Textarea value={form.content} onChange={e => { setForm({ ...form, content: e.target.value }); setJsonError('') }} placeholder='{"key": "value"}' rows={12} className="font-mono text-xs" />
            </Field>
            <button onClick={handleSave} className="btn-primary w-full py-3 text-sm font-medium">{editing ? '保存修改' : '创建页面'}</button>
          </div>
        </AdminModal>

        <ConfirmDialog open={!!confirmDelete} title="删除页面" message={`确定要删除页面「${confirmDelete?.title}」吗？`} variant="danger" confirmLabel="删除" onConfirm={handleDelete} onCancel={() => setConfirmDelete(null)} loading={deleting} />
      </div>
    </AdminLayout>
  )
}
