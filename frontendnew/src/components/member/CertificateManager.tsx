import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  Trophy, Plus, Trash2, Edit3, X,
  Award, Building, Calendar, Tag, ScanText, LoaderCircle, GraduationCap,
} from 'lucide-react'
import MemberLayout from './MemberLayout'
import {
  memberListCertificates, memberCreateCertificate,
  memberUpdateCertificate, memberDeleteCertificate,
  memberUploadCertificateImage, memberRunCertificateOcr,
  memberRunCertificateOcrImages,
  type MemberProfile, type CertificateData,
} from '../../services/memberApi'
import { useToast } from '../admin/Toast'

const LEVELS = [
  { value: 'national', label: '国家级' },
  { value: 'provincial', label: '省级' },
  { value: 'school', label: '校级' },
  { value: 'other', label: '其他' },
]

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  pending: { label: '待审核', cls: 'bg-amber-50 text-amber-700' },
  verified: { label: '已认证', cls: 'bg-emerald-50 text-emerald-700' },
  rejected: { label: '已驳回', cls: 'bg-red-50 text-red-700' },
}

/* ═══════════════════════════════════════════════════════════════ */

export default function CertificateManager({ member }: { member: MemberProfile }) {
  const { toast } = useToast()
  const [certs, setCerts] = useState<CertificateData[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<CertificateData | null>(null)
  const [uploading, setUploading] = useState(false)
  const [ocrPendingIds, setOcrPendingIds] = useState<Set<number>>(() => new Set())
  const [expandedOcrId, setExpandedOcrId] = useState<number | null>(null)
  const [modalOcrScanning, setModalOcrScanning] = useState(false)
  const [modalOcrText, setModalOcrText] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Form state
  const [name, setName] = useState('')
  const [level, setLevel] = useState('other')
  const [category, setCategory] = useState('')
  const [winner, setWinner] = useState('')
  const [issuer, setIssuer] = useState('')
  const [advisor, setAdvisor] = useState('')
  const [date, setDate] = useState('')
  const [description, setDescription] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [confirmDelete, setConfirmDelete] = useState<CertificateData | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const data = await memberListCertificates().catch(() => [])
    setCerts(data)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  /* ── Modal helpers ── */
  const openCreate = () => {
    setEditing(null)
    setName(''); setLevel('other'); setCategory(''); setWinner(member.name || '')
    setIssuer(''); setAdvisor(''); setDate(''); setDescription(''); setImages([]); setModalOcrText('')
    setShowModal(true)
  }

  const openEdit = (c: CertificateData) => {
    setEditing(c)
    setName(c.name); setLevel(c.level || 'other'); setCategory(c.category || '')
    setWinner(c.winner || ''); setIssuer(c.issuer || ''); setAdvisor(c.advisor || ''); setDate(c.date || '')
    setDescription(c.description || ''); setImages(c.images || [])
    setModalOcrText(c.ocrText || '')
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!name.trim()) { toast('warning', '请填写证书名称'); return }
    try {
      const payload = { name: name.trim(), level, category, winner, issuer, advisor, date, description, images }
      if (editing) {
        await memberUpdateCertificate(editing.id, payload)
        toast('success', '证书已更新')
      } else {
        await memberCreateCertificate(payload)
        toast('success', '证书已添加')
      }
      setShowModal(false)
      load()
    } catch (e: unknown) { toast('error', (e as Error).message) }
  }

  const handleDelete = async () => {
    if (!confirmDelete) return
    try {
      await memberDeleteCertificate(confirmDelete.id)
      toast('success', `已删除证书「${confirmDelete.name}」`)
      setConfirmDelete(null)
      load()
    } catch (e: unknown) { toast('error', (e as Error).message) }
  }

  const handleOcr = async (certificate: CertificateData) => {
    if (!certificate.images?.length) {
      toast('warning', '请先上传证书图片，再进行文字识别')
      return
    }
    setOcrPendingIds(ids => {
      const next = new Set(ids)
      next.add(certificate.id)
      return next
    })
    try {
      const result = await memberRunCertificateOcr(certificate.id)
      setCerts(items => items.map(item => item.id === certificate.id ? result.certificate : item))
      setExpandedOcrId(certificate.id)
      toast('success', '证书文字识别完成')
    } catch (error: unknown) {
      toast('error', (error as Error).message)
    } finally {
      setOcrPendingIds(ids => {
        const next = new Set(ids)
        next.delete(certificate.id)
        return next
      })
    }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const { url } = await memberUploadCertificateImage(file)
      setImages(prev => [...prev, url])
      toast('success', '证书图片已上传')
    } catch (err: unknown) { toast('error', (err as Error).message) }
    finally { setUploading(false); e.target.value = '' }
  }

  const handleModalOcr = async () => {
    if (!images.length) { toast('warning', '请先上传证书图片'); return }
    setModalOcrScanning(true)
    setModalOcrText('')
    try {
      const result = await memberRunCertificateOcrImages(images)
      const fields = result.ocrFields || {}
      if (fields.name) setName(fields.name)
      if (fields.level && LEVELS.some(l => l.value === fields.level)) setLevel(fields.level)
      if (fields.category) setCategory(fields.category)
      if (fields.winner) setWinner(fields.winner)
      if (fields.issuer) setIssuer(fields.issuer)
      if (fields.advisor) setAdvisor(fields.advisor)
      if (fields.date) setDate(fields.date)
      if (fields.description) setDescription(fields.description)
      setModalOcrText(result.ocrText || '')
      if (fields.name || fields.issuer || fields.date || fields.level) {
        toast('success', '已自动识别并填充证书信息，请核对后保存')
      } else {
        toast('warning', '未能自动提取证书字段，请手动填写')
      }
    } catch (error: unknown) {
      toast('error', (error as Error).message)
    } finally {
      setModalOcrScanning(false)
    }
  }

  const recognizedCount = (c: CertificateData) =>
    [c.ocrFields?.name, c.ocrFields?.issuer, c.ocrFields?.date, c.ocrFields?.level]
      .filter(Boolean).length

  return (
    <MemberLayout member={member}>
      <div className="animate-fade-in-up">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-[28px] font-medium text-[#051A24] tracking-tight"
              style={{ fontFamily: "var(--font-sans)", fontWeight: 500 }}>
              证书管理
            </h1>
            <p className="text-sm text-[#273C46]/50 mt-1">{certs.length} 个证书记录</p>
          </div>
          <button onClick={openCreate}
            className="btn-primary text-sm px-5 py-2.5 flex items-center gap-2 shadow-lg shadow-[#051A24]/10">
            <Plus className="w-4 h-4" /> 添加证书
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="card p-5 animate-pulse" style={{ borderRadius: 24 }}>
                <div className="h-32 bg-[#f0ece6] rounded-2xl mb-4" />
                <div className="h-5 w-32 bg-[#f0ece6] rounded-lg mb-2" />
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
            <p className="text-xs text-[#273C46]/30 mt-1">上传你的竞赛证书和获奖记录</p>
            <button onClick={openCreate} className="btn-primary text-xs px-5 py-2.5 mt-4">添加第一份证书</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {certs.map(c => {
              const st = STATUS_MAP[c.status] || STATUS_MAP.pending
              const ocrResultId = `certificate-ocr-result-${c.id}`
              return (
                <div key={c.id} className="card overflow-hidden group" style={{ borderRadius: 24 }}>
                  {/* Image */}
                  <div className="relative h-40 bg-gradient-to-br from-[#f0ece6] to-[#e8e4dc]">
                    {c.images?.[0]
                      ? <img src={c.images[0]} alt="" className="w-full h-full object-cover" />
                      : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Award className="w-10 h-10 text-[#273C46]/15" />
                        </div>
                      )}
                    <span className={`absolute top-3 right-3 text-[10px] font-medium rounded-full px-2.5 py-1 ${st.cls}`}>
                      {st.label}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="p-5">
                    <h3 className="text-sm font-semibold text-[#051A24] line-clamp-2 mb-2">{c.name}</h3>
                    <div className="space-y-1.5 mb-3">
                      {c.level && (
                        <div className="flex items-center gap-1.5 text-[11px] text-[#273C46]/50">
                          <Tag className="w-3 h-3" />
                          {LEVELS.find(l => l.value === c.level)?.label || c.level}
                        </div>
                      )}
                      {c.issuer && (
                        <div className="flex items-center gap-1.5 text-[11px] text-[#273C46]/50">
                          <Building className="w-3 h-3" />
                          {c.issuer}
                        </div>
                      )}
                      {c.advisor && (
                        <div className="flex items-center gap-1.5 text-[11px] text-[#273C46]/50">
                          <GraduationCap className="w-3 h-3" />
                          指导教师：{c.advisor}
                        </div>
                      )}
                      {c.date && (
                        <div className="flex items-center gap-1.5 text-[11px] text-[#273C46]/50">
                          <Calendar className="w-3 h-3" />
                          {c.date}
                        </div>
                      )}
                    </div>

                    {c.ocrText && (
                      <div className="mt-3 border-t border-[rgba(0,0,0,0.03)] pt-3">
                        {recognizedCount(c) > 0 && (
                          <p className="text-[11px] text-emerald-700/70 mb-1">
                            AI 已识别 {recognizedCount(c)} 项字段
                          </p>
                        )}
                        <button
                          onClick={() => setExpandedOcrId(id => id === c.id ? null : c.id)}
                          aria-expanded={expandedOcrId === c.id}
                          aria-controls={ocrResultId}
                          className="text-xs text-[#273C46]/60 hover:text-[#051A24]"
                        >
                          {expandedOcrId === c.id ? '收起识别结果' : '查看识别结果'}
                        </button>
                        <div id={ocrResultId}>
                          {expandedOcrId === c.id && <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-[#273C46]/60">{c.ocrText}</p>}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-0.5 pt-3 border-t border-[rgba(0,0,0,0.03)]">
                      <button
                        onClick={() => handleOcr(c)}
                        disabled={ocrPendingIds.has(c.id) || !c.images?.length}
                        aria-label={c.images?.length ? (c.ocrText ? '重新识别证书文字' : '识别证书文字') : '请先上传证书图片'}
                        aria-busy={ocrPendingIds.has(c.id)}
                        title={c.images?.length ? (c.ocrText ? '重新识别文字' : '识别证书文字') : '请先上传证书图片'}
                        className={`p-2 rounded-xl hover:bg-[rgba(0,0,0,0.04)] text-[#273C46]/40 hover:text-[#051A24] transition-all disabled:opacity-40 ${!c.images?.length ? 'opacity-40' : ''}`}
                      >
                        {ocrPendingIds.has(c.id) ? <LoaderCircle className="w-3.5 h-3.5 animate-spin" /> : <ScanText className="w-3.5 h-3.5" />}
                      </button>
                      {!c.images?.length && (
                        <p className="ml-1 text-xs text-[#273C46]/70">请先上传证书图片后再识别</p>
                      )}
                      <button onClick={() => openEdit(c)}
                        className="p-2 rounded-xl hover:bg-[rgba(0,0,0,0.04)] text-[#273C46]/40 hover:text-[#051A24] transition-all"
                        title="编辑">
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setConfirmDelete(c)}
                        className="p-2 rounded-xl hover:bg-red-50 text-[#273C46]/30 hover:text-red-500 transition-all"
                        title="删除">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── Create/Edit Modal ── */}
        {showModal && createPortal((
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
            <div
              className="relative bg-white rounded-[28px] shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 z-10"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-medium text-[#051A24]"
                  style={{ fontFamily: "var(--font-sans)", fontWeight: 500 }}>
                  {editing ? '编辑证书' : '添加证书'}
                </h2>
                <button onClick={() => setShowModal(false)} className="p-1.5 rounded-xl hover:bg-[rgba(0,0,0,0.04)] text-[#273C46]/50">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Image upload area */}
                <div>
                  <label className="block text-xs font-medium text-[#273C46]/60 mb-1.5 ml-1">证书图片</label>
                  <div className="flex gap-2 flex-wrap mb-2">
                    {images.map((url, i) => (
                      <div key={i} className="relative w-16 h-16 rounded-xl overflow-hidden border border-[rgba(0,0,0,0.06)]">
                        <img src={url} alt="" className="w-full h-full object-cover" />
                        <button onClick={() => setImages(prev => prev.filter((_, j) => j !== i))}
                          className="absolute top-0.5 right-0.5 p-0.5 rounded-lg bg-black/40 text-white">
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="w-16 h-16 rounded-xl border-2 border-dashed border-[rgba(0,0,0,0.1)]
                        flex items-center justify-center hover:border-[#051A24]/30 transition-colors disabled:opacity-50"
                    >
                      {uploading
                        ? <div className="w-4 h-4 border-2 border-[#051A24]/20 border-t-[#051A24] rounded-full animate-spin" />
                        : <Plus className="w-4 h-4 text-[#273C46]/25" />
                      }
                    </button>
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <button
                      onClick={handleModalOcr}
                      disabled={modalOcrScanning || !images.length}
                      className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition-all
                        ${images.length
                          ? 'bg-[#051A24] text-white hover:opacity-90'
                          : 'bg-[#f0ece6] text-[#273C46]/40 cursor-not-allowed'}`}
                    >
                      {modalOcrScanning
                        ? <LoaderCircle className="w-3.5 h-3.5 animate-spin" />
                        : <ScanText className="w-3.5 h-3.5" />}
                      {modalOcrScanning ? '识别中...' : 'AI 识别并自动填充'}
                    </button>
                    {!images.length && (
                      <span className="text-[11px] text-[#273C46]/40">上传证书图片后可使用智能识别</span>
                    )}
                  </div>
                  {modalOcrText && (
                    <div className="mt-2 rounded-xl bg-[#f7f5f1] px-3 py-2">
                      <p className="text-[10px] font-medium text-[#273C46]/40 mb-1">识别原文</p>
                      <p className="text-xs leading-5 text-[#273C46]/60 whitespace-pre-wrap max-h-24 overflow-y-auto">{modalOcrText}</p>
                    </div>
                  )}
                </div>

                <Field label="证书名称 *">
                  <input value={name} onChange={e => setName(e.target.value)} placeholder="如：ICPC 亚洲区银奖"
                    className="w-full px-4 py-2.5 rounded-2xl border border-[rgba(0,0,0,0.08)] bg-[#fcfbfa] text-sm text-[#051A24] placeholder:text-[#273C46]/25 focus:outline-none focus:border-[#051A24]/30 focus:ring-2 focus:ring-[#051A24]/5" />
                </Field>

                <div className="grid grid-cols-2 gap-4">
                  <Field label="级别">
                    <select value={level} onChange={e => setLevel(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-2xl border border-[rgba(0,0,0,0.08)] bg-[#fcfbfa] text-sm text-[#051A24] focus:outline-none focus:border-[#051A24]/30">
                      {LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                    </select>
                  </Field>
                  <Field label="分类">
                    <input value={category} onChange={e => setCategory(e.target.value)} placeholder="程序设计"
                      className="w-full px-4 py-2.5 rounded-2xl border border-[rgba(0,0,0,0.08)] bg-[#fcfbfa] text-sm text-[#051A24] placeholder:text-[#273C46]/25 focus:outline-none focus:border-[#051A24]/30 focus:ring-2 focus:ring-[#051A24]/5" />
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Field label="获奖者">
                    <input value={winner} onChange={e => setWinner(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-2xl border border-[rgba(0,0,0,0.08)] bg-[#fcfbfa] text-sm text-[#051A24] placeholder:text-[#273C46]/25 focus:outline-none focus:border-[#051A24]/30 focus:ring-2 focus:ring-[#051A24]/5" />
                  </Field>
                  <Field label="日期">
                    <input value={date} onChange={e => setDate(e.target.value)} placeholder="2025-12"
                      className="w-full px-4 py-2.5 rounded-2xl border border-[rgba(0,0,0,0.08)] bg-[#fcfbfa] text-sm text-[#051A24] placeholder:text-[#273C46]/25 focus:outline-none focus:border-[#051A24]/30 focus:ring-2 focus:ring-[#051A24]/5" />
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Field label="颁发机构">
                    <input value={issuer} onChange={e => setIssuer(e.target.value)} placeholder="中国计算机学会"
                      className="w-full px-4 py-2.5 rounded-2xl border border-[rgba(0,0,0,0.08)] bg-[#fcfbfa] text-sm text-[#051A24] placeholder:text-[#273C46]/25 focus:outline-none focus:border-[#051A24]/30 focus:ring-2 focus:ring-[#051A24]/5" />
                  </Field>
                  <Field label="指导教师">
                    <input value={advisor} onChange={e => setAdvisor(e.target.value)} placeholder="如：张教授（没有可不填）"
                      className="w-full px-4 py-2.5 rounded-2xl border border-[rgba(0,0,0,0.08)] bg-[#fcfbfa] text-sm text-[#051A24] placeholder:text-[#273C46]/25 focus:outline-none focus:border-[#051A24]/30 focus:ring-2 focus:ring-[#051A24]/5" />
                  </Field>
                </div>

                <Field label="描述">
                  <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
                    placeholder="简要描述..."
                    className="w-full px-4 py-2.5 rounded-2xl border border-[rgba(0,0,0,0.08)] bg-[#fcfbfa] text-sm text-[#051A24] placeholder:text-[#273C46]/25 resize-none focus:outline-none focus:border-[#051A24]/30 focus:ring-2 focus:ring-[#051A24]/5" />
                </Field>

                <button onClick={handleSave}
                  className="btn-primary w-full py-3 text-sm font-medium shadow-lg shadow-[#051A24]/10">
                  {editing ? '保存修改' : '添加证书'}
                </button>
              </div>
            </div>
          </div>
        ), document.body)}

        {/* Delete confirm dialog */}
        {confirmDelete && createPortal((
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setConfirmDelete(null)}>
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
            <div className="relative bg-white rounded-[28px] shadow-2xl w-full max-w-sm p-6 z-10 text-center" onClick={e => e.stopPropagation()}>
              <h3 className="text-base font-medium text-[#051A24] mb-2">删除证书</h3>
              <p className="text-sm text-[#273C46]/60 mb-6">确定要删除「{confirmDelete.name}」吗？此操作不可撤销。</p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmDelete(null)}
                  className="flex-1 py-2.5 rounded-2xl border border-[rgba(0,0,0,0.08)] text-sm text-[#273C46]/70 hover:bg-[#fcfbfa] transition-all">
                  取消
                </button>
                <button onClick={handleDelete}
                  className="flex-1 py-2.5 rounded-2xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-all">
                  删除
                </button>
              </div>
            </div>
          </div>
        ), document.body)}
      </div>
    </MemberLayout>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-[#273C46]/60 mb-1.5 ml-1">{label}</label>
      {children}
    </div>
  )
}
