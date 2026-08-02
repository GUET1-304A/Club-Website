import { useState, useEffect, useCallback } from 'react'
import { Plus, Search, Edit3, Trash2, Image, Upload, Link2 } from 'lucide-react'
import AdminLayout from './AdminLayout'
import AdminModal, { Field, Input, Select, Textarea } from './AdminModal'
import ConfirmDialog from './ConfirmDialog'
import TagPill from '../ui/TagPill'
import { useToast } from './Toast'
import {
  adminListMembers, adminCreateMember, adminUpdateMember,
  adminDeleteMember, adminUpload,
} from '../../services/adminApi'
import type { AdminMember } from '../../services/adminApi'

const GROUPS = [
  { value: 'product', label: '产品组' },
  { value: 'design', label: '设计组' },
  { value: 'dev', label: '开发组' },
  { value: 'content', label: '内容组' },
]

const emptyMember: AdminMember = {
  id: 0, name: '', avatar: '', role: '', group: 'dev',
  skills: [], github: '', blog: '', email: '', bio: '', grade: '', isAlumni: false,
}

export default function AdminMembers() {
  const { toast } = useToast()
  const [members, setMembers] = useState<AdminMember[]>([])
  const [search, setSearch] = useState('')
  const [group, setGroup] = useState('')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<AdminMember | null>(null)
  const [form, setForm] = useState<AdminMember>(emptyMember)
  const [uploading, setUploading] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<AdminMember | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const params: Record<string, string> = {}
    if (search) params.search = search
    if (group) params.group = group
    const data = await adminListMembers(params).catch(() => [])
    setMembers(data)
    setLoading(false)
  }, [search, group])

  useEffect(() => { load() }, [load])

  const openCreate = () => {
    setEditing(null)
    setForm({ ...emptyMember, skills: [] })
    setShowModal(true)
  }

  const openEdit = (m: AdminMember) => {
    setEditing(m)
    setForm({ ...m, skills: m.skills || [] })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) { toast('warning', '请填写成员姓名'); return }
    try {
      if (editing && editing.id) {
        await adminUpdateMember(editing.id, form)
        toast('success', '成员信息已更新')
      } else {
        await adminCreateMember(form)
        toast('success', '成员已添加')
      }
      setShowModal(false)
      load()
    } catch (e: unknown) { toast('error', (e as Error).message) }
  }

  const handleDelete = async () => {
    if (!confirmDelete) return
    setDeleting(true)
    try {
      await adminDeleteMember(confirmDelete.id)
      toast('success', `已删除成员「${confirmDelete.name}」`)
      setConfirmDelete(null)
      load()
    } catch (e: unknown) { toast('error', (e as Error).message) }
    finally { setDeleting(false) }
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    setUploading(true)
    try {
      const { url } = await adminUpload(file)
      setForm({ ...form, avatar: url })
      toast('success', '头像已上传')
    } catch (err: unknown) { toast('error', (err as Error).message) }
    finally { setUploading(false) }
  }

  /* ─── Render helpers ─── */
  function renderContent() {
    if (loading) return <TableSkeleton />
    if (members.length === 0) return (
      <div className="flex flex-col items-center py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-[#f0ece6] flex items-center justify-center mb-4">
          <Image className="w-7 h-7 text-[#273C46]/20" />
        </div>
        <p className="text-sm text-[#273C46]/50">暂无成员</p>
        <button onClick={openCreate} className="btn-primary text-xs px-4 py-2 mt-4 inline-flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" /> 添加第一位成员
        </button>
      </div>
    )
    return (
      <div className="card overflow-hidden" style={{ borderRadius: 24 }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#fcfbfa] border-b border-[rgba(0,0,0,0.06)]">
                {['成员', '组别', '角色', '年级', '状态', ''].map(h => (
                  <th key={h} className={`text-left px-5 py-3 text-[11px] font-semibold text-[#273C46]/40 uppercase tracking-wider ${h === '' ? 'text-right' : ''}`}>{h || '操作'}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="border-b border-[rgba(0,0,0,0.03)] hover:bg-[#fcfbfa] transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#f0ece6] to-[#e8e4dc] overflow-hidden shrink-0 ring-2 ring-white shadow-sm">
                        {m.avatar
                          ? <img src={m.avatar} alt="" className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center text-xs font-semibold text-[#273C46]/30">{m.name?.[0] || '?'}</div>
                        }
                      </div>
                      <span className="font-semibold text-[#051A24]">{m.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span className="text-xs bg-[#f0ece6] text-[#273C46] rounded-full px-2.5 py-1 font-medium">
                      {GROUPS.find(g => g.value === m.group)?.label || m.group}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-[#273C46]/70 text-xs">{m.role || '—'}</td>
                  <td className="px-5 py-3 text-[#273C46]/60 text-xs font-mono">{m.grade || '—'}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium rounded-full px-2.5 py-1
                      ${m.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-400'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${m.status === 'active' ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                      {m.status === 'active' ? '活跃' : '停用'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-0.5">
                      <button onClick={() => openEdit(m)}
                        className="p-2 rounded-xl hover:bg-[rgba(0,0,0,0.04)] text-[#273C46]/40 hover:text-[#051A24] transition-all"
                        title="编辑">
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button onClick={() => setConfirmDelete(m)}
                        className="p-2 rounded-xl hover:bg-red-50 text-[#273C46]/30 hover:text-red-500 transition-all"
                        title="删除">
                        <Trash2 className="w-4 h-4" />
                      </button>
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
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-[28px] font-medium text-[#051A24] tracking-tight"
              style={{ fontFamily: "'PP Neue Montreal', 'Noto Sans SC', sans-serif", fontWeight: 500 }}>
              成员管理
            </h1>
            <p className="text-sm text-[#273C46]/50 mt-1">
              {members.length} 位成员 · {members.filter(m => m.status === 'active').length} 位活跃
            </p>
          </div>
          <button onClick={openCreate} className="btn-primary text-sm px-5 py-2.5 flex items-center gap-2 shadow-lg shadow-[#051A24]/10">
            <Plus className="w-4 h-4" /> 添加成员
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#273C46]/25" />
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="搜索成员..."
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-[rgba(0,0,0,0.06)] bg-white text-sm text-[#051A24]
                placeholder:text-[#273C46]/30 focus:outline-none focus:border-[#051A24]/30 focus:ring-2 focus:ring-[#051A24]/5 transition-all"
            />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {[{ value: '', label: '全部' }, ...GROUPS].map(g => (
              <TagPill key={g.value} label={g.label} active={group === g.value} onClick={() => setGroup(g.value)} />
            ))}
          </div>
        </div>

        {/* Content */}
        {renderContent()}

        {/* Create/Edit Modal */}
        <AdminModal open={showModal} title={editing ? '编辑成员' : '添加成员'} onClose={() => setShowModal(false)}>
          <div className="space-y-5">
            {/* Avatar + Name & Role */}
            <div className="flex items-start gap-4">
              <div className="relative group shrink-0">
                <div className="w-[72px] h-[72px] rounded-2xl bg-gradient-to-br from-[#f0ece6] to-[#e8e4dc] overflow-hidden ring-2 ring-white shadow-md">
                  {form.avatar
                    ? <img src={form.avatar} alt="" className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-2xl text-[#273C46]/20 font-semibold">{form.name?.[0] || '?'}</div>
                  }
                </div>
                <label className="absolute inset-0 bg-black/30 rounded-2xl flex flex-col items-center justify-center gap-1
                  opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                  {uploading
                    ? <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    : <><Upload className="w-4 h-4 text-white" /><span className="text-[10px] text-white font-medium">更换</span></>
                  }
                  <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={uploading} />
                </label>
              </div>
              <div className="flex-1 space-y-3">
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="姓名 *" />
                <Input value={form.role || ''} onChange={e => setForm({ ...form, role: e.target.value })} placeholder="角色/职位" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="组别">
                <Select value={form.group || 'dev'} onChange={e => setForm({ ...form, group: e.target.value })}>
                  {GROUPS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
                </Select>
              </Field>
              <Field label="年级">
                <Input value={form.grade || ''} onChange={e => setForm({ ...form, grade: e.target.value })} placeholder="2024级" />
              </Field>
            </div>

            <Field label="技能">
              <Input
                value={(form.skills || []).join(', ')}
                onChange={e => setForm({ ...form, skills: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                placeholder="React, TypeScript, Node.js（逗号分隔）"
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="GitHub">
                <div className="relative">
                  <Link2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#273C46]/25" />
                  <Input className="pl-10" value={form.github || ''} onChange={e => setForm({ ...form, github: e.target.value })} placeholder="https://github.com/..." />
                </div>
              </Field>
              <Field label="博客">
                <Input value={form.blog || ''} onChange={e => setForm({ ...form, blog: e.target.value })} placeholder="https://blog.example.com" />
              </Field>
            </div>

            <Field label="邮箱">
              <Input type="email" value={form.email || ''} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="email@example.com" />
            </Field>

            <Field label="简介">
              <Textarea value={form.bio || ''} onChange={e => setForm({ ...form, bio: e.target.value })} placeholder="个人简介..." rows={3} />
            </Field>

            <label className="flex items-center gap-2.5 text-sm text-[#273C46] cursor-pointer select-none">
              <input type="checkbox" checked={form.isAlumni || false} onChange={e => setForm({ ...form, isAlumni: e.target.checked })}
                className="w-4 h-4 rounded border-[rgba(0,0,0,0.15)] text-[#051A24] focus:ring-[#051A24]/10" />
              已毕业 (Alumni)
            </label>

            <button onClick={handleSave} className="btn-primary w-full py-3 text-sm font-medium">
              {editing ? '保存修改' : '添加成员'}
            </button>
          </div>
        </AdminModal>

        {/* Delete confirm */}
        <ConfirmDialog
          open={!!confirmDelete}
          title="删除成员"
          message={`确定要删除「${confirmDelete?.name}」吗？此操作不可撤销。`}
          variant="danger"
          confirmLabel="删除"
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
          loading={deleting}
        />
      </div>
    </AdminLayout>
  )
}

/* ─── Skeleton ─── */
function TableSkeleton() {
  return (
    <div className="card overflow-hidden animate-pulse" style={{ borderRadius: 24 }}>
      <div className="p-5 space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-[#f0ece6]" />
            <div className="space-y-2 flex-1">
              <div className="h-4 w-24 bg-[#f0ece6] rounded-lg" />
              <div className="h-3 w-16 bg-[#f0ece6] rounded-md" />
            </div>
            <div className="h-6 w-16 bg-[#f0ece6] rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
