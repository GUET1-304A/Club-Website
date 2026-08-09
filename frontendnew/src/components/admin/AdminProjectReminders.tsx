import { useState, useEffect, useCallback } from 'react'
import { Plus, LoaderCircle, Bell, User, Calendar } from 'lucide-react'
import AdminModal, { Field, Input, Select, Textarea } from './AdminModal'
import {
  adminListReminders, adminCreateReminder, adminListMembers,
  type AdminReminder, type AdminMember,
} from '../../services/adminApi'
import { useToast } from './Toast'

const TYPES = [
  { value: 'task_due', label: '任务截止' },
  { value: 'report_submit', label: '周报提交' },
  { value: 'review', label: '审阅提醒' },
  { value: 'custom', label: '自定义' },
]

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  pending: { label: '待触发', cls: 'bg-amber-50 text-amber-700' },
  sent: { label: '已发送', cls: 'bg-blue-50 text-blue-600' },
  done: { label: '已完成', cls: 'bg-emerald-50 text-emerald-700' },
  cancelled: { label: '已取消', cls: 'bg-[#f0ece6] text-[#273C46]/60' },
}

export default function AdminProjectReminders({ projectId }: { projectId: number }) {
  const { toast } = useToast()
  const [reminders, setReminders] = useState<AdminReminder[]>([])
  const [members, setMembers] = useState<AdminMember[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ memberId: '', title: '', message: '', type: 'custom', scheduledAt: '' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [reminderData, memberData] = await Promise.all([
      adminListReminders().catch(() => []),
      adminListMembers().catch(() => []),
    ])
    setReminders(reminderData.filter(r => r.projectId === projectId))
    setMembers(memberData)
    setLoading(false)
  }, [projectId])

  useEffect(() => { load() }, [load])

  const handleSave = async () => {
    if (!form.memberId) { toast('warning', '请选择提醒对象'); return }
    if (!form.title.trim()) { toast('warning', '请填写提醒标题'); return }
    setSaving(true)
    try {
      await adminCreateReminder({
        memberId: Number(form.memberId),
        projectId,
        title: form.title.trim(),
        message: form.message.trim() || undefined,
        type: form.type,
        scheduledAt: form.scheduledAt || undefined,
      })
      toast('success', '提醒已创建')
      setModalOpen(false)
      setForm({ memberId: '', title: '', message: '', type: 'custom', scheduledAt: '' })
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
        <p className="text-sm text-[#273C46]/50">{reminders.length} 条提醒</p>
        <button onClick={() => setModalOpen(true)}
          className="btn-primary text-xs px-4 py-2 inline-flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" /> 新建提醒
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card p-5 animate-pulse" style={{ borderRadius: 20 }}>
              <div className="h-4 w-48 bg-[#f0ece6] rounded-md mb-3" />
              <div className="h-3 w-2/3 bg-[#f0ece6] rounded-md" />
            </div>
          ))}
        </div>
      ) : reminders.length === 0 ? (
        <div className="flex flex-col items-center py-14 text-center">
          <Bell className="w-8 h-8 text-[#273C46]/15 mb-3" />
          <p className="text-sm text-[#273C46]/50">暂无提醒</p>
          <p className="text-xs text-[#273C46]/30 mt-1">为项目成员创建任务截止/周报提交提醒</p>
        </div>
      ) : (
        <div className="space-y-2">
          {reminders.map(reminder => {
            const st = STATUS_MAP[reminder.status] || STATUS_MAP.pending
            return (
              <div key={reminder.id} className="card p-4 flex items-center gap-4" style={{ borderRadius: 18 }}>
                <div className="w-9 h-9 rounded-xl bg-[#f0ece6] flex items-center justify-center shrink-0">
                  <Bell className="w-4 h-4 text-[#273C46]/40" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#051A24]">{reminder.title}</p>
                  <div className="flex items-center gap-3 mt-1 text-[11px] text-[#273C46]/50 flex-wrap">
                    <span className="flex items-center gap-1"><User className="w-3 h-3" /> {reminder.memberName || '-'}</span>
                    {reminder.scheduledAt && (
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {reminder.scheduledAt.slice(0, 16).replace('T', ' ')}</span>
                    )}
                    {reminder.message && <span className="text-[#273C46]/40 truncate max-w-[280px]">{reminder.message}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] font-medium rounded-full px-2 py-0.5 bg-[#f7f5f1] text-[#273C46]/50">
                    {TYPES.find(t => t.value === reminder.type)?.label || reminder.type}
                  </span>
                  <span className={`text-[10px] font-medium rounded-full px-2 py-0.5 ${st.cls}`}>{st.label}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <AdminModal open={modalOpen} title="新建提醒" onClose={() => setModalOpen(false)} maxWidth="max-w-lg">
        <div className="space-y-4">
          <Field label="提醒对象 *">
            <Select value={form.memberId} onChange={e => setForm({ ...form, memberId: e.target.value })}>
              <option value="">选择成员</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </Select>
          </Field>
          <Field label="标题 *">
            <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="如：请提交本周周报" />
          </Field>
          <Field label="内容">
            <Textarea rows={2} value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} placeholder="提醒内容..." />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="类型">
              <Select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </Select>
            </Field>
            <Field label="触发时间（可留空=立即）">
              <Input type="datetime-local" value={form.scheduledAt} onChange={e => setForm({ ...form, scheduledAt: e.target.value })} />
            </Field>
          </div>
          <button onClick={handleSave} disabled={saving}
            className="btn-primary w-full py-3 text-sm font-medium shadow-lg shadow-[#051A24]/10 disabled:opacity-50">
            {saving ? <LoaderCircle className="w-4 h-4 mx-auto animate-spin" /> : '创建提醒'}
          </button>
        </div>
      </AdminModal>
    </div>
  )
}
