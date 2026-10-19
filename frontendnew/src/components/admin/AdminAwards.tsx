import { useState, useEffect, useCallback } from 'react'
import { Plus, Edit3, Trash2, Trophy } from 'lucide-react'
import AdminLayout from './AdminLayout'
import AdminModal, { Field, Input, Select, Textarea } from './AdminModal'
import ConfirmDialog from './ConfirmDialog'
import TagPill from '../ui/TagPill'
import { useToast } from './Toast'
import { adminListAwards, adminCreateAward, adminUpdateAward, adminDeleteAward } from '../../services/adminApi'
import type { AdminAward } from '../../services/adminApi'

const LEVELS = [
  { value: 'national', label: '国家级' },
  { value: 'provincial', label: '省级' },
  { value: 'school', label: '校级' },
  { value: 'other', label: '其他' },
]

const LEVEL_STYLES: Record<string, string> = {
  national: 'bg-amber-50 text-amber-700 border-amber-200',
  provincial: 'bg-blue-50 text-blue-600 border-blue-200',
  school: 'bg-gray-50 text-gray-500 border-gray-200',
  other: 'bg-purple-50 text-purple-600 border-purple-200',
}

const emptyAward: AdminAward = { id: 0, slug: '', name: '', level: 'school', category: '', winner: '', issuer: '', advisor: '', date: '', description: '', certificateImages: [], relatedProject: '' }

export default function AdminAwards() {
  const { toast } = useToast()
  const [awards, setAwards] = useState<AdminAward[]>([])
  const [level, setLevel] = useState('')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<AdminAward | null>(null)
  const [form, setForm] = useState<AdminAward>(emptyAward)
  const [confirmDelete, setConfirmDelete] = useState<AdminAward | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const params: Record<string, string> = {}
    if (level) params.level = level
    const data = await adminListAwards(params).catch(() => [])
    setAwards(data)
    setLoading(false)
  }, [level])

  useEffect(() => { load() }, [load])

  const openCreate = () => { setEditing(null); setForm({ ...emptyAward, certificateImages: [] }); setShowModal(true) }
  const openEdit = (a: AdminAward) => { setEditing(a); setForm({ ...a, certificateImages: a.certificateImages || [] }); setShowModal(true) }

  const handleSave = async () => {
    if (!form.name.trim() || !form.winner.trim()) { toast('warning', '请填写奖项名称和获奖者'); return }
    try {
      if (editing?.id) { await adminUpdateAward(editing.id, form); toast('success', '奖项已更新') }
      else { await adminCreateAward(form); toast('success', '奖项已添加') }
      setShowModal(false); load()
    } catch (e: unknown) { toast('error', (e as Error).message) }
  }

  const handleDelete = async () => {
    if (!confirmDelete) return
    setDeleting(true)
    try { await adminDeleteAward(confirmDelete.id); toast('success', '奖项已删除'); setConfirmDelete(null); load() }
    catch (e: unknown) { toast('error', (e as Error).message) }
    finally { setDeleting(false) }
  }

  function renderContent() {
    if (loading) return <TableSkeleton />
    if (awards.length === 0) return (
      <div className="flex flex-col items-center py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-[#f0ece6] flex items-center justify-center mb-4"><Trophy className="w-7 h-7 text-[#273C46]/20" /></div>
        <p className="text-sm text-[#273C46]/50">暂无奖项</p>
        <button onClick={openCreate} className="btn-primary text-xs px-4 py-2 mt-4 inline-flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" /> 添加奖项</button>
      </div>
    )
    return (
      <div className="card overflow-hidden" style={{ borderRadius: 24 }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-[#fcfbfa] border-b border-[rgba(0,0,0,0.06)]">
              {['奖项名称', '级别', '获奖者', '日期', ''].map(h => (
                <th key={h} className={`text-left px-5 py-3 text-[11px] font-semibold text-[#273C46]/40 uppercase tracking-wider ${h === '' ? 'text-right' : ''}`}>{h || '操作'}</th>
              ))}
            </tr></thead>
            <tbody>
              {awards.map((a) => (
                <tr key={a.id} className="border-b border-[rgba(0,0,0,0.03)] hover:bg-[#fcfbfa] transition-colors">
                  <td className="px-5 py-3 font-semibold text-[#051A24] max-w-[300px] truncate">{a.name}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium rounded-full px-2.5 py-1 border ${LEVEL_STYLES[a.level] || ''}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${a.level === 'national' ? 'bg-amber-500' : a.level === 'provincial' ? 'bg-blue-500' : 'bg-gray-400'}`} />
                      {LEVELS.find(l => l.value === a.level)?.label || a.level}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-[#273C46]/80 text-xs">
                    {a.winner}
                    {a.advisor && <p className="text-[10px] text-[#273C46]/40 mt-0.5">指导教师：{a.advisor}</p>}
                  </td>
                  <td className="px-5 py-3 text-[#273C46]/40 text-xs font-mono">{a.date || '—'}</td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-0.5">
                      <button onClick={() => openEdit(a)} className="p-2 rounded-xl hover:bg-[rgba(0,0,0,0.04)] text-[#273C46]/40 hover:text-[#051A24] transition-all"><Edit3 className="w-4 h-4" /></button>
                      <button onClick={() => setConfirmDelete(a)} className="p-2 rounded-xl hover:bg-red-50 text-[#273C46]/30 hover:text-red-500 transition-all"><Trash2 className="w-4 h-4" /></button>
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
          <div>
            <h1 className="text-[28px] font-medium text-[#051A24] tracking-tight" style={{ fontFamily: "var(--font-sans)", fontWeight: 500 }}>奖项管理</h1>
            <p className="text-sm text-[#273C46]/50 mt-1">{awards.length} 个奖项</p>
          </div>
          <button onClick={openCreate} className="btn-primary text-sm px-5 py-2.5 flex items-center gap-2 shadow-lg shadow-[#051A24]/10"><Plus className="w-4 h-4" /> 添加奖项</button>
        </div>
        <div className="flex gap-1.5 flex-wrap mb-6">
          {[{ value: '', label: '全部级别' }, ...LEVELS].map(l => (
            <TagPill key={l.value} label={l.label} active={level === l.value} onClick={() => setLevel(l.value)} />
          ))}
        </div>
        {renderContent()}

        <AdminModal open={showModal} title={editing ? '编辑奖项' : '添加奖项'} onClose={() => setShowModal(false)}>
          <div className="space-y-4">
            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="奖项名称 *" />
            <div className="grid grid-cols-2 gap-4">
              <Field label="级别">
                <Select value={form.level} onChange={e => setForm({ ...form, level: e.target.value })}>{LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}</Select>
              </Field>
              <Field label="日期"><Input value={form.date || ''} onChange={e => setForm({ ...form, date: e.target.value })} placeholder="2025-12" /></Field>
            </div>
            <Input value={form.winner} onChange={e => setForm({ ...form, winner: e.target.value })} placeholder="获奖者 *" />
            <div className="grid grid-cols-2 gap-4">
              <Field label="类别"><Input value={form.category || ''} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="程序设计" /></Field>
              <Field label="颁发机构"><Input value={form.issuer || ''} onChange={e => setForm({ ...form, issuer: e.target.value })} placeholder="中国计算机学会" /></Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="指导教师"><Input value={form.advisor || ''} onChange={e => setForm({ ...form, advisor: e.target.value })} placeholder="如：张教授" /></Field>
              <Field label="关联项目 slug"><Input value={form.relatedProject || ''} onChange={e => setForm({ ...form, relatedProject: e.target.value })} placeholder="campus-hub" /></Field>
            </div>
            <Field label="描述"><Textarea value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="奖项描述..." rows={2} /></Field>
            <button onClick={handleSave} className="btn-primary w-full py-3 text-sm font-medium">{editing ? '保存修改' : '添加奖项'}</button>
          </div>
        </AdminModal>

        <ConfirmDialog open={!!confirmDelete} title="删除奖项" message={`确定要删除「${confirmDelete?.name}」吗？`} variant="danger" confirmLabel="删除" onConfirm={handleDelete} onCancel={() => setConfirmDelete(null)} loading={deleting} />
      </div>
    </AdminLayout>
  )
}

function TableSkeleton() {
  return <div className="card overflow-hidden animate-pulse" style={{ borderRadius: 24 }}><div className="p-5 space-y-4">{Array.from({ length: 5 }).map((_, i) => (<div key={i} className="flex items-center gap-4"><div className="h-4 w-48 bg-[#f0ece6] rounded-lg flex-1" /><div className="h-6 w-16 bg-[#f0ece6] rounded-full" /><div className="h-4 w-24 bg-[#f0ece6] rounded-lg" /></div>))}</div></div>
}
