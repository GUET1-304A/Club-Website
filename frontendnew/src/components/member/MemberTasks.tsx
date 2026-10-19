import { useState, useEffect, useCallback } from 'react'
import { Search, CheckSquare, Calendar, FolderGit2, ArrowRight, Filter } from 'lucide-react'
import MemberLayout from './MemberLayout'
import TagPill from '../ui/TagPill'
import { memberListTasks, memberUpdateTaskStatus, type MemberProfile, type TaskData } from '../../services/memberApi'
import { useToast } from '../admin/Toast'

const STATUS_TABS = [
  { value: '', label: '全部' },
  { value: 'todo', label: '待办' },
  { value: 'in_progress', label: '进行中' },
  { value: 'review', label: '待审核' },
  { value: 'done', label: '已完成' },
]

const PRIORITY: Record<string, { label: string; dot: string }> = {
  urgent: { label: '紧急', dot: 'bg-red-500' },
  high: { label: '高', dot: 'bg-orange-500' },
  medium: { label: '中', dot: 'bg-amber-500' },
  low: { label: '低', dot: 'bg-gray-300' },
}

export default function MemberTasks({ member }: { member: MemberProfile }) {
  const { toast } = useToast()
  const [tasks, setTasks] = useState<TaskData[]>([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const params: Record<string, string> = {}
    if (status) params.status = status
    const data = await memberListTasks(params).catch(() => [])
    // Client-side search filter
    const filtered = search
      ? data.filter((t: TaskData) => t.title.toLowerCase().includes(search.toLowerCase())
          || (t.projectName || '').toLowerCase().includes(search.toLowerCase()))
      : data
    setTasks(filtered)
    setLoading(false)
  }, [status, search])

  useEffect(() => { load() }, [load])

  const handleStatusChange = async (task: TaskData, newStatus: string) => {
    try {
      await memberUpdateTaskStatus(task.id, newStatus)
      toast('success', `任务状态已更新`)
      load()
    } catch (e: unknown) {
      toast('error', (e as Error).message)
    }
  }

  const statusCounts = () => ({
    todo: tasks.filter(t => t.status === 'todo').length,
    in_progress: tasks.filter(t => t.status === 'in_progress').length,
    review: tasks.filter(t => t.status === 'review').length,
    done: tasks.filter(t => t.status === 'done').length,
  })

  const counts = statusCounts()

  return (
    <MemberLayout member={member}>
      <div className="animate-fade-in-up">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-[28px] font-medium text-[#051A24] tracking-tight"
              style={{ fontFamily: "var(--font-sans)", fontWeight: 500 }}>
              我的任务
            </h1>
            <p className="text-sm text-[#273C46]/50 mt-1">
              {tasks.length} 个任务
              {counts.todo > 0 && ` · ${counts.todo} 待办`}
              {counts.in_progress > 0 && ` · ${counts.in_progress} 进行中`}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#273C46]/25" />
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="搜索任务..."
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-[rgba(0,0,0,0.06)] bg-white text-sm text-[#051A24]
                placeholder:text-[#273C46]/30 focus:outline-none focus:border-[#051A24]/30 focus:ring-2 focus:ring-[#051A24]/5 transition-all"
            />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {STATUS_TABS.map(s => (
              <TagPill key={s.value} label={s.label} active={status === s.value} onClick={() => setStatus(s.value)} />
            ))}
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="card p-4 animate-pulse flex items-center gap-4" style={{ borderRadius: 20 }}>
                <div className="w-5 h-5 rounded bg-[#f0ece6]" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-48 bg-[#f0ece6] rounded-lg" />
                  <div className="h-3 w-32 bg-[#f0ece6] rounded-md" />
                </div>
              </div>
            ))}
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#f0ece6] flex items-center justify-center mb-4">
              <CheckSquare className="w-7 h-7 text-[#273C46]/20" />
            </div>
            <p className="text-sm text-[#273C46]/50">
              {status ? '没有该状态的任务' : '暂无待办任务'}
            </p>
            {!status && (
              <a href="/member/projects" className="btn-secondary text-xs px-4 py-2 mt-4">
                去项目看看
              </a>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {tasks.map(task => {
              const p = PRIORITY[task.priority] || PRIORITY.medium
              return (
                <div
                  key={task.id}
                  className="card p-4 flex items-center gap-4 group hover:bg-[#fcfbfa] transition-all"
                  style={{ borderRadius: 20 }}
                >
                  {/* Status checkbox */}
                  <button
                    onClick={() => handleStatusChange(task, task.status === 'done' ? 'todo' : 'done')}
                    className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all
                      ${task.status === 'done'
                        ? 'bg-emerald-500 border-emerald-500 text-white'
                        : 'border-[rgba(0,0,0,0.15)] hover:border-emerald-400'
                      }`}
                  >
                    {task.status === 'done' && (
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${p.dot}`} title={p.label} />
                      <span className={`text-sm ${task.status === 'done' ? 'text-[#273C46]/40 line-through' : 'text-[#051A24] font-medium'}`}>
                        {task.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 text-[11px] text-[#273C46]/40">
                      {task.projectName && (
                        <span className="flex items-center gap-1">
                          <FolderGit2 className="w-3 h-3" />
                          {task.projectName}
                        </span>
                      )}
                      {task.milestoneName && (
                        <span className="flex items-center gap-1">
                          <Filter className="w-3 h-3" />
                          {task.milestoneName}
                        </span>
                      )}
                      {task.dueDate && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(task.dueDate).toLocaleDateString('zh-CN')}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {task.status !== 'done' && (
                      <select
                        value={task.status}
                        onChange={e => handleStatusChange(task, e.target.value)}
                        className="text-[10px] border border-[rgba(0,0,0,0.08)] rounded-lg px-2 py-1.5 bg-white text-[#273C46]
                          focus:outline-none focus:border-[#051A24]/30 cursor-pointer"
                      >
                        <option value="todo">待办</option>
                        <option value="in_progress">进行中</option>
                        <option value="review">待审核</option>
                        <option value="done">已完成</option>
                      </select>
                    )}
                    {task.project_id && (
                      <a href={`/member/projects/${task.project_id}`}
                        className="p-1.5 rounded-lg text-[#273C46]/20 hover:text-[#051A24] hover:bg-[rgba(0,0,0,0.03)] transition-all"
                        title="打开项目看板">
                        <ArrowRight className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </MemberLayout>
  )
}
