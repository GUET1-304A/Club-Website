import { useState, useEffect, useCallback } from 'react'
import {
  ClipboardCheck, Eye, Sparkles, LoaderCircle, X, CheckCircle2, Calendar, User, FolderGit2,
} from 'lucide-react'
import AdminLayout from './AdminLayout'
import {
  adminListWeeklyReports, adminGetWeeklyReport,
  adminReviewWeeklyReport, adminAnalyzeWeeklyReport,
  type AdminWeeklyReport,
} from '../../services/adminApi'
import { useToast } from './Toast'

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  draft: { label: '草稿', cls: 'bg-[#f0ece6] text-[#273C46]/60' },
  submitted: { label: '待审阅', cls: 'bg-amber-50 text-amber-700' },
  reviewed: { label: '已审阅', cls: 'bg-emerald-50 text-emerald-700' },
}

const TABS = [
  { value: '', label: '全部' },
  { value: 'submitted', label: '待审阅' },
  { value: 'reviewed', label: '已审阅' },
  { value: 'draft', label: '草稿' },
]

export default function AdminWeeklyReports() {
  const { toast } = useToast()
  const [reports, setReports] = useState<AdminWeeklyReport[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('')
  const [detail, setDetail] = useState<AdminWeeklyReport | null>(null)
  const [reviewNote, setReviewNote] = useState('')
  const [completionRate, setCompletionRate] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [reviewing, setReviewing] = useState(false)

  const load = useCallback(async (status = tab) => {
    setLoading(true)
    const params: Record<string, string> = {}
    if (status) params.status = status
    const data = await adminListWeeklyReports(params).catch(() => [])
    setReports(data)
    setLoading(false)
  }, [tab])

  useEffect(() => { load() }, [load])

  const openDetail = async (report: AdminWeeklyReport) => {
    setDetail(report)
    setReviewNote(report.reviewNote || '')
    setCompletionRate(report.completionRate != null ? String(report.completionRate) : '')
    if (!report.content || report.content.done === undefined) {
      try {
        const fresh = await adminGetWeeklyReport(report.id)
        setDetail(fresh)
        setReviewNote(fresh.reviewNote || '')
        setCompletionRate(fresh.completionRate != null ? String(fresh.completionRate) : '')
      } catch (error: unknown) {
        toast('error', (error as Error).message)
      }
    }
  }

  const handleAnalyze = async () => {
    if (!detail) return
    setAnalyzing(true)
    try {
      const { report } = await adminAnalyzeWeeklyReport(detail.id)
      setDetail(report)
      toast('success', 'AI 分析完成')
      load()
    } catch (error: unknown) {
      toast('error', (error as Error).message)
    } finally {
      setAnalyzing(false)
    }
  }

  const handleReview = async () => {
    if (!detail) return
    const rate = completionRate.trim()
    const parsedRate = rate === '' ? undefined : Number(rate)
    if (parsedRate !== undefined && (Number.isNaN(parsedRate) || parsedRate < 0 || parsedRate > 100)) {
      toast('warning', '完成度需为 0-100 的数字')
      return
    }
    setReviewing(true)
    try {
      const { report } = await adminReviewWeeklyReport(detail.id, {
        reviewNote: reviewNote.trim() || undefined,
        completionRate: parsedRate,
      })
      setDetail(report)
      toast('success', `周报 #${report.id} 已审阅`)
      load()
    } catch (error: unknown) {
      toast('error', (error as Error).message)
    } finally {
      setReviewing(false)
    }
  }

  return (
    <AdminLayout>
      <div className="animate-fade-in-up">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-[28px] font-medium text-[#051A24] tracking-tight"
              style={{ fontFamily: "'PP Neue Montreal', 'Noto Sans SC', sans-serif", fontWeight: 500 }}>
              周报审阅
            </h1>
            <p className="text-sm text-[#273C46]/50 mt-1">
              查看学生周报、AI 分析完成度并给出审阅批注
            </p>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1.5 flex-wrap mb-5">
          {TABS.map(item => (
            <button
              key={item.value}
              onClick={() => { setTab(item.value); load(item.value) }}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all
                ${tab === item.value
                  ? 'bg-[#051A24] text-white shadow-sm'
                  : 'bg-white text-[#273C46]/60 border border-[rgba(0,0,0,0.06)] hover:text-[#051A24]'}`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="card p-5 animate-pulse" style={{ borderRadius: 20 }}>
                <div className="h-4 w-1/3 bg-[#f0ece6] rounded-md mb-3" />
                <div className="h-3 w-2/3 bg-[#f0ece6] rounded-md" />
              </div>
            ))}
          </div>
        ) : reports.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#f0ece6] flex items-center justify-center mb-4">
              <ClipboardCheck className="w-7 h-7 text-[#273C46]/20" />
            </div>
            <p className="text-sm text-[#273C46]/50">暂无周报</p>
            <p className="text-xs text-[#273C46]/30 mt-1">成员提交的周报会显示在这里</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reports.map(report => {
              const st = STATUS_MAP[report.status] || STATUS_MAP.draft
              return (
                <div key={report.id} className="card p-4 md:p-5 flex flex-col md:flex-row md:items-center gap-3"
                  style={{ borderRadius: 20 }}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="text-[10px] font-medium rounded-full px-2 py-0.5 bg-[#f0ece6] text-[#273C46]/50">#{report.id}</span>
                      <span className={`text-[10px] font-medium rounded-full px-2 py-0.5 ${st.cls}`}>{st.label}</span>
                      {report.aiAnalysis?.score != null && (
                        <span className="text-[10px] font-medium rounded-full px-2 py-0.5 bg-emerald-50 text-emerald-700">
                          AI 完成度 {report.aiAnalysis.score}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-[#051A24] line-clamp-1">
                      {(report.content || {}).done || '（未填写内容）'}
                    </p>
                    <div className="flex items-center gap-4 mt-1.5 text-[11px] text-[#273C46]/50 flex-wrap">
                      <span className="flex items-center gap-1"><User className="w-3 h-3" /> {report.memberName || '-'}</span>
                      <span className="flex items-center gap-1"><FolderGit2 className="w-3 h-3" /> {report.projectName || '未关联项目'}</span>
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {report.weekStart || '-'} ~ {report.weekEnd || '-'}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {report.completionRate != null && (
                      <span className="text-xs text-[#273C46]/60">完成度 {report.completionRate}</span>
                    )}
                    <button
                      onClick={() => openDetail(report)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#051A24] text-white text-xs font-medium hover:opacity-90 transition-all"
                    >
                      <Eye className="w-3.5 h-3.5" /> 查看/审阅
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Detail / Review modal ── */}
        {detail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setDetail(null)}>
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
            <div className="relative bg-white rounded-[28px] shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto p-6 z-10"
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-medium text-[#051A24]">周报 #{detail.id}</h2>
                <button onClick={() => setDetail(null)} className="p-1.5 rounded-xl hover:bg-[rgba(0,0,0,0.04)] text-[#273C46]/50">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                <InfoBox label="成员" value={detail.memberName || '-'} />
                <InfoBox label="项目" value={detail.projectName || '未关联'} />
                <InfoBox label="周开始" value={detail.weekStart || '-'} />
                <InfoBox label="周结束" value={detail.weekEnd || '-'} />
              </div>

              <div className="space-y-4">
                <ContentBlock label="本周完成" value={(detail.content || {}).done} />
                <ContentBlock label="下周计划" value={(detail.content || {}).plan} />
                <ContentBlock label="问题/风险" value={(detail.content || {}).issues} />
                <ContentBlock label="总结" value={(detail.content || {}).summary} />
              </div>

              {/* AI Analysis */}
              <div className="mt-5 rounded-2xl bg-[#f7f5f1] p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-medium text-[#273C46]/60 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" /> AI 分析
                  </p>
                  <button
                    onClick={handleAnalyze}
                    disabled={analyzing}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#051A24] text-white text-xs font-medium hover:opacity-90 disabled:opacity-50 transition-all"
                  >
                    {analyzing ? <LoaderCircle className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    {analyzing ? '分析中...' : (detail.aiAnalysis ? '重新分析' : 'AI 分析')}
                  </button>
                </div>
                {detail.aiAnalysis ? (
                  <div className="space-y-2 text-xs text-[#273C46]/70">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[#051A24]">完成度评分</span>
                      <span className="text-emerald-700 font-semibold">{detail.aiAnalysis.score ?? '-'}</span>
                      {detail.aiAnalysis.completion && <span>· {detail.aiAnalysis.completion}</span>}
                    </div>
                    {detail.aiAnalysis.report && <p className="leading-5">{detail.aiAnalysis.report}</p>}
                    {detail.aiAnalysis.risks && detail.aiAnalysis.risks.length > 0 && (
                      <div>
                        <p className="font-medium text-[#051A24] mb-1">风险</p>
                        <ul className="list-disc pl-4 space-y-0.5">
                          {detail.aiAnalysis.risks.map((risk, i) => <li key={i}>{risk}</li>)}
                        </ul>
                      </div>
                    )}
                    {detail.aiAnalysis.suggestions && detail.aiAnalysis.suggestions.length > 0 && (
                      <div>
                        <p className="font-medium text-[#051A24] mb-1">建议</p>
                        <ul className="list-disc pl-4 space-y-0.5">
                          {detail.aiAnalysis.suggestions.map((suggestion, i) => <li key={i}>{suggestion}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-[#273C46]/40">尚未执行 AI 分析</p>
                )}
              </div>

              {/* Review form */}
              <div className="mt-5 border-t border-[rgba(0,0,0,0.06)] pt-5">
                <p className="text-xs font-medium text-[#273C46]/60 mb-3">审阅批注与完成度</p>
                <div className="grid grid-cols-1 md:grid-cols-[1fr_160px] gap-3 mb-3">
                  <textarea
                    value={reviewNote}
                    onChange={e => setReviewNote(e.target.value)}
                    rows={2}
                    placeholder="填写审阅批注（可选）"
                    className="w-full px-4 py-2.5 rounded-2xl border border-[rgba(0,0,0,0.08)] bg-[#fcfbfa] text-sm text-[#051A24]
                      placeholder:text-[#273C46]/30 resize-none focus:outline-none focus:border-[#051A24]/30 focus:ring-2 focus:ring-[#051A24]/5"
                  />
                  <input
                    value={completionRate}
                    onChange={e => setCompletionRate(e.target.value)}
                    type="number"
                    min={0}
                    max={100}
                    placeholder="完成度 0-100"
                    className="w-full px-4 py-2.5 rounded-2xl border border-[rgba(0,0,0,0.08)] bg-[#fcfbfa] text-sm text-[#051A24]
                      placeholder:text-[#273C46]/30 focus:outline-none focus:border-[#051A24]/30 focus:ring-2 focus:ring-[#051A24]/5"
                  />
                </div>
                <button
                  onClick={handleReview}
                  disabled={reviewing || detail.status === 'draft'}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  {reviewing ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  {detail.status === 'reviewed' ? '更新审阅' : '标记已审阅'}
                </button>
                {detail.status === 'draft' && (
                  <span className="ml-3 text-xs text-[#273C46]/40">草稿状态下暂不可审阅</span>
                )}
                {detail.reviewedAt && (
                  <p className="mt-3 text-[11px] text-[#273C46]/40">已于 {detail.reviewedAt?.replace('T', ' ').slice(0, 16)} 审阅</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[#f7f5f1] px-3 py-2">
      <p className="text-[10px] font-medium text-[#273C46]/40 mb-0.5">{label}</p>
      <p className="text-xs text-[#051A24] truncate">{value}</p>
    </div>
  )
}

function ContentBlock({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-[#273C46]/50 mb-1">{label}</p>
      <p className="text-sm leading-6 text-[#0D212C] whitespace-pre-wrap rounded-xl bg-[#fcfbfa] border border-[rgba(0,0,0,0.04)] px-3.5 py-2.5">
        {value || '（未填写）'}
      </p>
    </div>
  )
}
