import { useState, useEffect, useCallback } from 'react'
import {
  ArrowLeft, Save, LoaderCircle, LayoutDashboard, KanbanSquare, Flag, FileText, Bell, BarChart3, ExternalLink,
} from 'lucide-react'
import AdminLayout from './AdminLayout'
import { Field, Input, Select, Textarea } from './AdminModal'
import AdminProjectKanban from './AdminProjectKanban'
import AdminProjectMilestones from './AdminProjectMilestones'
import AdminProjectReminders from './AdminProjectReminders'
import {
  adminGetProject, adminUpdateProject, adminProjectHealth,
  adminListWeeklyReports,
  type AdminProject, type AdminProjectHealth, type AdminWeeklyReport,
} from '../../services/adminApi'
import { useToast } from './Toast'

const STATUSES = [
  { value: 'planning', label: '规划中' },
  { value: 'active', label: '进行中' },
  { value: 'completed', label: '已完成' },
  { value: 'archived', label: '已归档' },
]

const CATS = [
  { value: 'web', label: 'Web 应用' },
  { value: 'miniapp', label: '小程序' },
  { value: 'ai', label: 'AI/算法' },
  { value: 'tools', label: '工具库' },
  { value: 'game', label: '游戏' },
]

const STATUS_LABELS: Record<string, string> = {
  todo: '待办',
  in_progress: '进行中',
  review: '待审核',
  done: '已完成',
  blocked: '已阻塞',
}

const TABS = [
  { value: 'overview', label: '概览', icon: LayoutDashboard },
  { value: 'kanban', label: '任务看板', icon: KanbanSquare },
  { value: 'milestones', label: '里程碑', icon: Flag },
  { value: 'reports', label: '周报', icon: FileText },
  { value: 'reminders', label: '提醒', icon: Bell },
  { value: 'stats', label: '统计', icon: BarChart3 },
]

export default function AdminProjectDetail({ projectId }: { projectId: number }) {
  const { toast } = useToast()
  const [project, setProject] = useState<AdminProject | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('overview')
  const [saving, setSaving] = useState(false)
  const [reports, setReports] = useState<AdminWeeklyReport[]>([])
  const [health, setHealth] = useState<AdminProjectHealth | null>(null)
  const [form, setForm] = useState({
    name: '', status: 'active', category: 'web', startDate: '', endDate: '',
    description: '', githubUrl: '', demoUrl: '',
  })

  const loadProject = useCallback(async () => {
    setLoading(true)
    const data = await adminGetProject(projectId).catch(() => null)
    if (data) {
      setProject(data)
      setForm({
        name: data.name || '',
        status: data.status || 'active',
        category: data.category || 'web',
        startDate: data.startDate || '',
        endDate: data.endDate || '',
        description: data.description || '',
        githubUrl: data.githubUrl || '',
        demoUrl: data.demoUrl || '',
      })
    }
    setLoading(false)
  }, [projectId])

  useEffect(() => { loadProject() }, [loadProject])

  useEffect(() => {
    if (tab === 'reports') {
      adminListWeeklyReports({ projectId: String(projectId) }).then(setReports).catch(() => setReports([]))
    }
    if (tab === 'stats') {
      adminProjectHealth(projectId).then(setHealth).catch(() => setHealth(null))
    }
  }, [tab, projectId])

  const handleSave = async () => {
    if (!form.name.trim()) { toast('warning', '项目名称不能为空'); return }
    setSaving(true)
    try {
      const { project: updated } = await adminUpdateProject(projectId, {
        name: form.name.trim(),
        status: form.status,
        category: form.category,
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
        description: form.description || undefined,
        githubUrl: form.githubUrl || undefined,
        demoUrl: form.demoUrl || undefined,
      })
      setProject(updated)
      toast('success', '项目信息已保存')
    } catch (error: unknown) {
      toast('error', (error as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <AdminLayout>
      <div className="animate-fade-in-up">
        <a href="/admin/projects" className="inline-flex items-center gap-1.5 text-xs text-[#273C46]/50 hover:text-[#051A24] transition-colors mb-4">
          <ArrowLeft className="w-3.5 h-3.5" /> 返回项目列表
        </a>

        {loading ? (
          <div className="card p-6 animate-pulse" style={{ borderRadius: 24 }}>
            <div className="h-6 w-1/3 bg-[#f0ece6] rounded-lg mb-4" />
            <div className="h-4 w-2/3 bg-[#f0ece6] rounded-md" />
          </div>
        ) : !project ? (
          <div className="flex flex-col items-center py-20 text-center">
            <p className="text-sm text-[#273C46]/50">项目不存在或已被删除</p>
            <a href="/admin/projects" className="btn-secondary text-xs px-4 py-2 mt-4">返回项目列表</a>
          </div>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
              <div>
                <h1 className="text-[28px] font-medium text-[#051A24] tracking-tight"
                  style={{ fontFamily: "var(--font-sans)", fontWeight: 500 }}>
                  {project.name}
                </h1>
                <p className="text-sm text-[#273C46]/50 mt-1">
                  #{project.id} · {STATUSES.find(s => s.value === project.status)?.label || project.status}
                  {project.ownerName ? ` · 负责人 ${project.ownerName}` : ''}
                </p>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1.5 flex-wrap mb-6">
              {TABS.map(item => {
                const Icon = item.icon
                return (
                  <button
                    key={item.value}
                    onClick={() => setTab(item.value)}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-medium transition-all
                      ${tab === item.value
                        ? 'admin-glass-nav-active text-[#051A24]'
                        : 'bg-white text-[#273C46]/60 border border-[rgba(0,0,0,0.06)] hover:text-[#051A24]'}`}
                  >
                    <Icon className="w-3.5 h-3.5" /> {item.label}
                  </button>
                )
              })}
            </div>

            {tab === 'overview' && (
              <div className="card p-6" style={{ borderRadius: 24 }}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="项目名称 *">
                    <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                  </Field>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="状态">
                      <Select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                        {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </Select>
                    </Field>
                    <Field label="分类">
                      <Select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                        {CATS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </Select>
                    </Field>
                  </div>
                  <Field label="开始日期">
                    <Input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} />
                  </Field>
                  <Field label="结束日期">
                    <Input type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} />
                  </Field>
                  <Field label="GitHub 地址">
                    <Input value={form.githubUrl} onChange={e => setForm({ ...form, githubUrl: e.target.value })} placeholder="https://github.com/..." />
                  </Field>
                  <Field label="演示地址">
                    <Input value={form.demoUrl} onChange={e => setForm({ ...form, demoUrl: e.target.value })} placeholder="https://..." />
                  </Field>
                </div>
                <div className="mt-4">
                  <Field label="描述">
                    <Textarea rows={4} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                  </Field>
                </div>
                <div className="flex items-center gap-3 mt-5">
                  <button onClick={handleSave} disabled={saving}
                    className="btn-primary text-sm px-6 py-2.5 inline-flex items-center gap-2 shadow-lg shadow-[#051A24]/10 disabled:opacity-50">
                    {saving ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} 保存修改
                  </button>
                  {project.slug && (
                    <a href={`/project/${project.slug}`} target="_blank" rel="noreferrer"
                      className="btn-secondary text-sm px-5 py-2.5 inline-flex items-center gap-2">
                      <ExternalLink className="w-4 h-4" /> 查看前台
                    </a>
                  )}
                </div>
              </div>
            )}

            {tab === 'kanban' && <AdminProjectKanban projectId={projectId} />}
            {tab === 'milestones' && <AdminProjectMilestones projectId={projectId} />}
            {tab === 'reminders' && <AdminProjectReminders projectId={projectId} />}

            {tab === 'reports' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-[#273C46]/50">{reports.length} 份周报</p>
                  <a href="/admin/weekly-reports" className="text-xs text-[#273C46]/60 hover:text-[#051A24] inline-flex items-center gap-1">
                    前往周报审阅 <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                {reports.length === 0 ? (
                  <div className="flex flex-col items-center py-14 text-center">
                    <FileText className="w-8 h-8 text-[#273C46]/15 mb-3" />
                    <p className="text-sm text-[#273C46]/50">该项目暂无周报</p>
                  </div>
                ) : (
                  reports.map(report => (
                    <div key={report.id} className="card p-4 flex items-center gap-4" style={{ borderRadius: 18 }}>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#051A24] line-clamp-1">{report.memberName || '-'}</p>
                        <p className="text-xs text-[#273C46]/50 mt-0.5 line-clamp-1">
                          {report.weekStart || '-'} ~ {report.weekEnd || '-'} · {(report.content || {}).done || '（未填写内容）'}
                        </p>
                      </div>
                      <span className={`text-[10px] font-medium rounded-full px-2.5 py-1 shrink-0
                        ${report.status === 'reviewed' ? 'bg-emerald-50 text-emerald-700' : report.status === 'submitted' ? 'bg-amber-50 text-amber-700' : 'bg-[#f0ece6] text-[#273C46]/60'}`}>
                        {report.status === 'reviewed' ? '已审阅' : report.status === 'submitted' ? '待审阅' : '草稿'}
                      </span>
                      {report.completionRate != null && (
                        <span className="text-xs text-[#273C46]/50 shrink-0">完成度 {report.completionRate}</span>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {tab === 'stats' && (
              <StatsView health={health} />
            )}
          </>
        )}
      </div>
    </AdminLayout>
  )
}

function StatsView({ health }: { health: AdminProjectHealth | null }) {
  if (!health) {
    return (
      <div className="flex flex-col items-center py-16 text-center">
        <LoaderCircle className="w-6 h-6 text-[#273C46]/30 animate-spin mb-3" />
        <p className="text-sm text-[#273C46]/50">加载统计中...</p>
      </div>
    )
  }
  const maxStatus = Math.max(1, ...Object.values(health.byStatus))
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="任务完成率" value={`${health.completionRate}%`} accent="text-emerald-600" />
        <StatCard label="任务总数" value={`${health.taskDone}/${health.taskTotal}`} />
        <StatCard label="逾期任务" value={String(health.overdueTaskCount)} accent={health.overdueTaskCount > 0 ? 'text-red-500' : ''} />
        <StatCard label="里程碑进度" value={`${health.milestonesDone}/${health.milestoneCount}`} />
      </div>

      {health.nextDeadline && (
        <p className="text-xs text-[#273C46]/50">最近截止：{health.nextDeadline.slice(0, 10)}</p>
      )}

      <div className="card p-5" style={{ borderRadius: 22 }}>
        <p className="text-xs font-medium text-[#273C46]/60 mb-3">任务状态分布</p>
        <div className="space-y-2.5">
          {Object.entries(health.byStatus).map(([status, count]) => (
            <div key={status} className="flex items-center gap-3">
              <span className="w-16 text-xs text-[#273C46]/60 shrink-0">{STATUS_LABELS[status] || status}</span>
              <div className="flex-1 h-2 rounded-full bg-[#f0ece6] overflow-hidden">
                <div className="h-full rounded-full bg-[#051A24] transition-all" style={{ width: `${count / maxStatus * 100}%` }} />
              </div>
              <span className="w-6 text-xs text-[#273C46]/50 text-right">{count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-5" style={{ borderRadius: 22 }}>
          <p className="text-xs font-medium text-[#273C46]/60 mb-3">成员负载（待办任务数）</p>
          {health.memberWorkload.length === 0 ? (
            <p className="text-xs text-[#273C46]/40">暂无未完成任务</p>
          ) : (
            <div className="space-y-2">
              {health.memberWorkload.map(item => (
                <div key={item.memberId} className="flex items-center justify-between text-xs">
                  <span className="text-[#051A24]">{item.name || `成员 #${item.memberId}`}</span>
                  <span className="text-[#273C46]/60">{item.pendingTasks} 项</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="card p-5" style={{ borderRadius: 22 }}>
          <p className="text-xs font-medium text-[#273C46]/60 mb-3">逾期任务</p>
          {health.overdueTasks.length === 0 ? (
            <p className="text-xs text-[#273C46]/40">没有逾期任务 🎉</p>
          ) : (
            <div className="space-y-2">
              {health.overdueTasks.map(task => (
                <div key={task.id} className="text-xs">
                  <p className="text-[#051A24]">{task.title}</p>
                  <p className="text-[#273C46]/50 mt-0.5">
                    {task.dueDate?.slice(0, 10) || '-'}{task.assigneeName ? ` · ${task.assigneeName}` : ''}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, accent = '' }: { label: string; value: string; accent?: string }) {
  return (
    <div className="card p-4" style={{ borderRadius: 20 }}>
      <p className="text-[10px] font-medium text-[#273C46]/40 uppercase tracking-wider">{label}</p>
      <p className={`text-xl font-semibold mt-1.5 ${accent || 'text-[#051A24]'}`}>{value}</p>
    </div>
  )
}
