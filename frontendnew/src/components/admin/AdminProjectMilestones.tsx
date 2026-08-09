import { useState, useEffect, useCallback } from 'react'
import { Plus, Calendar, LoaderCircle } from 'lucide-react'
import AdminModal, { Field, Input, Select, Textarea } from './AdminModal'
import {
  adminListProjectMilestones, adminCreateMilestone,
  type AdminMilestone,
} from '../../services/adminApi'
import { useToast } from './Toast'

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  pending: { label: '未开始', cls: 'bg-[#f0ece6] text-[#273C46]/60' },
  in_progress: { label: '进行中', cls: 'bg-blue-50 text-blue-600' },
  completed: { label: '已完成', cls: 'bg-emerald-50 text-emerald-700' },
}

const EMPTY_FORM = { name: '', description: '', dueDate: '', status: 'pending' }

export default function AdminProjectMilestones({ projectId }: { projectId: number }) {
  const { toast } = useToast()
  const [milestones, setMilestones] = useState<AdminMilestone[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const data = await adminListProjectMilestones(projectId).catch(() => [])
    setMilestones(data)
    setLoading(false)
  }, [projectId])

  useEffect(() => { load() }, [load])

  const handleSave = async () => {
    if (!form.name.trim()) { toast('warning', '请填写里程碑名称'); return }
    setSaving(true)
    try {
      await adminCreateMilestone(projectId, {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        dueDate: form.dueDate || undefined,
        status: form.status,
      })
      toast('success', '里程碑已创建')
      setModalOpen(false)
      setForm({ ...EMPTY_FORM })
      load()
    } catch (error: unknown) {
      toast('error', (error as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-[#273C46]/50">{milestones.length} 个里程碑</p>
        <button onClick={() => setModalOpen(true)}
          className="btn-primary text-xs px-4 py-2 inline-flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" /> 新建里程碑
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="card p-5 animate-pulse" style={{ borderRadius: 20 }}>
              <div className="h-4 w-40 bg-[#f0ece6] rounded-md mb-3" />
              <div className="h-3 w-full bg-[#f0ece6] rounded-md" />
            </div>
          ))}
        </div>
      ) : milestones.length === 0 ? (
        <div className="flex flex-col items-center py-14 text-center">
          <p className="text-sm text-[#273C46]/50">暂无里程碑</p>
          <p className="text-xs text-[#273C46]/30 mt-1">创建里程碑来划分项目阶段</p>
        </div>
      ) : (
        <div className="space-y-3">
          {milestones.map((milestone, index) => {
            const st = STATUS_MAP[milestone.status] || STATUS_MAP.pending
            const total = milestone.taskCount || 0
            const done = milestone.taskDoneCount || 0
            const percent = total ? Math.round(done / total * 100) : 0
            return (
              <div key={milestone.id} className="card p-5" style={{ borderRadius: 20 }}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-[#051A24] text-white flex items-center justify-center text-xs font-semibold shrink-0">
                      {index + 1}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#051A24]">{milestone.name}</p>
                      {milestone.description && (
                        <p className="text-xs text-[#273C46]/50 mt-0.5 line-clamp-1">{milestone.description}</p>
                      )}
                    </div>
                  </div>
                  <span className={`text-[10px] font-medium rounded-full px-2.5 py-1 ${st.cls}`}>{st.label}</span>
                </div>
                <div className="flex items-center gap-3 mt-4">
                  <div className="flex-1 h-2 rounded-full bg-[#f0ece6] overflow-hidden">
                    <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${percent}%` }} />
                  </div>
                  <span className="text-xs text-[#273C46]/60">{done}/{total} 任务</span>
                </div>
                {milestone.dueDate && (
                  <p className="flex items-center gap-1.5 mt-2 text-[11px] text-[#273C46]/50">
                    <Calendar className="w-3 h-3" /> 截止 {milestone.dueDate.slice(0, 10)}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}

      <AdminModal open={modalOpen} title="新建里程碑" onClose={() => setModalOpen(false)} maxWidth="max-w-lg">
        <div className="space-y-4">
          <Field label="里程碑名称 *">
            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="如：MVP 阶段" />
          </Field>
          <Field label="描述">
            <Textarea rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="阶段目标说明..." />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="状态">
              <Select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                {Object.entries(STATUS_MAP).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}
              </Select>
            </Field>
            <Field label="截止日期">
              <Input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} />
            </Field>
          </div>
          <button onClick={handleSave} disabled={saving}
            className="btn-primary w-full py-3 text-sm font-medium shadow-lg shadow-[#051A24]/10 disabled:opacity-50">
            {saving ? <LoaderCircle className="w-4 h-4 mx-auto animate-spin" /> : '创建里程碑'}
          </button>
        </div>
      </AdminModal>
    </div>
  )
}
