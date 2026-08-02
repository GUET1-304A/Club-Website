import { useState, useEffect, useCallback } from 'react'
import { Plus, Search, Edit3, Trash2, X, Upload, FolderGit2 } from 'lucide-react'
import AdminLayout from './AdminLayout'
import AdminModal, { Field, Input, Select, Textarea } from './AdminModal'
import ConfirmDialog from './ConfirmDialog'
import TagPill from '../ui/TagPill'
import { useToast } from './Toast'
import { adminListProjects, adminCreateProject, adminUpdateProject, adminDeleteProject, adminUpload } from '../../services/adminApi'
import type { AdminProject } from '../../services/adminApi'

const CATS = [
  { value: 'web', label: 'Web应用' }, { value: 'miniapp', label: '小程序' },
  { value: 'ai', label: 'AI/算法' }, { value: 'tools', label: '工具库' }, { value: 'game', label: '游戏' },
]
const STATUSES = [{ value: 'active', label: '进行中' }, { value: 'completed', label: '已完成' }, { value: 'archived', label: '已归档' }]
const STATUS_STYLES: Record<string, string> = { active: 'bg-blue-50 text-blue-700 border-blue-200', completed: 'bg-emerald-50 text-emerald-700 border-emerald-200', archived: 'bg-gray-50 text-gray-400 border-gray-200' }
const emptyProject: AdminProject = { id: 0, slug: '', name: '', coverImage: '', category: 'web', techStack: [], description: '', content: '', githubUrl: '', demoUrl: '', stars: 0, forks: 0, screenshots: [], team: [], status: 'active' }
type ModalMode = 'create' | 'edit' | null

export default function AdminProjects() {
  const { toast } = useToast()
  const [projects, setProjects] = useState<AdminProject[]>([])
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [loading, setLoading] = useState(true)
  const [modalMode, setModalMode] = useState<ModalMode>(null)
  const [editing, setEditing] = useState<AdminProject | null>(null)
  const [form, setForm] = useState<AdminProject>(emptyProject)
  const [uploading, setUploading] = useState(false)
  const [uploadingScreenshot, setUploadingScreenshot] = useState(false)
  const [techInput, setTechInput] = useState('')
  const [teamInput, setTeamInput] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<AdminProject | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const params: Record<string, string> = {}
    if (search) params.search = search; if (category) params.category = category
    setProjects(await adminListProjects(params).catch(() => []))
    setLoading(false)
  }, [search, category])
  useEffect(() => { load() }, [load])

  const openCreate = () => { setEditing(null); setForm({ ...emptyProject, techStack: [], team: [] }); setTechInput(''); setTeamInput(''); setModalMode('create') }
  const openEdit = (p: AdminProject) => { setEditing(p); setForm({ ...p, techStack: p.techStack || [], team: p.team || [] }); setTechInput(''); setTeamInput(''); setModalMode('edit') }

  const handleSave = async () => {
    if (!form.name.trim()) { toast('warning', '请输入项目名称'); return }
    try {
      if (modalMode === 'edit' && editing?.id) { await adminUpdateProject(editing.id, form); toast('success', '项目已更新') }
      else { await adminCreateProject(form); toast('success', '项目已创建') }
      setModalMode(null); load()
    } catch (e: unknown) { toast('error', (e as Error).message) }
  }

  const handleDelete = async () => {
    if (!confirmDelete) return; setDeleting(true)
    try { await adminDeleteProject(confirmDelete.id); toast('success', '项目已删除'); setConfirmDelete(null); load() }
    catch (e: unknown) { toast('error', (e as Error).message) } finally { setDeleting(false) }
  }

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return
    setUploading(true)
    try { const { url } = await adminUpload(f); setForm({ ...form, coverImage: url }); toast('success', '封面上传成功') }
    catch (err: unknown) { toast('error', (err as Error).message) } finally { setUploading(false) }
  }

  const handleScreenshotUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return
    setUploadingScreenshot(true)
    try { const { url } = await adminUpload(f); setForm({ ...form, screenshots: [...(form.screenshots || []), url] }); toast('success', '截图已上传') }
    catch (err: unknown) { toast('error', (err as Error).message) } finally { setUploadingScreenshot(false) }
  }
  const removeScreenshot = (i: number) => { setForm({ ...form, screenshots: (form.screenshots || []).filter((_, idx) => idx !== i) }) }

  const addTech = () => { const t = techInput.trim(); if (t) { setForm({ ...form, techStack: [...(form.techStack || []), t] }); setTechInput('') } }
  const removeTech = (i: number) => { setForm({ ...form, techStack: (form.techStack || []).filter((_, idx) => idx !== i) }) }
  const addTM = () => { const t = teamInput.trim(); if (t) { setForm({ ...form, team: [...(form.team || []), { name: t, avatar: '', role: '' }] }); setTeamInput('') } }
  const removeTM = (i: number) => { setForm({ ...form, team: (form.team || []).filter((_, idx) => idx !== i) }) }

  function renderContent() {
    if (loading) return <TableSkeleton />
    if (projects.length === 0) return (
      <div className="flex flex-col items-center py-20 text-center"><div className="w-16 h-16 rounded-2xl bg-[#f0ece6] flex items-center justify-center mb-4"><FolderGit2 className="w-7 h-7 text-[#273C46]/20" /></div><p className="text-sm text-[#273C46]/50">暂无项目</p><button onClick={openCreate} className="btn-primary text-xs px-4 py-2 mt-4 inline-flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" /> 创建第一个项目</button></div>
    )
    return (
      <div className="card overflow-hidden" style={{ borderRadius: 24 }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-[#fcfbfa] border-b border-[rgba(0,0,0,0.06)]">{['项目', '分类', '技术栈', '状态', ''].map(h => (<th key={h} className={`text-left px-5 py-3 text-[11px] font-semibold text-[#273C46]/40 uppercase tracking-wider ${h === '' ? 'text-right' : ''}`}>{h || '操作'}</th>))}</tr></thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id} className="border-b border-[rgba(0,0,0,0.03)] hover:bg-[#fcfbfa] transition-colors">
                  <td className="px-5 py-3"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#f0ece6] to-[#e8e4dc] overflow-hidden shrink-0 ring-2 ring-white shadow-sm">{p.coverImage ? <img src={p.coverImage} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xs font-bold text-[#273C46]/20">{p.name?.charAt(0) || '?'}</div>}</div><div><div className="font-semibold text-[#051A24]">{p.name}</div><div className="text-xs text-[#273C46]/40">{p.description?.slice(0, 40) || ''}{p.description && p.description.length > 40 ? '...' : ''}</div></div></div></td>
                  <td className="px-5 py-3"><span className="text-xs bg-[#f0ece6] text-[#273C46] rounded-full px-2.5 py-1 font-medium">{CATS.find(c => c.value === p.category)?.label || p.category}</span></td>
                  <td className="px-5 py-3"><div className="flex gap-1 flex-wrap">{(p.techStack || []).slice(0, 3).map((t, i) => <span key={i} className="text-[10px] bg-[#f0ece6] rounded-full px-2 py-0.5 text-[#273C46]/70 font-medium">{t}</span>)}</div></td>
                  <td className="px-5 py-3"><span className={`inline-flex items-center gap-1 text-xs font-medium rounded-full px-2.5 py-1 border ${STATUS_STYLES[p.status ?? ''] || ''}`}><span className={`w-1.5 h-1.5 rounded-full ${p.status === 'active' ? 'bg-blue-500' : p.status === 'completed' ? 'bg-emerald-500' : 'bg-gray-300'}`} />{STATUSES.find(s => s.value === p.status)?.label || p.status}</span></td>
                  <td className="px-5 py-3 text-right"><div className="flex items-center justify-end gap-0.5"><button onClick={() => openEdit(p)} className="p-2 rounded-xl hover:bg-[rgba(0,0,0,0.04)] text-[#273C46]/40 hover:text-[#051A24] transition-all"><Edit3 className="w-4 h-4" /></button><button onClick={() => setConfirmDelete(p)} className="p-2 rounded-xl hover:bg-red-50 text-[#273C46]/30 hover:text-red-500 transition-all"><Trash2 className="w-4 h-4" /></button></div></td>
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
          <div><h1 className="text-[28px] font-medium text-[#051A24] tracking-tight" style={{ fontFamily: "'PP Neue Montreal', 'Noto Sans SC', sans-serif", fontWeight: 500 }}>项目管理</h1><p className="text-sm text-[#273C46]/50 mt-1">{projects.length} 个项目 · {projects.filter(p => p.status === 'active').length} 进行中</p></div>
          <button onClick={openCreate} className="btn-primary text-sm px-5 py-2.5 flex items-center gap-2 shadow-lg shadow-[#051A24]/10"><Plus className="w-4 h-4" /> 新建项目</button>
        </div>
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="relative flex-1 min-w-[180px] max-w-xs"><Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#273C46]/25" /><input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索项目..." className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-[rgba(0,0,0,0.06)] bg-white text-sm focus:outline-none focus:border-[#051A24]/30 focus:ring-2 focus:ring-[#051A24]/5 transition-all" /></div>
          <div className="flex gap-1.5 flex-wrap">{[{ value: '', label: '全部' }, ...CATS].map(c => <TagPill key={c.value} label={c.label} active={category === c.value} onClick={() => setCategory(c.value)} />)}</div>
        </div>
        {renderContent()}

        <AdminModal open={!!modalMode} title={modalMode === 'create' ? '新建项目' : '编辑项目'} onClose={() => setModalMode(null)} maxWidth="max-w-xl">
          <div className="space-y-4">
            <div className="h-32 rounded-2xl bg-gradient-to-br from-[#f0ece6] to-[#e8e4dc] overflow-hidden relative group">
              {form.coverImage ? <img src={form.coverImage} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[#273C46]/20 text-sm font-medium">封面图片</div>}
              <label className="absolute inset-0 bg-black/30 flex flex-col items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                {uploading ? <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <><Upload className="w-5 h-5 text-white" /><span className="text-xs text-white font-medium">上传封面</span></>}
                <input type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} disabled={uploading} />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-4"><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="项目名称 *" /><Select value={form.category || 'web'} onChange={e => setForm({ ...form, category: e.target.value })}>{CATS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</Select></div>
            <Textarea value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="简短描述" rows={2} />
            <Field label="技术栈"><div className="flex gap-2 mb-2 flex-wrap">{(form.techStack || []).map((t, i) => (<span key={i} className="text-xs bg-[#051A24] text-white rounded-full pl-3 pr-2 py-1 flex items-center gap-1 font-medium">{t} <button onClick={() => removeTech(i)} className="hover:text-red-300"><X className="w-3 h-3" /></button></span>))}</div><div className="flex gap-2"><Input value={techInput} onChange={e => setTechInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTech() } }} placeholder="React, TypeScript..." /><button onClick={addTech} className="btn-secondary text-xs px-4 py-2.5 shrink-0">添加</button></div></Field>
            <div className="grid grid-cols-2 gap-4"><Input value={form.githubUrl || ''} onChange={e => setForm({ ...form, githubUrl: e.target.value })} placeholder="GitHub URL" type="url" /><Input value={form.demoUrl || ''} onChange={e => setForm({ ...form, demoUrl: e.target.value })} placeholder="Demo URL" type="url" /></div>
            <div className="grid grid-cols-3 gap-4"><Input value={form.stars || 0} onChange={e => setForm({ ...form, stars: parseInt(e.target.value) || 0 })} placeholder="Stars" type="number" /><Input value={form.forks || 0} onChange={e => setForm({ ...form, forks: parseInt(e.target.value) || 0 })} placeholder="Forks" type="number" /><Field label="状态"><Select value={form.status || 'active'} onChange={e => setForm({ ...form, status: e.target.value })}>{STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}</Select></Field></div>
            <Field label="团队成员"><div className="space-y-1 mb-2">{(form.team || []).map((tm, i) => (<div key={i} className="flex items-center justify-between text-sm text-[#273C46] bg-[#f8f7f5] rounded-xl px-3 py-2"><span className="text-xs">{tm.name}{tm.role ? ` · ${tm.role}` : ''}</span><button onClick={() => removeTM(i)} className="text-[#273C46]/20 hover:text-red-500 transition-colors"><X className="w-3.5 h-3.5" /></button></div>))}</div><div className="flex gap-2"><Input value={teamInput} onChange={e => setTeamInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTM() } }} placeholder="成员姓名" /><button onClick={addTM} className="btn-secondary text-xs px-4 py-2.5 shrink-0">添加</button></div></Field>
            <Field label={`项目截图 (${(form.screenshots || []).length} 张)`}>
              <div className="grid grid-cols-3 gap-2 mb-2">
                {(form.screenshots || []).map((url, i) => (
                  <div key={i} className="relative group rounded-xl overflow-hidden bg-[#f0ece6] aspect-video">
                    <img src={url} alt={`截图 ${i + 1}`} className="w-full h-full object-cover" />
                    <button
                      onClick={() => removeScreenshot(i)}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/50 flex items-center justify-center
                        opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                    >
                      <X className="w-3 h-3 text-white" />
                    </button>
                  </div>
                ))}
                <label className="aspect-video rounded-xl border-2 border-dashed border-[rgba(0,0,0,0.1)] flex flex-col items-center justify-center gap-1
                  hover:border-[#051A24]/30 hover:bg-[rgba(0,0,0,0.01)] transition-all cursor-pointer">
                  {uploadingScreenshot ? (
                    <div className="w-5 h-5 border-2 border-[#051A24]/30 border-t-[#051A24] rounded-full animate-spin" />
                  ) : (
                    <>
                      <Upload className="w-5 h-5 text-[#273C46]/25" />
                      <span className="text-[10px] text-[#273C46]/30 font-medium">上传</span>
                    </>
                  )}
                  <input type="file" accept="image/*" className="hidden" onChange={handleScreenshotUpload} disabled={uploadingScreenshot} />
                </label>
              </div>
            </Field>
            <Field label="详细内容 (Markdown)"><Textarea value={form.content || ''} onChange={e => setForm({ ...form, content: e.target.value })} placeholder="## 项目介绍..." rows={4} className="font-mono text-xs" /></Field>
            <div className="flex gap-3 pt-2"><button onClick={() => setModalMode(null)} className="btn-secondary flex-1 py-3 text-sm">取消</button><button onClick={handleSave} className="btn-primary flex-1 py-3 text-sm font-medium">{modalMode === 'create' ? '创建项目' : '保存修改'}</button></div>
          </div>
        </AdminModal>
        <ConfirmDialog open={!!confirmDelete} title="删除项目" message={`确定要删除「${confirmDelete?.name}」吗？关联的里程碑和任务也将被删除。`} variant="danger" confirmLabel="删除" onConfirm={handleDelete} onCancel={() => setConfirmDelete(null)} loading={deleting} />
      </div>
    </AdminLayout>
  )
}
function TableSkeleton() { return <div className="card overflow-hidden animate-pulse" style={{ borderRadius: 24 }}><div className="p-5 space-y-4">{Array.from({ length: 4 }).map((_, i) => (<div key={i} className="flex items-center gap-4"><div className="w-10 h-10 rounded-xl bg-[#f0ece6]" /><div className="space-y-2 flex-1"><div className="h-4 w-32 bg-[#f0ece6] rounded-lg" /><div className="h-3 w-20 bg-[#f0ece6] rounded-md" /></div><div className="h-6 w-16 bg-[#f0ece6] rounded-full" /></div>))}</div></div> }
