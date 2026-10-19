import { memo, useState, useEffect, useRef, type FormEvent, type ReactNode } from 'react'
import {
  Bot, Send, Sparkles, Loader2, Calendar, CheckSquare, AlertTriangle,
  Lightbulb, FileText, Wand2, Plus, ArrowRight, MessageSquare, Rocket, Check,
  CircleAlert, ChevronRight, Trash2, Pencil, Copy, Bell, Clock,
} from 'lucide-react'
import MemberLayout from './MemberLayout'
import Markdown from '../ui/Markdown'
import {
  assistantChatStream, assistantParseRequirementStream, assistantApplyPlan, assistantStatus,
  listConversations, getConversation, renameConversation, deleteConversation,
  memberListWeeklyReports, memberCreateWeeklyReport, memberSubmitWeeklyReport,
  memberAnalyzeWeeklyReport, memberDeleteWeeklyReport,
  memberListReminders, memberCreateReminder, memberCompleteReminder, memberDeleteReminder,
  type MemberProfile, type AssistantStatus, type RequirementPlan,
  type WeeklyReportData, type ConversationData, type ReminderData,
} from '../../services/memberApi'
import { fetchSiteConfig, type WeeklyReportTemplate } from '../../services/api'

type Tab = 'chat' | 'plan' | 'report' | 'reminder'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  toolCalls?: { name: string; ok?: boolean; running?: boolean }[]
}

const SUGGESTIONS = [
  '列出我的任务',
  '统计一下项目进度',
  '帮我创建一条周五交周报的提醒',
  '查看我的周报',
]

const STATUS_META: Record<string, { label: string; className: string }> = {
  draft: { label: '草稿', className: 'bg-[#f0ece6] text-[#273C46]' },
  submitted: { label: '已提交', className: 'bg-blue-50 text-blue-600' },
  reviewed: { label: '已审阅', className: 'bg-emerald-50 text-emerald-600' },
}

const DEFAULT_WEEKLY_TEMPLATE: Required<WeeklyReportTemplate> = {
  title: '周报模板',
  fields: [
    { key: 'done', label: '本周完成', required: true, placeholder: '本周完成了哪些工作？', rows: 3 },
    { key: 'plan', label: '下周计划', required: false, placeholder: '下周计划做什么？', rows: 2 },
    { key: 'issues', label: '遇到的问题', required: false, placeholder: '遇到的问题、风险或需要帮助的地方（可选）', rows: 2 },
    { key: 'summary', label: '一句话总结', required: false, placeholder: '本周整体进展的一句话总结', rows: 2 },
  ],
}

function normalizeWeeklyTemplate(template?: WeeklyReportTemplate): Required<WeeklyReportTemplate> {
  const sourceFields = Array.isArray(template?.fields) && template.fields.length > 0
    ? template.fields
    : DEFAULT_WEEKLY_TEMPLATE.fields
  const fields = sourceFields
    .filter(field => field.key && field.label)
    .map(field => ({
      key: field.key,
      label: field.label,
      required: !!field.required,
      placeholder: field.placeholder || '',
      rows: Math.max(1, Math.min(6, Number(field.rows || 2))),
    }))
  return {
    title: template?.title || DEFAULT_WEEKLY_TEMPLATE.title,
    fields: fields.length ? fields : DEFAULT_WEEKLY_TEMPLATE.fields,
  }
}

function emptyWeeklyContent(template: WeeklyReportTemplate): Record<string, string> {
  return (template.fields || []).reduce<Record<string, string>>((acc, field) => {
    acc[field.key] = ''
    return acc
  }, {})
}

function reportContentRows(content: Record<string, string | undefined>, template: WeeklyReportTemplate) {
  const used = new Set<string>()
  const rows: { key: string; label: string; value: string }[] = []
  ;(template.fields || []).forEach(field => {
    const value = String(content[field.key] || '').trim()
    used.add(field.key)
    if (value) rows.push({ key: field.key, label: field.label, value })
  })
  Object.entries(content).forEach(([key, raw]) => {
    if (used.has(key)) return
    const value = String(raw || '').trim()
    if (value) rows.push({ key, label: key, value })
  })
  return rows
}

export default function AssistantChat({ member }: { member: MemberProfile }) {
  const [tab, setTab] = useState<Tab>('chat')

  return (
    <MemberLayout member={member}>
      <div className="animate-fade-in-up">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-[28px] font-medium text-[#051A24] tracking-tight"
              style={{ fontFamily: "var(--font-sans)", fontWeight: 500 }}>
              智能项目管理助手
            </h1>
            <p className="text-sm text-[#273C46]/50 mt-1">
              你的项目秘书：需求拆解 · 任务规划 · 周报分析 · 进度提醒
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1.5 mb-6 bg-white rounded-2xl p-1.5 border border-[rgba(0,0,0,0.05)] w-fit">
          <TabButton active={tab === 'chat'} onClick={() => setTab('chat')} icon={<MessageSquare className="w-4 h-4" />} label="智能对话" />
          <TabButton active={tab === 'plan'} onClick={() => setTab('plan')} icon={<Wand2 className="w-4 h-4" />} label="需求拆解" />
          <TabButton active={tab === 'report'} onClick={() => setTab('report')} icon={<FileText className="w-4 h-4" />} label="我的周报" />
          <TabButton active={tab === 'reminder'} onClick={() => setTab('reminder')} icon={<Bell className="w-4 h-4" />} label="我的提醒" />
        </div>

        {tab === 'chat' && <ChatPanel member={member} />}
        {tab === 'plan' && <PlanPanel />}
        {tab === 'report' && <ReportPanel />}
        {tab === 'reminder' && <ReminderPanel />}
      </div>
    </MemberLayout>
  )
}

function TabButton({ active, onClick, icon, label }: {
  active: boolean; onClick: () => void; icon: ReactNode; label: string
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all
        ${active ? 'bg-[#051A24] text-white shadow-sm' : 'text-[#273C46] hover:bg-[rgba(0,0,0,0.03)]'}`}
    >
      {icon}
      {label}
    </button>
  )
}

/* ═══════════════════════════════════════════════════════════
   智能对话
   ═══════════════════════════════════════════════════════════ */

function ChatPanel({ member }: { member: MemberProfile }) {
  const [messages, setMessages] = useState<ChatMessage[]>([{
    role: 'assistant',
    content: `你好，${member.name}！我是星雨作坊的智能项目秘书。我可以帮你查看项目进度、管理任务、提交和分析周报、创建提醒。你想先做点什么？`,
  }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [aiStatus, setAiStatus] = useState<AssistantStatus | null>(null)
  const [conversations, setConversations] = useState<ConversationData[]>([])
  const [currentId, setCurrentId] = useState<number | null>(null)
  const [loadingConversation, setLoadingConversation] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const streamBufferRef = useRef('')
  const flushTimerRef = useRef<number | null>(null)
  const currentIdRef = useRef<number | null>(currentId)
  const streamConvRef = useRef<number | null>(null)

  useEffect(() => {
    assistantStatus().then(setAiStatus).catch(() => setAiStatus(null))
  }, [])

  // 初始加载：拉取对话列表；存在历史对话则自动打开最近一条
  useEffect(() => {
    listConversations()
      .then(list => {
        setConversations(list)
        if (list.length > 0) openConversation(list[0].id)
      })
      .catch(() => setConversations([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    currentIdRef.current = currentId
  }, [currentId])

  const refreshConversations = () => {
    listConversations()
      .then(setConversations)
      .catch(() => setConversations([]))
  }

  // 流式增量批量刷新：先攒 60ms 的文本再一次性写入，避免每个文字块都重渲染
  const flushStreamBuffer = (assistantIndex: number) => {
    // 用户已切换会话：不再更新当前界面（旧会话由服务端继续保存）
    if (streamConvRef.current !== currentIdRef.current) return
    if (flushTimerRef.current != null) {
      window.clearTimeout(flushTimerRef.current)
      flushTimerRef.current = null
    }
    const buffered = streamBufferRef.current
    streamBufferRef.current = ''
    if (!buffered) return
    setMessages(prev => prev.map((m, i) =>
      i === assistantIndex ? { ...m, content: m.content + buffered } : m))
  }

  const scheduleStreamFlush = (assistantIndex: number) => {
    if (flushTimerRef.current != null) return
    flushTimerRef.current = window.setTimeout(() => {
      flushTimerRef.current = null
      flushStreamBuffer(assistantIndex)
    }, 60)
  }

  const openConversation = async (conversationId: number) => {
    setLoadingConversation(true)
    currentIdRef.current = conversationId
    setCurrentId(conversationId)
    try {
      const data = await getConversation(conversationId)
      setMessages(data.messages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
          toolCalls: (m.toolCalls ?? []).map(t => ({ name: t.name, ok: t.ok })),
        })))
    } catch {
      setMessages([])
    } finally {
      setLoadingConversation(false)
    }
  }

  const startNewConversation = () => {
    currentIdRef.current = null
    setCurrentId(null)
    setMessages([{
      role: 'assistant',
      content: `你好，${member.name}！我是星雨作坊的智能项目秘书。想聊点什么？`,
    }])
    setInput('')
  }

  const handleRename = async (conversation: ConversationData) => {
    const title = window.prompt('重命名对话', conversation.title)
    if (!title || !title.trim() || title.trim() === conversation.title) return
    try {
      await renameConversation(conversation.id, title.trim())
      refreshConversations()
    } catch (err) {
      window.alert(err instanceof Error ? err.message : '重命名失败')
    }
  }

  const handleDelete = async (conversation: ConversationData) => {
    if (!window.confirm(`确定删除对话「${conversation.title}」吗？对话记录将无法恢复。`)) return
    try {
      await deleteConversation(conversation.id)
      if (currentId === conversation.id) startNewConversation()
      refreshConversations()
    } catch (err) {
      window.alert(err instanceof Error ? err.message : '删除失败')
    }
  }

  const send = async (text?: string) => {
    const content = (text ?? input).trim()
    if (!content || loading) return
    streamConvRef.current = currentId
    const history = messages
      .slice(-10)
      .filter(m => m.content)
      .map(m => ({ role: m.role, content: m.content }))
    const assistantIndex = messages.length + 1
    setMessages(prev => [...prev, { role: 'user', content }, { role: 'assistant', content: '' }])
    setInput('')
    setLoading(true)
    try {
      await assistantChatStream(content, history, currentId ?? undefined, {
        onConversation: (conversation) => {
          streamConvRef.current = conversation.id
          currentIdRef.current = conversation.id
          setCurrentId(conversation.id)
          setConversations(prev => {
            if (prev.some(c => c.id === conversation.id)) return prev
            return [{
              id: conversation.id,
              memberId: member.id,
              title: conversation.title,
              messageCount: 1,
            }, ...prev]
          })
        },
        onDelta: (textDelta) => {
          if (streamConvRef.current !== currentIdRef.current) return
          streamBufferRef.current += textDelta
          scheduleStreamFlush(assistantIndex)
        },
        onToolStart: (name) => {
          if (streamConvRef.current !== currentIdRef.current) return
          setMessages(prev => prev.map((m, i) =>
            i === assistantIndex
              ? { ...m, toolCalls: [...(m.toolCalls ?? []), { name, running: true }] }
              : m))
        },
        onToolDone: (name, ok) => {
          if (streamConvRef.current !== currentIdRef.current) return
          setMessages(prev => prev.map((m, i) =>
            i === assistantIndex
              ? {
                  ...m,
                  toolCalls: (m.toolCalls ?? []).map(t =>
                    t.name === name ? { ...t, ok, running: false } : t),
                }
              : m))
        },
        onDone: () => {
          flushStreamBuffer(assistantIndex)
          refreshConversations()
        },
        onError: (message) => {
          flushStreamBuffer(assistantIndex)
          if (streamConvRef.current !== currentIdRef.current) return
          setMessages(prev => prev.map((m, i) =>
            i === assistantIndex
              ? { ...m, content: m.content || `出错了：${message}` }
              : m))
        },
      })
    } catch (err) {
      flushStreamBuffer(assistantIndex)
      if (streamConvRef.current !== currentIdRef.current) return
      setMessages(prev => prev.map((m, i) =>
        i === assistantIndex
          ? { ...m, content: m.content || `出错了：${err instanceof Error ? err.message : '请稍后重试'}` }
          : m))
    } finally {
      if (flushTimerRef.current != null) {
        window.clearTimeout(flushTimerRef.current)
        flushTimerRef.current = null
      }
      streamBufferRef.current = ''
      setLoading(false)
    }
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    send()
  }

  // 仅当正在输出的流属于当前会话时才显示打字机/加载动画
  const streamingForCurrent = loading && streamConvRef.current === currentIdRef.current

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4" style={{ height: 'calc(100vh - 240px)', minHeight: 520 }}>
      {/* ─── 对话列表（桌面端侧栏） ─── */}
      <div className="hidden lg:flex flex-col card overflow-hidden" style={{ borderRadius: 24 }}>
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-[rgba(0,0,0,0.05)] shrink-0">
          <p className="text-sm font-semibold text-[#051A24]">对话记录</p>
          <button
            onClick={startNewConversation}
            className="w-7 h-7 rounded-lg bg-[#051A24] text-white flex items-center justify-center hover:bg-[#0D212C] transition-colors"
            title="新建对话"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin">
          {conversations.length === 0 && (
            <p className="text-xs text-[#273C46]/40 text-center pt-8 px-4 leading-relaxed">
              还没有对话记录<br />发送第一条消息会自动创建
            </p>
          )}
          {conversations.map(conversation => (
            <div
              key={conversation.id}
              onClick={() => openConversation(conversation.id)}
              className={`group flex items-start gap-2.5 rounded-xl px-3 py-2.5 cursor-pointer transition-all
                ${currentId === conversation.id
                  ? 'bg-[#051A24] text-white'
                  : 'text-[#273C46] hover:bg-[rgba(0,0,0,0.03)]'}`}
            >
              <MessageSquare className="w-4 h-4 mt-0.5 shrink-0 opacity-60" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium truncate">{conversation.title}</p>
                <p className={`text-[10px] mt-0.5 truncate ${currentId === conversation.id ? 'text-white/50' : 'text-[#273C46]/35'}`}>
                  {conversation.lastMessage
                    ? conversation.lastMessage
                    : `${conversation.messageCount} 条消息`}
                </p>
              </div>
              <div className={`hidden group-hover:flex items-center gap-1 shrink-0 ${currentId === conversation.id ? 'text-white/70' : ''}`}>
                <button
                  onClick={e => { e.stopPropagation(); handleRename(conversation) }}
                  className="p-1 rounded-md hover:bg-black/10"
                  title="重命名"
                >
                  <Pencil className="w-3 h-3" />
                </button>
                <button
                  onClick={e => { e.stopPropagation(); handleDelete(conversation) }}
                  className="p-1 rounded-md hover:bg-red-500/20 hover:text-red-400"
                  title="删除"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── 对话主体 ─── */}
      <div className="lg:col-span-3 card flex flex-col overflow-hidden" style={{ borderRadius: 24 }}>
        {/* Chat header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[rgba(0,0,0,0.05)] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#051A24] to-[#1a3a4a] flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#051A24]">项目秘书</p>
              <p className="text-[10px] text-[#273C46]/40">基于大模型的智能项目管理助手</p>
            </div>
          </div>
          {aiStatus && (
            <span className={`text-[10px] font-medium rounded-full px-2.5 py-1
              ${aiStatus.configured ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
              {aiStatus.configured ? '● AI 已就绪' : '● AI 未配置'}
            </span>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 scrollbar-thin">
          {loadingConversation && (
            <div className="flex items-center gap-2 text-xs text-[#273C46]/50 py-8 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" /> 正在加载对话记录…
            </div>
          )}
          {!loadingConversation && messages.map((msg, i) => (
            <MessageBubble
              key={i}
              msg={msg}
              isLast={i === messages.length - 1}
              streaming={streamingForCurrent && i === messages.length - 1}
            />
          ))}
          {streamingForCurrent && (
            <div className="flex justify-start">
              <div className="bg-[#f5f2ed] rounded-2xl px-4 py-3 flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-[#273C46]/40 animate-spin" />
                <span className="text-xs text-[#273C46]/50">秘书正在思考和操作…</span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Suggestions */}
        {messages.length <= 2 && !loading && !loadingConversation && (
          <div className="px-5 pb-2 flex flex-wrap gap-2 shrink-0">
            {SUGGESTIONS.map(s => (
              <button
                key={s}
                onClick={() => send(s)}
                className="text-xs text-[#273C46]/70 bg-white border border-[rgba(0,0,0,0.06)] rounded-full px-3 py-1.5
                  hover:bg-[#051A24] hover:text-white hover:border-[#051A24] transition-all"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <form onSubmit={onSubmit} className="p-4 border-t border-[rgba(0,0,0,0.05)] shrink-0">
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  send()
                }
              }}
              rows={1}
              placeholder="试试说：帮我看看最近有什么任务快到期了…"
              className="flex-1 resize-none rounded-2xl border border-[rgba(0,0,0,0.08)] bg-white px-4 py-3
                text-sm text-[#051A24] placeholder:text-[#273C46]/30 focus:outline-none focus:border-[#051A24]/30 focus:ring-2 focus:ring-[#051A24]/5"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="w-11 h-11 rounded-2xl bg-[#051A24] text-white flex items-center justify-center
                hover:bg-[#0D212C] disabled:opacity-30 disabled:cursor-not-allowed transition-all shrink-0"
              title="发送"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[10px] text-[#273C46]/30 mt-2 pl-1">
            提示：输入 Shift+Enter 换行。对话记录会自动保存，可在左侧切换。
          </p>
        </form>
      </div>
    </div>
  )
}

const MessageBubble = memo(function MessageBubble({ msg, isLast, streaming }: {
  msg: ChatMessage
  isLast: boolean
  streaming: boolean
}) {
  const isUser = msg.role === 'user'
  const toolCalls = msg.toolCalls ?? []
  const streamingNow = streaming && isLast && !isUser

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[80%] ${isUser ? 'order-1' : ''}`}>
        {!isUser && (
          <div className="flex items-center gap-1.5 mb-1 text-[10px] text-[#273C46]/40 font-medium">
            <Sparkles className="w-3 h-3" /> 项目秘书
            {msg.content && (
              <button
                onClick={() => navigator.clipboard.writeText(msg.content)}
                className="ml-1 p-1 rounded-md hover:bg-black/5 hover:text-[#051A24] transition-colors"
                title="复制回答"
              >
                <Copy className="w-3 h-3" />
              </button>
            )}
          </div>
        )}

        {(msg.content || toolCalls.length > 0) && (
          <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed
            ${isUser
              ? 'bg-[#051A24] text-white rounded-br-md'
              : 'bg-[#f5f2ed] text-[#051A24] rounded-bl-md'}`}>
            {isUser || streamingNow
              ? <span className="whitespace-pre-wrap">{msg.content}</span>
              : <Markdown content={msg.content} />}
            {streamingNow && (
              <span className="inline-block w-1.5 h-4 bg-[#051A24]/40 animate-pulse ml-0.5 align-middle" />
            )}
          </div>
        )}

        {!msg.content && streamingNow && toolCalls.length === 0 && (
          <div className="bg-[#f5f2ed] rounded-2xl px-4 py-3 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#273C46]/30 animate-bounce" />
            <span className="w-1.5 h-1.5 rounded-full bg-[#273C46]/30 animate-bounce [animation-delay:0.15s]" />
            <span className="w-1.5 h-1.5 rounded-full bg-[#273C46]/30 animate-bounce [animation-delay:0.3s]" />
          </div>
        )}

        {toolCalls.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {toolCalls.map((t, j) => (
              <span key={j} className={`text-[10px] font-medium rounded-full px-2 py-0.5
                ${t.running
                  ? 'bg-blue-50 text-blue-600'
                  : t.ok
                    ? 'bg-emerald-50 text-emerald-600'
                    : 'bg-red-50 text-red-500'}`}>
                {t.running ? '⋯' : t.ok ? '✓' : '✕'} {t.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
})

/* ═══════════════════════════════════════════════════════════
   需求拆解
   ═══════════════════════════════════════════════════════════ */

function PlanPanel() {
  const [requirement, setRequirement] = useState('')
  const [plan, setPlan] = useState<RequirementPlan | null>(null)
  const [loading, setLoading] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [applying, setApplying] = useState(false)
  const [applied, setApplied] = useState<{ projectId: number; name: string; milestoneCount: number; taskCount: number } | null>(null)
  const [error, setError] = useState('')
  const streamRef = useRef<HTMLPreElement>(null)

  useEffect(() => {
    streamRef.current?.scrollTo({ top: streamRef.current.scrollHeight })
  }, [streamingText])

  const parse = async () => {
    if (!requirement.trim() || loading) return
    setLoading(true)
    setError('')
    setPlan(null)
    setApplied(null)
    setStreamingText('')
    try {
      await assistantParseRequirementStream(requirement.trim(), {
        onDelta: (text) => setStreamingText(prev => prev + text),
        onPlan: (parsedPlan) => setPlan(parsedPlan),
        onError: (message) => setError(message),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : '解析失败，请稍后重试')
    } finally {
      setLoading(false)
      setStreamingText('')
    }
  }

  const apply = async () => {
    if (!plan || applying) return
    setApplying(true)
    setError('')
    try {
      const res = await assistantApplyPlan(plan)
      setApplied({
        projectId: res.summary.project.id,
        name: res.summary.project.name,
        milestoneCount: res.summary.milestoneCount,
        taskCount: res.summary.taskCount,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建失败，请稍后重试')
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      {/* Input side */}
      <div className="lg:col-span-2 space-y-4">
        <div className="card p-6" style={{ borderRadius: 24 }}>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-xl bg-[#051A24] flex items-center justify-center">
              <Wand2 className="w-4 h-4 text-white" />
            </div>
            <h2 className="text-sm font-semibold text-[#051A24]">描述你的项目需求</h2>
          </div>
          <p className="text-xs text-[#273C46]/50 mt-2 leading-relaxed">
            用自然语言描述即可，AI 会自动拆解为项目目标、里程碑和任务清单。你可以提到目标、人员、时间、技术等任何约束。
          </p>
          <textarea
            value={requirement}
            onChange={e => setRequirement(e.target.value)}
            rows={8}
            placeholder={'例如：\n下学期想做一个校园二手交易小程序，面向全校学生，\n支持发布、搜索、收藏、私信功能，希望 9 月上线，\n开发组 4 人，前端 2 人后端 2 人。'}
            className="w-full mt-4 resize-none rounded-2xl border border-[rgba(0,0,0,0.08)] bg-[#fcfbfa] px-4 py-3
              text-sm text-[#051A24] placeholder:text-[#273C46]/30 focus:outline-none focus:border-[#051A24]/30 focus:ring-2 focus:ring-[#051A24]/5"
          />
          <button
            onClick={parse}
            disabled={loading || !requirement.trim()}
            className="btn-primary mt-4 w-full justify-center inline-flex items-center gap-2 disabled:opacity-40"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {loading ? '正在拆解需求…' : 'AI 拆解需求'}
          </button>
        </div>

        <div className="card p-5 text-xs text-[#273C46]/50 leading-relaxed" style={{ borderRadius: 24 }}>
          <div className="flex items-center gap-1.5 text-[#051A24] font-medium mb-2">
            <Lightbulb className="w-3.5 h-3.5" /> 小技巧
          </div>
          <p>需求描述越具体，规划越准确。建议包含：目标用户、核心功能、期望时间、团队规模。AI 生成的方案会先展示给你确认，确认后才真正创建项目。</p>
        </div>
      </div>

      {/* Result side */}
      <div className="lg:col-span-3">
        {error && (
          <div className="flex items-start gap-2 text-sm text-red-500 bg-red-50 rounded-2xl px-4 py-3 mb-4">
            <CircleAlert className="w-4 h-4 mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        {!plan && !error && loading && (
          <div className="card p-6" style={{ borderRadius: 24 }}>
            <div className="flex items-center gap-2 mb-3">
              <Loader2 className="w-4 h-4 text-[#273C46]/40 animate-spin" />
              <p className="text-sm font-medium text-[#051A24]">AI 正在生成项目方案（实时）</p>
            </div>
            <pre
              ref={streamRef}
              className="h-[420px] overflow-y-auto rounded-2xl bg-[#f8f7f5] border border-[rgba(0,0,0,0.06)] p-4
                text-xs leading-relaxed text-[#0D212C] font-mono whitespace-pre-wrap scrollbar-thin"
            >
              {streamingText || '正在思考…'}
              {streamingText && <span className="inline-block w-1.5 h-3 bg-[#051A24]/40 animate-pulse ml-0.5 align-middle" />}
            </pre>
            <p className="text-[10px] text-[#273C46]/40 mt-3">
              正在流式生成，完成后会自动整理成方案卡片，无需等待全部结束
            </p>
          </div>
        )}

        {!plan && !error && !loading && (
          <div className="h-full min-h-[320px] flex flex-col items-center justify-center text-center card" style={{ borderRadius: 24 }}>
            <div className="w-14 h-14 rounded-2xl bg-[#f0ece6] flex items-center justify-center mb-4">
              <Rocket className="w-6 h-6 text-[#273C46]/30" />
            </div>
            <p className="text-sm font-medium text-[#273C46]/60">还没有项目规划</p>
            <p className="text-xs text-[#273C46]/40 mt-1 max-w-[260px]">
              在左侧输入需求，点击「AI 拆解需求」，生成的完整项目方案会显示在这里
            </p>
          </div>
        )}

        {plan && !applied && (
          <div className="card p-6" style={{ borderRadius: 24 }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-[#051A24]">项目方案预览</h2>
              <span className="text-[10px] font-medium bg-amber-50 text-amber-600 rounded-full px-2.5 py-1">待确认 · 未写入数据库</span>
            </div>

            {/* Project */}
            <div className="rounded-2xl bg-[#051A24] text-white p-5 mb-4">
              <p className="text-lg font-medium tracking-tight"
                style={{ fontFamily: "var(--font-sans)", fontWeight: 500 }}>
                {plan.project.name || '未命名项目'}
              </p>
              {plan.project.description && (
                <p className="text-xs text-white/60 mt-1.5 leading-relaxed">{plan.project.description}</p>
              )}
              <div className="flex flex-wrap gap-2 mt-3">
                {plan.project.category && (
                  <span className="text-[10px] bg-white/10 rounded-full px-2.5 py-1">{plan.project.category}</span>
                )}
                {plan.project.startDate && (
                  <span className="text-[10px] bg-white/10 rounded-full px-2.5 py-1">开始 {plan.project.startDate}</span>
                )}
                {plan.project.endDate && (
                  <span className="text-[10px] bg-white/10 rounded-full px-2.5 py-1">截止 {plan.project.endDate}</span>
                )}
              </div>
            </div>

            {/* Milestones */}
            <p className="text-xs font-semibold text-[#051A24] mb-2 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> 里程碑（{plan.milestones.length}）
            </p>
            <div className="space-y-2 mb-4">
              {plan.milestones.map((m, i) => (
                <div key={i} className="flex items-start gap-3 rounded-2xl border border-[rgba(0,0,0,0.05)] bg-[#fcfbfa] px-4 py-3">
                  <div className="w-6 h-6 rounded-full bg-[#051A24] text-white text-[10px] font-semibold flex items-center justify-center shrink-0 mt-0.5">
                    {i + 1}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#051A24]">{m.name}</p>
                    {m.description && <p className="text-xs text-[#273C46]/50 mt-0.5">{m.description}</p>}
                    {m.dueDate && <p className="text-[10px] text-[#273C46]/40 mt-1">截止 {m.dueDate}</p>}
                  </div>
                </div>
              ))}
            </div>

            {/* Tasks */}
            <p className="text-xs font-semibold text-[#051A24] mb-2 flex items-center gap-1.5">
              <CheckSquare className="w-3.5 h-3.5" /> 任务（{plan.tasks.length}）
            </p>
            <div className="space-y-1.5 mb-6">
              {plan.tasks.map((t, i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-[#fcfbfa] transition-colors">
                  <div className={`w-2 h-2 rounded-full shrink-0
                    ${t.priority === 'urgent' ? 'bg-red-400' : t.priority === 'high' ? 'bg-orange-400' : t.priority === 'low' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-[#051A24] truncate">{t.title}</p>
                    {t.milestoneIndex != null && plan.milestones[t.milestoneIndex] && (
                      <p className="text-[10px] text-[#273C46]/40">属于里程碑：{plan.milestones[t.milestoneIndex].name}</p>
                    )}
                  </div>
                  {t.assigneeName && (
                    <span className="text-[10px] bg-[#f0ece6] text-[#273C46] rounded-full px-2 py-0.5 shrink-0">👤 {t.assigneeName}</span>
                  )}
                  {t.dueDate && <span className="text-[10px] text-[#273C46]/40 shrink-0">{t.dueDate}</span>}
                </div>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={apply}
                disabled={applying}
                className="btn-primary flex-1 justify-center inline-flex items-center gap-2 disabled:opacity-50"
              >
                {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
                {applying ? '正在创建…' : `确认创建「${plan.project.name || '项目'}」`}
              </button>
              <button
                onClick={() => setPlan(null)}
                className="btn-secondary"
              >
                重新生成
              </button>
            </div>
          </div>
        )}

        {applied && (
          <div className="card p-8 text-center" style={{ borderRadius: 24 }}>
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-500 flex items-center justify-center mx-auto mb-4">
              <Check className="w-7 h-7" />
            </div>
            <h2 className="text-lg font-semibold text-[#051A24]">项目「{applied.name}」创建成功</h2>
            <p className="text-sm text-[#273C46]/50 mt-2">
              已创建 {applied.milestoneCount} 个里程碑、{applied.taskCount} 个任务，并已通知相关成员。
            </p>
            <a
              href={`/member/projects/${applied.projectId}`}
              className="btn-primary mt-6 inline-flex items-center gap-2"
            >
              去项目看板看看 <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        )}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   我的周报
   ═══════════════════════════════════════════════════════════ */

function ReportPanel() {
  const [reports, setReports] = useState<WeeklyReportData[]>([])
  const [template, setTemplate] = useState<Required<WeeklyReportTemplate>>(DEFAULT_WEEKLY_TEMPLATE)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [analyzingId, setAnalyzingId] = useState<number | null>(null)
  const [actionError, setActionError] = useState('')
  const [form, setForm] = useState({
    weekStart: '',
    weekEnd: '',
    content: emptyWeeklyContent(DEFAULT_WEEKLY_TEMPLATE),
  })

  const load = () => {
    setLoading(true)
    memberListWeeklyReports()
      .then(setReports)
      .catch(() => setReports([]))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  useEffect(() => {
    fetchSiteConfig()
      .then(config => {
        const nextTemplate = normalizeWeeklyTemplate(config.weekly_report_template)
        setTemplate(nextTemplate)
        setForm(current => ({
          ...current,
          content: { ...emptyWeeklyContent(nextTemplate), ...current.content },
        }))
      })
      .catch(() => {})
  }, [])

  const create = async (e: FormEvent) => {
    e.preventDefault()
    setActionError('')
    try {
      await memberCreateWeeklyReport({
        weekStart: form.weekStart || undefined,
        weekEnd: form.weekEnd || undefined,
        content: form.content,
      })
      setForm({ weekStart: '', weekEnd: '', content: emptyWeeklyContent(template) })
      setShowForm(false)
      load()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : '创建失败')
    }
  }

  const submit = async (id: number) => {
    setActionError('')
    try {
      await memberSubmitWeeklyReport(id)
      load()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : '提交失败')
    }
  }

  const analyze = async (id: number) => {
    setAnalyzingId(id)
    setActionError('')
    try {
      await memberAnalyzeWeeklyReport(id)
      load()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : '分析失败')
    } finally {
      setAnalyzingId(null)
    }
  }

  const remove = async (id: number) => {
    setActionError('')
    try {
      await memberDeleteWeeklyReport(id)
      load()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : '删除失败')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#273C46]/50">共 {reports.length} 份周报 · 提交后可由教师审阅，也可先用 AI 分析</p>
        <button
          onClick={() => {
            setShowForm(!showForm)
            if (!showForm) {
              setForm(current => ({ ...current, content: { ...emptyWeeklyContent(template), ...current.content } }))
            }
          }}
          className="btn-primary-sm inline-flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" /> 新建周报
        </button>
      </div>

      {actionError && (
        <div className="flex items-start gap-2 text-sm text-red-500 bg-red-50 rounded-2xl px-4 py-3">
          <CircleAlert className="w-4 h-4 mt-0.5 shrink-0" />
          {actionError}
        </div>
      )}

      {showForm && (
        <form onSubmit={create} className="card p-6 grid grid-cols-1 md:grid-cols-2 gap-4" style={{ borderRadius: 24 }}>
          <div>
            <label className="text-xs font-medium text-[#273C46]/60">周开始</label>
            <input type="date" value={form.weekStart} onChange={e => setForm({ ...form, weekStart: e.target.value })}
              className="mt-1 w-full rounded-xl border border-[rgba(0,0,0,0.08)] bg-[#fcfbfa] px-3 py-2 text-sm focus:outline-none focus:border-[#051A24]/30" />
          </div>
          <div>
            <label className="text-xs font-medium text-[#273C46]/60">周结束</label>
            <input type="date" value={form.weekEnd} onChange={e => setForm({ ...form, weekEnd: e.target.value })}
              className="mt-1 w-full rounded-xl border border-[rgba(0,0,0,0.08)] bg-[#fcfbfa] px-3 py-2 text-sm focus:outline-none focus:border-[#051A24]/30" />
          </div>
          {template.fields.map(field => (
            <div key={field.key} className="md:col-span-2">
              <label className="text-xs font-medium text-[#273C46]/60">
                {field.label} {field.required && <span className="text-red-400">*</span>}
              </label>
              <textarea
                rows={field.rows || 2}
                value={form.content[field.key] || ''}
                onChange={e => setForm({
                  ...form,
                  content: { ...form.content, [field.key]: e.target.value },
                })}
                required={!!field.required}
                className="mt-1 w-full resize-none rounded-xl border border-[rgba(0,0,0,0.08)] bg-[#fcfbfa] px-3 py-2 text-sm focus:outline-none focus:border-[#051A24]/30"
                placeholder={field.placeholder || field.label}
              />
            </div>
          ))}
          <div className="md:col-span-2 flex items-center gap-3">
            <button type="submit" className="btn-primary inline-flex items-center gap-2">
              <FileText className="w-4 h-4" /> 保存草稿
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">取消</button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[0, 1].map(i => (
            <div key={i} className="card p-6 animate-pulse" style={{ borderRadius: 24 }}>
              <div className="h-4 w-1/3 bg-[#f0ece6] rounded-lg mb-4" />
              <div className="h-3 w-2/3 bg-[#f0ece6] rounded-md" />
            </div>
          ))}
        </div>
      ) : reports.length === 0 ? (
        <div className="card p-10 text-center" style={{ borderRadius: 24 }}>
          <div className="w-12 h-12 rounded-2xl bg-[#f0ece6] flex items-center justify-center mx-auto mb-3">
            <FileText className="w-5 h-5 text-[#273C46]/30" />
          </div>
          <p className="text-sm font-medium text-[#273C46]/60">还没有周报</p>
          <p className="text-xs text-[#273C46]/40 mt-1">点击右上角「新建周报」开始记录本周工作</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {reports.map(report => {
            const meta = STATUS_META[report.status] || { label: report.status, className: 'bg-[#f0ece6] text-[#273C46]' }
            return (
              <div key={report.id} className="card p-6" style={{ borderRadius: 24 }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-[#f0ece6] flex items-center justify-center">
                      <FileText className="w-4 h-4 text-[#273C46]/50" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#051A24]">
                        {report.weekStart ? `${report.weekStart} 至 ${report.weekEnd || '…'}` : '未指定周'}
                      </p>
                      {report.projectName && <p className="text-[10px] text-[#273C46]/40">{report.projectName}</p>}
                    </div>
                  </div>
                  <span className={`text-[10px] font-medium rounded-full px-2.5 py-1 ${meta.className}`}>{meta.label}</span>
                </div>

                <div className="space-y-2 text-sm">
                  {reportContentRows(report.content, template).map(row => (
                    <p key={row.key} className="text-[#051A24] leading-relaxed">
                      <span className="text-[#273C46]/40 mr-1.5">{row.label}</span>{row.value}
                    </p>
                  ))}
                </div>

                {report.aiAnalysis && (
                  <div className="mt-4 rounded-2xl bg-emerald-50/60 border border-emerald-100 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-emerald-700 flex items-center gap-1.5">
                        <Sparkles className="w-3 h-3" /> AI 分析
                      </p>
                      {report.completionRate != null && (
                        <span className="text-xs font-bold text-emerald-700">完成度 {report.completionRate}%</span>
                      )}
                    </div>
                    {report.aiAnalysis.completion && (
                      <p className="text-xs text-emerald-800/80 leading-relaxed">{report.aiAnalysis.completion}</p>
                    )}
                    {report.aiAnalysis.risks && report.aiAnalysis.risks.length > 0 && (
                      <div className="mt-2 flex items-start gap-1.5">
                        <AlertTriangle className="w-3 h-3 text-amber-500 mt-0.5 shrink-0" />
                        <p className="text-[11px] text-amber-700/80">{report.aiAnalysis.risks.join('；')}</p>
                      </div>
                    )}
                    {report.aiAnalysis.report && (
                      <div className="mt-2 rounded-xl bg-white/70 p-2.5">
                        <p className="text-[11px] text-[#273C46]/70 leading-relaxed">{report.aiAnalysis.report}</p>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-2 mt-4">
                  {report.status === 'draft' && (
                    <>
                      <button onClick={() => submit(report.id)} className="btn-primary-sm inline-flex items-center gap-1.5">
                        <ChevronRight className="w-3.5 h-3.5" /> 提交审阅
                      </button>
                      <button onClick={() => analyze(report.id)} disabled={analyzingId === report.id}
                        className="btn-secondary text-xs inline-flex items-center gap-1.5 disabled:opacity-50">
                        {analyzingId === report.id
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : <Sparkles className="w-3 h-3" />}
                        AI 分析
                      </button>
                      <button onClick={() => remove(report.id)} className="text-xs text-red-400 hover:text-red-500 ml-auto">
                        删除
                      </button>
                    </>
                  )}
                  {report.status === 'submitted' && (
                    <>
                      <button onClick={() => analyze(report.id)} disabled={analyzingId === report.id}
                        className="btn-secondary text-xs inline-flex items-center gap-1.5 disabled:opacity-50">
                        {analyzingId === report.id
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : <Sparkles className="w-3 h-3" />}
                        {report.aiAnalysis ? '重新分析' : 'AI 分析'}
                      </button>
                      <button onClick={() => remove(report.id)} className="text-xs text-red-400 hover:text-red-500 ml-auto">
                        删除
                      </button>
                    </>
                  )}
                  {report.status === 'reviewed' && report.reviewNote && (
                    <span className="text-xs text-[#273C46]/50">教师批注：{report.reviewNote}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   我的提醒
   ═══════════════════════════════════════════════════════════ */

const REMINDER_STATUS_META: Record<string, { label: string; className: string }> = {
  pending: { label: '待触发', className: 'bg-blue-50 text-blue-600' },
  sent: { label: '已提醒', className: 'bg-emerald-50 text-emerald-600' },
  done: { label: '已完成', className: 'bg-[#f0ece6] text-[#273C46]' },
  cancelled: { label: '已取消', className: 'bg-[#f0ece6] text-[#273C46]' },
}

function ReminderPanel() {
  const [reminders, setReminders] = useState<ReminderData[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [actionError, setActionError] = useState('')
  const [actionInfo, setActionInfo] = useState('')
  const [form, setForm] = useState({ title: '', message: '', scheduledAt: '' })

  const load = () => {
    setLoading(true)
    memberListReminders()
      .then(setReminders)
      .catch(() => setReminders([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const create = async (e: FormEvent) => {
    e.preventDefault()
    setActionError('')
    setActionInfo('')
    try {
      const result = await memberCreateReminder({
        title: form.title,
        message: form.message || undefined,
        scheduledAt: form.scheduledAt
          ? new Date(form.scheduledAt).toISOString()
          : undefined,
      })
      setForm({ title: '', message: '', scheduledAt: '' })
      setShowForm(false)
      setActionInfo(
        result.sentImmediately
          ? '提醒已创建，并已立即发送到你的通知中心'
          : `提醒已创建，将在 ${formatReminderTime(result.reminder.scheduledAt)} 触发（到点后自动发通知）`,
      )
      load()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : '创建失败')
    }
  }

  const complete = async (id: number) => {
    setActionError('')
    try {
      await memberCompleteReminder(id)
      load()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : '操作失败')
    }
  }

  const remove = async (id: number) => {
    setActionError('')
    try {
      await memberDeleteReminder(id)
      load()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : '删除失败')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#273C46]/50">
          共 {reminders.length} 条提醒 · 到点后自动转为站内通知并弹窗提醒
        </p>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary-sm inline-flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" /> 新建提醒
        </button>
      </div>

      {actionError && (
        <div className="flex items-start gap-2 text-sm text-red-500 bg-red-50 rounded-2xl px-4 py-3">
          <CircleAlert className="w-4 h-4 mt-0.5 shrink-0" />
          {actionError}
        </div>
      )}
      {actionInfo && (
        <div className="flex items-start gap-2 text-sm text-emerald-600 bg-emerald-50 rounded-2xl px-4 py-3">
          <Check className="w-4 h-4 mt-0.5 shrink-0" />
          {actionInfo}
        </div>
      )}

      {showForm && (
        <form onSubmit={create} className="card p-6 grid grid-cols-1 md:grid-cols-3 gap-4" style={{ borderRadius: 24 }}>
          <div>
            <label className="text-xs font-medium text-[#273C46]/60">提醒内容 <span className="text-red-400">*</span></label>
            <input
              type="text"
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              required
              placeholder="如：周五提交周报"
              className="mt-1 w-full rounded-xl border border-[rgba(0,0,0,0.08)] bg-[#fcfbfa] px-3 py-2 text-sm focus:outline-none focus:border-[#051A24]/30"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-[#273C46]/60">备注（可选）</label>
            <input
              type="text"
              value={form.message}
              onChange={e => setForm({ ...form, message: e.target.value })}
              placeholder="提醒详情"
              className="mt-1 w-full rounded-xl border border-[rgba(0,0,0,0.08)] bg-[#fcfbfa] px-3 py-2 text-sm focus:outline-none focus:border-[#051A24]/30"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-[#273C46]/60">触发时间（不填 = 立即提醒）</label>
            <input
              type="datetime-local"
              value={form.scheduledAt}
              onChange={e => setForm({ ...form, scheduledAt: e.target.value })}
              className="mt-1 w-full rounded-xl border border-[rgba(0,0,0,0.08)] bg-[#fcfbfa] px-3 py-2 text-sm focus:outline-none focus:border-[#051A24]/30"
            />
          </div>
          <div className="md:col-span-3 flex items-center gap-3">
            <button type="submit" className="btn-primary inline-flex items-center gap-2">
              <Bell className="w-4 h-4" /> 保存提醒
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">取消</button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[0, 1].map(i => (
            <div key={i} className="card p-6 animate-pulse" style={{ borderRadius: 24 }}>
              <div className="h-4 w-1/3 bg-[#f0ece6] rounded-lg mb-4" />
              <div className="h-3 w-2/3 bg-[#f0ece6] rounded-md" />
            </div>
          ))}
        </div>
      ) : reminders.length === 0 ? (
        <div className="card p-10 text-center" style={{ borderRadius: 24 }}>
          <div className="w-12 h-12 rounded-2xl bg-[#f0ece6] flex items-center justify-center mx-auto mb-3">
            <Bell className="w-5 h-5 text-[#273C46]/30" />
          </div>
          <p className="text-sm font-medium text-[#273C46]/60">还没有提醒</p>
          <p className="text-xs text-[#273C46]/40 mt-1">新建一条提醒，到点后会自动通知你</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {reminders.map(reminder => {
            const meta = REMINDER_STATUS_META[reminder.status] || {
              label: reminder.status,
              className: 'bg-[#f0ece6] text-[#273C46]',
            }
            return (
              <div key={reminder.id} className="card p-6" style={{ borderRadius: 24 }}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0
                      ${reminder.status === 'pending' ? 'bg-blue-50 text-blue-600' : 'bg-[#f0ece6] text-[#273C46]/50'}`}>
                      <Bell className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#051A24] truncate">{reminder.title}</p>
                      {reminder.message && (
                        <p className="text-xs text-[#273C46]/50 mt-0.5 truncate">{reminder.message}</p>
                      )}
                    </div>
                  </div>
                  <span className={`text-[10px] font-medium rounded-full px-2.5 py-1 shrink-0 ${meta.className}`}>
                    {meta.label}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 text-[11px] text-[#273C46]/40 mb-4">
                  <Clock className="w-3 h-3" />
                  {reminder.status === 'sent'
                    ? `已于 ${formatReminderTime(reminder.sentAt)} 提醒`
                    : `触发时间：${formatReminderTime(reminder.scheduledAt)}`}
                </div>

                <div className="flex items-center gap-2">
                  {reminder.status === 'pending' && (
                    <button onClick={() => complete(reminder.id)} className="btn-secondary text-xs px-3 py-1.5">
                      标记完成
                    </button>
                  )}
                  <button
                    onClick={() => remove(reminder.id)}
                    className="text-xs text-red-400 hover:text-red-500 ml-auto"
                  >
                    删除
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function formatReminderTime(value?: string): string {
  if (!value) return '立即'
  const date = new Date(value)
  if (isNaN(date.getTime())) return value
  return date.toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
