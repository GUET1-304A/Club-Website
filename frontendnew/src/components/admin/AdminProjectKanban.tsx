import { useState, useEffect, useCallback } from 'react'
import { Plus, ChevronLeft, ChevronRight, Edit3, LoaderCircle, Calendar, User } from 'lucide-react'
import AdminModal, { Field, Input, Select, Textarea } from './AdminModal'
import {
  adminListProjectTasks, adminListProjectMilestones, adminListMembers,
  adminCreateTask, adminUpdateTask, adminUpdateTaskStatus,
  type AdminTask, type AdminMilestone, type AdminMember,
} from '../../services/adminApi'
import { useToast } from './Toast'

const COLUMNS = [
  { value: 'todo', label: '待办' },
  { value: 'in_progress', label: '进行中' },
  { value: 'review', label: '待审核' },
  { value: 'done', label: '已完成' },
  { value: 'blocked', label: '已阻塞' },
]

const PRIORITY_STYLES: Record<string, string> = {
  urgent: 'bg-red-50 text-red-600',
  high: 'bg-orange-50 text-orange-600',
  medium: 'bg-blue-50 text-blue-600',
  low: 'bg-gray-100 text-gray-500',
}

const EMPTY_FORM = {
  title: '',
  description: '',
  status: 'todo',
  priority: 'medium',
  assigneeId: '',
  milestoneId: '',
  dueDate: '',
}

export default function AdminProjectKanban({ projectId }: { projectId: number }) {
  const { toast } = useToast()
  const [tasks, setTasks] = useState<AdminTask[]>([])
  const [members, setMembers] = useState<AdminMember[]>([])
  const [milestones, setMilestones] = useState<AdminMilestone[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<AdminTask | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [movingIds, setMovingIds] = useState<Set<number>>(() => new Set())

  const load = useCallback(async () => {
    setLoading(true)
    const [taskData, memberData, milestoneData] = await Promise.all([
      adminListProjectTasks(projectId).catch(() => []),
      adminListMembers().catch(() => []),
      adminListProjectMilestones(projectId).catch(() => []),
    ])
    setTasks(taskData)
    setMembers(memberData)
    setMilestones(milestoneData)
    setLoading(false)
  }, [projectId])

  useEffect(() => { load() }, [load])

  const openCreate = (status: string) => {
    setEditing(null)
    setForm({ ...EMPTY_FORM, status })
    setModalOpen(true)
  }

  const openEdit = (task: AdminTask) => {
    setEditing(task)
    setForm({
      title: task.title,
      description: task.description || '',
      status: task.status,
      priority: task.priority,
      assigneeId: task.assignee_id != null ? String(task.assignee_id) : '',
      milestoneId: task.milestone_id != null ? String(task.milestone_id) : '',
      dueDate: task.dueDate ? task.dueDate.slice(0, 10) : '',
    })
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!form.title.trim()) { toast('warning', '请填写任务标题'); return }
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      status: form.status,
      priority: form.priority,
      assigneeId: form.assigneeId ? Number(form.assigneeId) : undefined,
      milestoneId: form.milestoneId ? Number(form.milestoneId) : undefined,
      dueDate: form.dueDate || undefined,
    }
    setSaving(true)
    try {
      if (editing) {
        await adminUpdateTask(editing.id, payload)
        toast('success', '任务已更新')
      } else {
        await adminCreateTask(projectId, payload)
        toast('success', '任务已创建')
      }
      setModalOpen(false)
      load()
    } catch (error: unknown) {
      toast('error', (error as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const moveTask = async (task: AdminTask, direction: -1 | 1) => {
    const index = COLUMNS.findIndex(c => c.value === task.status)
    const target = COLUMNS[index + direction]
    if (!target) return
    setMovingIds(ids => { const next = new Set(ids); next.add(task.id); return next })
    try {
      await adminUpdateTaskStatus(task.id, target.value)
      toast('success', `已移动到「${target.label}」`)
      load()
    } catch (error: unknown) {
      toast('error', (error as Error).message)
    } finally {
      setMovingIds(ids => { const next = new Set(ids); next.delete(task.id); return next })
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-[#273C46]/50">{tasks.length} 个任务</p>
        <button onClick={() => openCreate('todo')}
          className="btn-primary text-xs px-4 py-2 inline-flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" /> 新建任务
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-3">
          {COLUMNS.map(c => (
            <div key={c.value} className="card p-4 animate-pulse" style={{ borderRadius: 20 }}>
              <div className="h-4 w-16 bg-[#f0ece6] rounded-md mb-3" />
              <div className="h-24 bg-[#f0ece6] rounded-xl" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-3 items-start">
          {COLUMNS.map(column => {
            const columnTasks = tasks.filter(t => t.status === column.value)
            return (
              <div key={column.value} className="rounded-[20px] bg-[#f7f5f1]/80 p-3 min-h-[200px]">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-[#273C46]/70">{column.label}</span>
                  <span className="text-[10px] font-medium bg-white rounded-full px-2 py-0.5 text-[#273C46]/50">{columnTasks.length}</span>
                </div>
                <div className="space-y-2">
                  {columnTasks.map(task => (
                    <div key={task.id} className="card p-3" style={{ borderRadius: 16 }}>
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-semibold text-[#051A24] leading-5">{task.title}</p>
                        <span className={`text-[9px] font-medium rounded-full px-1.5 py-0.5 shrink-0 ${PRIORITY_STYLES[task.priority] || PRIORITY_STYLES.medium}`}>
                          {task.priority}
                        </span>
                      </div>
                      {task.milestoneName && (
                        <p className="text-[10px] text-[#273C46]/40 mt-1">{task.milestoneName}</p>
                      )}
                      <div className="flex items-center gap-2 mt-2 text-[10px] text-[#273C46]/50 flex-wrap">
                        {task.assigneeName && (
                          <span className="flex items-center gap-1"><User className="w-2.5 h-2.5" /> {task.assigneeName}</span>
                        )}
                        {task.dueDate && (
                          <span className="flex items-center gap-1"><Calendar className="w-2.5 h-2.5" /> {task.dueDate.slice(0, 10)}</span>
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-[rgba(0,0,0,0.04)]">
                        <div className="flex items-center gap-0.5">
                          <button onClick={() => moveTask(task, -1)} disabled={movingIds.has(task.id) || column.value === 'todo'}
                            className="p-1 rounded-lg hover:bg-[rgba(0,0,0,0.05)] text-[#273C46]/40 disabled:opacity-20" title="左移">
                            <ChevronLeft className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => moveTask(task, 1)} disabled={movingIds.has(task.id) || column.value === 'done'}
                            className="p-1 rounded-lg hover:bg-[rgba(0,0,0,0.05)] text-[#273C46]/40 disabled:opacity-20" title="右移">
                            {movingIds.has(task.id) ? <LoaderCircle className="w-3.5 h-3.5 animate-spin" /> : <ChevronRight className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                        <button onClick={() => openEdit(task)} className="p-1 rounded-lg hover:bg-[rgba(0,0,0,0.05)] text-[#273C46]/40 hover:text-[#051A24]" title="编辑">
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                  <button onClick={() => openCreate(column.value)}
                    className="w-full py-2 rounded-xl border border-dashed border-[rgba(0,0,0,0.12)] text-xs text-[#273C46]/40 hover:text-[#051A24] hover:border-[#051A24]/30 transition-all">
                    + 添加任务
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <AdminModal open={modalOpen} title={editing ? '编辑任务' : '新建任务'} onClose={() => setModalOpen(false)} maxWidth="max-w-xl">
        <div className="space-y-4">
          <Field label="任务标题 *">
            <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="如：实现用户登录" />
          </Field>
          <Field label="描述">
            <Textarea rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="任务说明..." />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="状态">
              <Select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                {COLUMNS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </Select>
            </Field>
            <Field label="优先级">
              <Select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
                {['low', 'medium', 'high', 'urgent'].map(p => <option key={p} value={p}>{p}</option>)}
              </Select>
            </Field>
            <Field label="负责人">
              <Select value={form.assigneeId} onChange={e => setForm({ ...form, assigneeId: e.target.value })}>
                <option value="">未分配</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </Select>
            </Field>
            <Field label="里程碑">
              <Select value={form.milestoneId} onChange={e => setForm({ ...form, milestoneId: e.target.value })}>
                <option value="">无</option>
                {milestones.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </Select>
            </Field>
          </div>
          <Field label="截止日期">
            <Input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} />
          </Field>
          <button onClick={handleSave} disabled={saving}
            className="btn-primary w-full py-3 text-sm font-medium shadow-lg shadow-[#051A24]/10 disabled:opacity-50">
            {saving ? '保存中...' : (editing ? '保存修改' : '创建任务')}
          </button>
        </div>
      </AdminModal>
    </div>
  )
}
