import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  Trophy, Search, CheckCircle2, XCircle, Eye, Building, Calendar,
  User, Tag, ScanText, LoaderCircle, X, ChevronDown, ExternalLink,
} from 'lucide-react'
import AdminLayout from './AdminLayout'
import {
  adminListCertificates, adminReviewCertificate,
  type AdminCertificate,
} from '../../services/adminApi'
import { useToast } from './Toast'

const LEVELS: Record<string, string> = {
  national: '国家级',
  provincial: '省级',
  school: '校级',
  other: '其他',
}

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  pending: { label: '待审核', cls: 'bg-amber-50 text-amber-700' },
  verified: { label: '已认证', cls: 'bg-emerald-50 text-emerald-700' },
  rejected: { label: '已驳回', cls: 'bg-red-50 text-red-700' },
}

const TABS = [
  { value: '', label: '全部' },
  { value: 'pending', label: '待审核' },
  { value: 'verified', label: '已认证' },
  { value: 'rejected', label: '已驳回' },
]

type ReviewAction = 'verified' | 'rejected'

export default function AdminCertificates() {
  const { toast } = useToast()
  const [certs, setCerts] = useState<AdminCertificate[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [expandedOcrId, setExpandedOcrId] = useState<number | null>(null)
  const [detail, setDetail] = useState<AdminCertificate | null>(null)
  const [reviewTarget, setReviewTarget] = useState<{ cert: AdminCertificate; action: ReviewAction } | null>(null)
  const [reviewNote, setReviewNote] = useState('')
  const [reviewing, setReviewing] = useState(false)

  const load = useCallback(async (statusValue = status, searchValue = search) => {
    setLoading(true)
    const params: Record<string, string> = {}
    if (statusValue) params.status = statusValue
    if (searchValue.trim()) params.search = searchValue.trim()
    const data = await adminListCertificates(params).catch(() => [])
    setCerts(data)
    setLoading(false)
  }, [status, search])

  useEffect(() => { load() }, [load])

  const openReview = (cert: AdminCertificate, action: ReviewAction) => {
    setReviewTarget({ cert, action })
    setReviewNote(cert.reviewNote || '')
  }

  const confirmReview = async () => {
    if (!reviewTarget) return
    setReviewing(true)
    try {
      const { award } = await adminReviewCertificate(reviewTarget.cert.id, {
        status: reviewTarget.action,
        reviewNote: reviewNote.trim() || undefined,
      })
      toast(
        'success',
        reviewTarget.action === 'verified'
          ? (award ? `已通过并归档为成果「${award.name}」` : '证书已通过')
          : '证书已驳回',
      )
      setReviewTarget(null)
      load()
    } catch (error: unknown) {
      toast('error', (error as Error).message)
    } finally {
      setReviewing(false)
    }
  }

  const recognizedFields = (cert: AdminCertificate) => {
    const fields = cert.ocrFields || {}
    return ([
      fields.name && { label: '名称', value: fields.name },
      fields.issuer && { label: '机构', value: fields.issuer },
      fields.date && { label: '时间', value: fields.date },
      fields.level && { label: '等级', value: LEVELS[fields.level] || fields.level },
      fields.winner && { label: '获奖人', value: fields.winner },
    ].filter(Boolean) as { label: string; value: string }[])
  }

  return (
    <AdminLayout>
      <div className="animate-fade-in-up">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-[28px] font-medium text-[#051A24] tracking-tight"
              style={{ fontFamily: "'PP Neue Montreal', 'Noto Sans SC', sans-serif", fontWeight: 500 }}>
              证书审核
            </h1>
            <p className="text-sm text-[#273C46]/50 mt-1">
              审核成员提交的证书，通过后自动归档至实验室成果库
            </p>
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex flex-col md:flex-row md:items-center gap-3 mb-5">
          <div className="flex gap-1.5 flex-wrap">
            {TABS.map(tab => (
              <button
                key={tab.value}
                onClick={() => { setStatus(tab.value); load(tab.value, search) }}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all
                  ${status === tab.value
                    ? 'bg-[#051A24] text-white shadow-sm'
                    : 'bg-white text-[#273C46]/60 border border-[rgba(0,0,0,0.06)] hover:text-[#051A24]'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="relative md:ml-auto md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#273C46]/30" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') load(status, search) }}
              placeholder="搜索证书/获奖者/机构"
              className="w-full pl-9 pr-3 py-2 rounded-2xl border border-[rgba(0,0,0,0.08)] bg-white text-sm text-[#051A24]
                placeholder:text-[#273C46]/30 focus:outline-none focus:border-[#051A24]/30 focus:ring-2 focus:ring-[#051A24]/5"
            />
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="card p-5 animate-pulse" style={{ borderRadius: 24 }}>
                <div className="h-36 bg-[#f0ece6] rounded-2xl mb-4" />
                <div className="h-5 w-3/4 bg-[#f0ece6] rounded-lg mb-2" />
                <div className="h-3 w-full bg-[#f0ece6] rounded-md" />
              </div>
            ))}
          </div>
        ) : certs.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#f0ece6] flex items-center justify-center mb-4">
              <Trophy className="w-7 h-7 text-[#273C46]/20" />
            </div>
            <p className="text-sm text-[#273C46]/50">暂无证书记录</p>
            <p className="text-xs text-[#273C46]/30 mt-1">成员提交的证书会显示在这里</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {certs.map(cert => {
              const st = STATUS_MAP[cert.status] || STATUS_MAP.pending
              const fields = recognizedFields(cert)
              return (
                <div key={cert.id} className="card overflow-hidden flex flex-col" style={{ borderRadius: 24 }}>
                  {/* Image */}
                  <div className="relative h-36 bg-gradient-to-br from-[#f0ece6] to-[#e8e4dc]">
                    {cert.images?.[0]
                      ? <img src={cert.images[0]} alt="" className="w-full h-full object-cover" />
                      : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Trophy className="w-10 h-10 text-[#273C46]/15" />
                        </div>
                      )}
                    <span className={`absolute top-3 right-3 text-[10px] font-medium rounded-full px-2.5 py-1 ${st.cls}`}>
                      {st.label}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="p-5 flex-1 flex flex-col">
                    <h3 className="text-sm font-semibold text-[#051A24] line-clamp-2 mb-2">{cert.name}</h3>
                    <div className="space-y-1.5 mb-3">
                      {cert.memberName && (
                        <div className="flex items-center gap-1.5 text-[11px] text-[#273C46]/50">
                          <User className="w-3 h-3" /> {cert.memberName}
                        </div>
                      )}
                      {cert.level && (
                        <div className="flex items-center gap-1.5 text-[11px] text-[#273C46]/50">
                          <Tag className="w-3 h-3" /> {LEVELS[cert.level] || cert.level}
                        </div>
                      )}
                      {cert.issuer && (
                        <div className="flex items-center gap-1.5 text-[11px] text-[#273C46]/50">
                          <Building className="w-3 h-3" /> {cert.issuer}
                        </div>
                      )}
                      {cert.date && (
                        <div className="flex items-center gap-1.5 text-[11px] text-[#273C46]/50">
                          <Calendar className="w-3 h-3" /> {cert.date}
                        </div>
                      )}
                    </div>

                    {fields.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {fields.map(f => (
                          <span key={f.label} title={`${f.label}：${f.value}`}
                            className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700/80">
                            {f.label}：{f.value}
                          </span>
                        ))}
                      </div>
                    )}

                    {cert.ocrText && (
                      <div className="mt-auto">
                        <button
                          onClick={() => setExpandedOcrId(id => id === cert.id ? null : cert.id)}
                          className="inline-flex items-center gap-1 text-xs text-[#273C46]/60 hover:text-[#051A24] mb-2"
                        >
                          <ScanText className="w-3 h-3" />
                          {expandedOcrId === cert.id ? '收起识别原文' : '查看识别原文'}
                          <ChevronDown className={`w-3 h-3 transition-transform ${expandedOcrId === cert.id ? 'rotate-180' : ''}`} />
                        </button>
                        {expandedOcrId === cert.id && (
                          <p className="mb-3 text-xs leading-5 text-[#273C46]/60 whitespace-pre-wrap max-h-28 overflow-y-auto rounded-xl bg-[#f7f5f1] px-3 py-2">
                            {cert.ocrText}
                          </p>
                        )}
                      </div>
                    )}

                    {cert.reviewNote && (
                      <p className="mb-3 text-[11px] text-[#273C46]/50 bg-[#f7f5f1] rounded-xl px-3 py-2">
                        审核批注：{cert.reviewNote}
                      </p>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-3 border-t border-[rgba(0,0,0,0.04)] mt-auto">
                      <button
                        onClick={() => setDetail(cert)}
                        className="p-2 rounded-xl hover:bg-[rgba(0,0,0,0.04)] text-[#273C46]/40 hover:text-[#051A24] transition-all"
                        title="查看详情"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {cert.status !== 'verified' && (
                        <>
                          <button
                            onClick={() => openReview(cert, 'verified')}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-medium hover:bg-emerald-100 transition-all"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" /> 通过并归档
                          </button>
                          <button
                            onClick={() => openReview(cert, 'rejected')}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-xl bg-red-50 text-red-600 text-xs font-medium hover:bg-red-100 transition-all"
                          >
                            <XCircle className="w-3.5 h-3.5" /> 驳回
                          </button>
                        </>
                      )}
                      {cert.status === 'verified' && (
                        <a href="/admin/awards" className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-xl bg-[#f0ece6] text-[#273C46]/60 text-xs font-medium hover:bg-[#e8e4dc] transition-all">
                          已归档至成果库 <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Detail modal ── */}
        {detail && createPortal((
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setDetail(null)}>
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
            <div className="relative bg-white rounded-[28px] shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 z-10"
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-medium text-[#051A24]">证书详情</h2>
                <button onClick={() => setDetail(null)} className="p-1.5 rounded-xl hover:bg-[rgba(0,0,0,0.04)] text-[#273C46]/50">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-3 text-sm">
                <DetailRow label="证书名称" value={detail.name} />
                <DetailRow label="提交成员" value={detail.memberName || '-'} />
                <DetailRow label="获奖人" value={detail.winner || '-'} />
                <DetailRow label="等级" value={detail.level ? (LEVELS[detail.level] || detail.level) : '-'} />
                <DetailRow label="类别" value={detail.category || '-'} />
                <DetailRow label="颁发机构" value={detail.issuer || '-'} />
                <DetailRow label="获奖时间" value={detail.date || '-'} />
                <DetailRow label="关联项目" value={detail.relatedProject || '-'} />
                <DetailRow label="审核状态" value={STATUS_MAP[detail.status]?.label || detail.status} />
                {detail.ocrText && (
                  <div>
                    <p className="text-xs font-medium text-[#273C46]/60 mb-1">识别原文</p>
                    <p className="text-xs leading-5 text-[#273C46]/70 whitespace-pre-wrap bg-[#f7f5f1] rounded-xl px-3 py-2">{detail.ocrText}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ), document.body)}

        {/* ── Review modal ── */}
        {reviewTarget && createPortal((
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setReviewTarget(null)}>
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
            <div className="relative bg-white rounded-[28px] shadow-2xl w-full max-w-md p-6 z-10"
              onClick={e => e.stopPropagation()}>
              <h3 className="text-base font-medium text-[#051A24] mb-1">
                {reviewTarget.action === 'verified' ? '通过并归档证书' : '驳回证书'}
              </h3>
              <p className="text-sm text-[#273C46]/50 mb-4">「{reviewTarget.cert.name}」</p>
              <textarea
                value={reviewNote}
                onChange={e => setReviewNote(e.target.value)}
                rows={3}
                placeholder={reviewTarget.action === 'verified' ? '审核批注（可选）' : '驳回原因（可选，将通知成员）'}
                className="w-full px-4 py-2.5 rounded-2xl border border-[rgba(0,0,0,0.08)] bg-[#fcfbfa] text-sm text-[#051A24]
                  placeholder:text-[#273C46]/30 resize-none focus:outline-none focus:border-[#051A24]/30 focus:ring-2 focus:ring-[#051A24]/5"
              />
              <div className="flex gap-3 mt-5">
                <button onClick={() => setReviewTarget(null)}
                  className="flex-1 py-2.5 rounded-2xl border border-[rgba(0,0,0,0.08)] text-sm text-[#273C46]/70 hover:bg-[#fcfbfa] transition-all">
                  取消
                </button>
                <button
                  onClick={confirmReview}
                  disabled={reviewing}
                  className={`flex-1 py-2.5 rounded-2xl text-white text-sm font-medium transition-all disabled:opacity-50
                    ${reviewTarget.action === 'verified' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-500 hover:bg-red-600'}`}
                >
                  {reviewing ? <LoaderCircle className="w-4 h-4 mx-auto animate-spin" /> : '确认'}
                </button>
              </div>
            </div>
          </div>
        ), document.body)}
      </div>
    </AdminLayout>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-xs text-[#273C46]/50 shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-[#051A24] text-right break-all">{value}</span>
    </div>
  )
}
