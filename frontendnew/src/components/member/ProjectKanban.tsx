import { useState, useEffect, useCallback, useRef } from 'react'
import {
  ArrowLeft, Plus, Calendar, User, Flag,
  GitBranch, Globe, X,
} from 'lucide-react'
import GithubIcon from '../ui/GithubIcon'
import MemberLayout from './MemberLayout'
import {
  memberGetProject, memberCreateTask, memberUpdateTaskStatus,
  type MemberProfile, type ProjectDetail, type TaskData,
} from '../../services/memberApi'
import { useToast } from '../admin/Toast'

/* ─── Constants ─── */

const COLUMNS = [
  { key: 'todo', label: '待办', color: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400' },
  { key: 'in_progress', label: '进行中', color: 'bg-amber-50 text-amber-700', dot: 'bg-amber-500' },
  { key: 'review', label: '待审核', color: 'bg-blue-50 text-blue-700', dot: 'bg-blue-500' },
  { key: 'done', label: '已完成', color: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
]

const PRIORITY: Record<string, { label: string; dot: string }> = {
  urgent: { label: '紧急', dot: 'bg-red-500' },
  high: { label: '高', dot: 'bg-orange-500' },
  medium: { label: '中', dot: 'bg-amber-500' },
  low: { label: '低', dot: 'bg-gray-300' },
}

const MILESTONE_STATUS: Record<string, { label: string; cls: string; dot: string }> = {
  completed: { label: '已完成', cls: 'text-emerald-600', dot: 'bg-emerald-500' },
  in_progress: { label: '进行中', cls: 'text-amber-600', dot: 'bg-amber-500' },
  pending: { label: '待开始', cls: 'text-gray-400', dot: 'bg-gray-300' },
}

/* ─── Props ─── */

interface Props {
  member: MemberProfile
  projectId: number
}

/* ─── Helpers ─── */

function cn(...args: (string | false | undefined | null)[]) {
  return args.filter(Boolean).join(' ')
}

/* ═══════════════════════════════════════════════════════════════ */

export default function ProjectKanban({ member, projectId }: Props) {
  const { toast } = useToast()
  const [data, setData] = useState<ProjectDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'kanban' | 'milestones'>('kanban')
  const [dragOverCol, setDragOverCol] = useState<string | null>(null)
  const [showNewTask, setShowNewTask] = useState<string | null>(null) // column key
  const [newTitle, setNewTitle] = useState('')
  const dragTask = useRef<TaskData | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const d = await memberGetProject(projectId).catch(() => null)
    setData(d)
    setLoading(false)
  }, [projectId])

  useEffect(() => { load() }, [load])

  const tasksByCol = (col: string) => (data?.tasks || []).filter(t => t.status === col)

  /* ── Drag & Drop ── */
  const handleDragStart = (task: TaskData) => {
    dragTask.current = task
  }

  const handleDragOver = (e: React.DragEvent, col: string) => {
    e.preventDefault()
    setDragOverCol(col)
  }

  const handleDragLeave = () => setDragOverCol(null)

  const handleDrop = async (col: string) => {
    setDragOverCol(null)
    const task = dragTask.current
    if (!task || task.status === col) return
    try {
      await memberUpdateTaskStatus(task.id, col)
      toast('success', `任务已移至「${COLUMNS.find(c => c.key === col)?.label}」`)
      load()
    } catch (e: unknown) {
      toast('error', (e as Error).message)
    }
  }

  /* ── Quick-create task ── */
  const handleQuickCreate = async (col: string) => {
    if (!newTitle.trim()) { setShowNewTask(null); return }
    try {
      await memberCreateTask(projectId, { title: newTitle.trim(), status: col, assigneeId: member.id })
      toast('success', '任务已创建')
      setNewTitle('')
      setShowNewTask(null)
      load()
    } catch (e: unknown) {
      toast('error', (e as Error).message)
    }
  }

  /* ── Loading ── */
  if (loading) {
    return (
      <MemberLayout member={member}>
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 bg-[#f0ece6] rounded-lg" />
          <div className="grid grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-[#fcfbfa] rounded-2xl p-4 space-y-3">
                <div className="h-5 w-16 bg-[#f0ece6] rounded-full" />
                {Array.from({ length: 3 }).map((_, j) => (
                  <div key={j} className="h-24 bg-[#f0ece6] rounded-xl" />
                ))}
              </div>
            ))}
          </div>
        </div>
      </MemberLayout>
    )
  }

  if (!data) {
    return (
      <MemberLayout member={member}>
        <div className="flex flex-col items-center py-20">
          <p className="text-sm text-[#273C46]/50">项目未找到</p>
          <a href="/member/projects" className="btn-secondary text-xs mt-4">返回项目列表</a>
        </div>
      </MemberLayout>
    )
  }

  const { project } = data

  return (
    <MemberLayout member={member}>
      <div className="animate-fade-in-up">
        {/* Header */}
        <div className="mb-6">
          <a href="/member/projects" className="inline-flex items-center gap-1.5 text-xs text-[#273C46]/50 hover:text-[#051A24] transition-colors mb-3">
            <ArrowLeft className="w-3.5 h-3.5" /> 返回项目列表
          </a>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-[28px] font-medium text-[#051A24] tracking-tight"
                style={{ fontFamily: "'PP Neue Montreal', 'Noto Sans SC', sans-serif", fontWeight: 500 }}>
                {project.name}
              </h1>
              <div className="flex items-center gap-3 mt-2 text-xs text-[#273C46]/50">
                {project.category && <span className="bg-[#f0ece6] rounded-full px-2 py-0.5">{project.category}</span>}
                {project.ownerName && <span><User className="w-3 h-3 inline mr-0.5" />{project.ownerName}</span>}
                {project.taskCount != null && <span>{project.taskDoneCount}/{project.taskCount} 任务完成</span>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {project.githubUrl && (
                <a href={project.githubUrl} target="_blank" rel="noreferrer"
                  className="btn-secondary text-xs px-3 py-2 flex items-center gap-1.5">
                  <GithubIcon className="w-3.5 h-3.5" /> GitHub
                </a>
              )}
              {project.demoUrl && (
                <a href={project.demoUrl} target="_blank" rel="noreferrer"
                  className="btn-secondary text-xs px-3 py-2 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5" /> Demo
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex items-center gap-1 mb-6 bg-white rounded-2xl p-1 border border-[rgba(0,0,0,0.04)] w-fit">
          {[
            { key: 'kanban' as const, label: '看板', icon: Flag },
            { key: 'milestones' as const, label: '里程碑', icon: GitBranch },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all',
                tab === t.key
                  ? 'bg-[#051A24] text-white shadow-sm shadow-[#051A24]/10'
                  : 'text-[#273C46]/60 hover:text-[#051A24] hover:bg-[rgba(0,0,0,0.02)]',
              )}>
              <t.icon className="w-4 h-4" strokeWidth={1.5} />
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Kanban ── */}
        {tab === 'kanban' && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {COLUMNS.map(col => {
              const tasks = tasksByCol(col.key)
              return (
                <div
                  key={col.key}
                  onDragOver={e => handleDragOver(e, col.key)}
                  onDragLeave={handleDragLeave}
                  onDrop={() => handleDrop(col.key)}
                  className={cn(
                    'rounded-2xl p-3 flex flex-col min-h-[200px] transition-colors',
                    dragOverCol === col.key ? 'bg-[#051A24]/[0.02] ring-2 ring-[#051A24]/10' : 'bg-[#fcfbfa]',
                  )}
                >
                  {/* Column header */}
                  <div className="flex items-center justify-between mb-3 px-1">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${col.dot}`} />
                      <span className="text-xs font-semibold text-[#273C46]/70">{col.label}</span>
                      <span className="text-[10px] text-[#273C46]/30 font-medium">{tasks.length}</span>
                    </div>
                    <button
                      onClick={() => setShowNewTask(showNewTask === col.key ? null : col.key)}
                      className="p-1 rounded-lg hover:bg-[rgba(0,0,0,0.04)] text-[#273C46]/30 hover:text-[#051A24] transition-all"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Task cards */}
                  <div className="space-y-2 flex-1">
                    {tasks.map(task => (
                      <div
                        key={task.id}
                        draggable
                        onDragStart={() => handleDragStart(task)}
                        className="bg-white rounded-xl p-3 border border-[rgba(0,0,0,0.04)] shadow-sm
                          cursor-grab active:cursor-grabbing active:shadow-md hover:shadow-md hover:border-[rgba(0,0,0,0.08)]
                          transition-all group"
                      >
                        {/* Priority dot + title */}
                        <div className="flex items-start gap-2">
                          <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${PRIORITY[task.priority]?.dot || PRIORITY.medium.dot}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-[#051A24] leading-snug">{task.title}</p>
                            {task.description && (
                              <p className="text-[11px] text-[#273C46]/40 mt-1 line-clamp-2">{task.description}</p>
                            )}
                          </div>
                        </div>

                        {/* Meta */}
                        <div className="flex items-center justify-between mt-3 pt-2 border-t border-[rgba(0,0,0,0.03)]">
                          <div className="flex items-center gap-2 text-[10px] text-[#273C46]/40">
                            {task.assigneeName && (
                              <span className="flex items-center gap-1">
                                <div className="w-4 h-4 rounded-full bg-[#f0ece6] flex items-center justify-center text-[8px] font-semibold text-[#273C46]/40">
                                  {task.assigneeName[0]}
                                </div>
                                {task.assigneeName}
                              </span>
                            )}
                            {task.dueDate && (
                              <span className="flex items-center gap-0.5">
                                <Calendar className="w-3 h-3" />
                                {new Date(task.dueDate).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Empty state */}
                    {tasks.length === 0 && (
                      <div className="text-center py-8 text-[10px] text-[#273C46]/25">
                        拖拽任务到此处
                      </div>
                    )}
                  </div>

                  {/* Quick-create input */}
                  {showNewTask === col.key && (
                    <div className="mt-2 bg-white rounded-xl border border-[rgba(0,0,0,0.06)] p-2 shadow-sm">
                      <input
                        autoFocus
                        type="text"
                        value={newTitle}
                        onChange={e => setNewTitle(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleQuickCreate(col.key); if (e.key === 'Escape') setShowNewTask(null) }}
                        placeholder="输入任务标题..."
                        className="w-full text-xs px-2 py-1.5 rounded-lg border border-[rgba(0,0,0,0.04)] bg-[#fcfbfa]
                          text-[#051A24] placeholder:text-[#273C46]/30
                          focus:outline-none focus:border-[#051A24]/20"
                      />
                      <div className="flex items-center gap-1.5 mt-2">
                        <button onClick={() => handleQuickCreate(col.key)}
                          className="text-[10px] bg-[#051A24] text-white rounded-lg px-3 py-1.5 font-medium">
                          添加
                        </button>
                        <button onClick={() => { setShowNewTask(null); setNewTitle('') }}
                          className="text-[10px] text-[#273C46]/40 hover:text-[#051A24] rounded-lg px-2 py-1.5">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ── Milestones ── */}
        {tab === 'milestones' && (
          <div className="card p-6" style={{ borderRadius: 24 }}>
            {data.milestones.length === 0 ? (
              <div className="text-center py-12 text-sm text-[#273C46]/40">暂无里程碑</div>
            ) : (
              <div className="relative pl-8">
                {/* Timeline line */}
                <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-[#f0ece6]" />

                <div className="space-y-6">
                  {data.milestones.map(m => {
                    const st = MILESTONE_STATUS[m.status] || MILESTONE_STATUS.pending
                    return (
                      <div key={m.id} className="relative">
                        {/* Dot */}
                        <div className={`absolute -left-[21px] top-1.5 w-3 h-3 rounded-full border-2 border-white ${st.dot} ring-2 ring-white`} />
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="text-sm font-semibold text-[#051A24]">{m.name}</h4>
                            <span className={`text-[10px] font-medium ${st.cls}`}>{st.label}</span>
                          </div>
                          {m.description && (
                            <p className="text-xs text-[#273C46]/50 mb-2">{m.description}</p>
                          )}
                          <div className="flex items-center gap-3 text-[10px] text-[#273C46]/40">
                            {m.dueDate && <span>截止: {new Date(m.dueDate).toLocaleDateString('zh-CN')}</span>}
                            {m.taskCount != null && <span>{m.taskDoneCount}/{m.taskCount} 任务</span>}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </MemberLayout>
  )
}
