import { useState, useEffect, useCallback } from 'react'
import { Plus, Edit3, Trash2, X, PenTool, Pin } from 'lucide-react'
import AdminLayout from './AdminLayout'
import AdminModal, { Field, Input, Select, Textarea } from './AdminModal'
import ConfirmDialog from './ConfirmDialog'
import TagPill from '../ui/TagPill'
import { useToast } from './Toast'
import { adminListBlogs, adminCreateBlog, adminUpdateBlog, adminDeleteBlog } from '../../services/adminApi'
import type { AdminBlog } from '../../services/adminApi'

const CATS = [
  { value: 'tech', label: '技术分享' }, { value: 'event', label: '活动记录' },
  { value: 'summary', label: '心得总结' }, { value: 'announcement', label: '公告通知' },
]
const emptyBlog: AdminBlog = { id: 0, slug: '', title: '', excerpt: '', content: '', category: 'tech', tags: [], date: '', coverImage: '', isPublished: true, pinned: false }

export default function AdminBlogs() {
  const { toast } = useToast()
  const [blogs, setBlogs] = useState<AdminBlog[]>([])
  const [category, setCategory] = useState('')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<AdminBlog | null>(null)
  const [form, setForm] = useState<AdminBlog>(emptyBlog)
  const [tagInput, setTagInput] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<AdminBlog | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const params: Record<string, string> = {}
    if (category) params.category = category
    setBlogs(await adminListBlogs(params).catch(() => []))
    setLoading(false)
  }, [category])
  useEffect(() => { load() }, [load])

  const openCreate = () => { setEditing(null); setForm({ ...emptyBlog, tags: [] }); setTagInput(''); setShowModal(true) }
  const openEdit = (b: AdminBlog) => { setEditing(b); setForm({ ...b, tags: b.tags || [] }); setTagInput(''); setShowModal(true) }

  const handleSave = async () => {
    if (!form.title.trim()) { toast('warning', '请输入文章标题'); return }
    try {
      if (editing?.id) { await adminUpdateBlog(editing.id, form); toast('success', '文章已更新') }
      else { await adminCreateBlog(form); toast('success', '文章已发布') }
      setShowModal(false); load()
    } catch (e: unknown) { toast('error', (e as Error).message) }
  }

  const handleDelete = async () => {
    if (!confirmDelete) return; setDeleting(true)
    try { await adminDeleteBlog(confirmDelete.id); toast('success', '文章已删除'); setConfirmDelete(null); load() }
    catch (e: unknown) { toast('error', (e as Error).message) } finally { setDeleting(false) }
  }

  const addTag = () => { const t = tagInput.trim(); if (t) { setForm({ ...form, tags: [...(form.tags || []), t] }); setTagInput('') } }
  const removeTag = (i: number) => { setForm({ ...form, tags: (form.tags || []).filter((_, idx) => idx !== i) }) }

  function renderContent() {
    if (loading) return <TableSkeleton />
    if (blogs.length === 0) return (
      <div className="flex flex-col items-center py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-[#f0ece6] flex items-center justify-center mb-4"><PenTool className="w-7 h-7 text-[#273C46]/20" /></div>
        <p className="text-sm text-[#273C46]/50">暂无文章</p>
        <button onClick={openCreate} className="btn-primary text-xs px-4 py-2 mt-4 inline-flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" /> 写第一篇文章</button>
      </div>
    )
    return (
      <div className="card overflow-hidden" style={{ borderRadius: 24 }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-[#fcfbfa] border-b border-[rgba(0,0,0,0.06)]">
              {['标题', '分类', '作者', '日期', '状态', ''].map(h => (<th key={h} className={`text-left px-5 py-3 text-[11px] font-semibold text-[#273C46]/40 uppercase tracking-wider ${h === '' ? 'text-right' : ''}`}>{h || '操作'}</th>))}
            </tr></thead>
            <tbody>
              {blogs.map((b) => (
                <tr key={b.id} className="border-b border-[rgba(0,0,0,0.03)] hover:bg-[#fcfbfa] transition-colors">
                  <td className="px-5 py-3 max-w-[250px]">
                    <div className="flex items-center gap-2">
                      {b.pinned && (
                        <span title="已置顶" className="inline-flex items-center gap-1 text-[10px] font-medium rounded-full bg-[#051A24] text-white px-2 py-0.5 shrink-0">
                          <Pin className="w-2.5 h-2.5" /> 置顶
                        </span>
                      )}
                      <span className="font-semibold text-[#051A24] truncate">{b.title}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3"><span className="text-xs bg-[#f0ece6] text-[#273C46] rounded-full px-2.5 py-1 font-medium">{CATS.find(c => c.value === b.category)?.label || b.category}</span></td>
                  <td className="px-5 py-3 text-[#273C46]/70 text-xs">{b.author?.name || b.authorName || '—'}</td>
                  <td className="px-5 py-3 text-[#273C46]/40 text-xs font-mono">{b.date || '—'}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium rounded-full px-2.5 py-1 ${b.isPublished !== false ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-400'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${b.isPublished !== false ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                      {b.isPublished !== false ? '已发布' : '草稿'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-0.5">
                      <button onClick={() => openEdit(b)} className="p-2 rounded-xl hover:bg-[rgba(0,0,0,0.04)] text-[#273C46]/40 hover:text-[#051A24] transition-all"><Edit3 className="w-4 h-4" /></button>
                      <button onClick={() => setConfirmDelete(b)} className="p-2 rounded-xl hover:bg-red-50 text-[#273C46]/30 hover:text-red-500 transition-all"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <AdminLayout>
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div><h1 className="text-[28px] font-medium text-[#051A24] tracking-tight" style={{ fontFamily: "var(--font-sans)", fontWeight: 500 }}>博客管理</h1><p className="text-sm text-[#273C46]/50 mt-1">{blogs.length} 篇文章 · {blogs.filter(b => b.isPublished !== false).length} 已发布</p></div>
          <button onClick={openCreate} className="btn-primary text-sm px-5 py-2.5 flex items-center gap-2 shadow-lg shadow-[#051A24]/10"><Plus className="w-4 h-4" /> 写文章</button>
        </div>
        <div className="flex gap-1.5 flex-wrap mb-6">
          {[{ value: '', label: '全部分类' }, ...CATS].map(c => (<TagPill key={c.value} label={c.label} active={category === c.value} onClick={() => setCategory(c.value)} />))}
        </div>
        {renderContent()}

        <AdminModal open={showModal} title={editing ? '编辑文章' : '写文章'} onClose={() => setShowModal(false)} maxWidth="max-w-xl">
          <div className="space-y-4">
            <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="文章标题 *" />
            <Textarea value={form.excerpt || ''} onChange={e => setForm({ ...form, excerpt: e.target.value })} placeholder="摘要" rows={2} />
            <Textarea value={form.content || ''} onChange={e => setForm({ ...form, content: e.target.value })} placeholder="正文 (支持 Markdown)" rows={6} className="font-mono text-xs" />
            <div className="grid grid-cols-2 gap-4">
              <Field label="分类"><Select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>{CATS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</Select></Field>
              <Field label="日期"><Input value={form.date || ''} onChange={e => setForm({ ...form, date: e.target.value })} placeholder="2025-12-15" /></Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="作者"><Input value={form.authorName || ''} onChange={e => setForm({ ...form, authorName: e.target.value })} placeholder="作者名" /></Field>
              <Field label="封面图片 URL"><Input value={form.coverImage || ''} onChange={e => setForm({ ...form, coverImage: e.target.value })} placeholder="https://..." /></Field>
            </div>
            <Field label="标签">
              <div className="flex gap-2 mb-2 flex-wrap">{(form.tags || []).map((t, i) => (<span key={i} className="text-xs bg-[#051A24] text-white rounded-full pl-3 pr-2 py-1 flex items-center gap-1 font-medium">{t} <button onClick={() => removeTag(i)} className="hover:text-red-300 transition-colors"><X className="w-3 h-3" /></button></span>))}</div>
              <div className="flex gap-2"><Input value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }} placeholder="添加标签" /><button onClick={addTag} className="btn-secondary text-xs px-4 py-2.5 shrink-0">添加</button></div>
            </Field>
            <label className="flex items-center gap-2.5 text-sm text-[#273C46] cursor-pointer"><input type="checkbox" checked={form.isPublished !== false} onChange={e => setForm({ ...form, isPublished: e.target.checked })} className="w-4 h-4 rounded border-[rgba(0,0,0,0.15)] text-[#051A24]" /> 发布</label>
            <label className="flex items-center gap-2.5 text-sm text-[#273C46] cursor-pointer"><input type="checkbox" checked={!!form.pinned} onChange={e => setForm({ ...form, pinned: e.target.checked })} className="w-4 h-4 rounded border-[rgba(0,0,0,0.15)] text-[#051A24]" /> 置顶（优先展示）</label>
            <button onClick={handleSave} className="btn-primary w-full py-3 text-sm font-medium">{editing ? '保存修改' : '发布文章'}</button>
          </div>
        </AdminModal>

        <ConfirmDialog open={!!confirmDelete} title="删除文章" message={`确定要删除「${confirmDelete?.title}」吗？`} variant="danger" confirmLabel="删除" onConfirm={handleDelete} onCancel={() => setConfirmDelete(null)} loading={deleting} />
      </div>
    </AdminLayout>
  )
}
function TableSkeleton() { return <div className="card overflow-hidden animate-pulse" style={{ borderRadius: 24 }}><div className="p-5 space-y-4">{Array.from({ length: 4 }).map((_, i) => (<div key={i} className="flex items-center gap-4"><div className="h-4 w-56 bg-[#f0ece6] rounded-lg flex-1" /><div className="h-6 w-14 bg-[#f0ece6] rounded-full" /><div className="h-4 w-20 bg-[#f0ece6] rounded-lg" /></div>))}</div></div> }
