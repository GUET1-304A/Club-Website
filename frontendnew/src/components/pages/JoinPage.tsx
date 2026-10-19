import { useRef, useState } from 'react'
import Button from '../ui/Button'
import LunarBoardingPass from '../ui/lunar-boarding-pass'
import { submitApplication, queryApplicationStatus, type ApplicationStatusResult } from '../../services/api'

const groups = [
  { name: '流光组（产品策划）', code: 'PRODUCT', short: '产品策划' },
  { name: '星绘组（视觉设计）', code: 'DESIGN', short: '视觉设计' },
  { name: '逐云组（技术开发）', code: 'DEV', short: '技术开发' },
  { name: '拾焰组（内容运营）', code: 'CONTENT', short: '内容运营' },
]

const STATUS_META = {
  pending: { label: '待审核', code: 'PENDING', color: '#f0b429' },
  approved: { label: '已通过', code: 'APPROVED', color: '#3ddc97' },
  rejected: { label: '未通过', code: 'REJECTED', color: '#ff8b80' },
} as const

function statusHint(status: ApplicationStatusResult['status']): string {
  if (status === 'approved') return '欢迎加入，等待后续通知'
  if (status === 'rejected') return '如有疑问请联系社团'
  return '资料已收到，等待审核'
}

const EMPTY_FORM = {
  name: '', studentId: '', grade: '', email: '', phone: '',
  group: '', motivation: '', portfolio: '',
}

type ApplicationForm = typeof EMPTY_FORM

export default function JoinPage() {
  const [form, setForm] = useState<ApplicationForm>(EMPTY_FORM)
  const [errors, setErrors] = useState<Partial<Record<keyof ApplicationForm, string>>>({})
  const [errorSummary, setErrorSummary] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [applicationId, setApplicationId] = useState<number | null>(null)

  const [statusForm, setStatusForm] = useState({ studentId: '', phone: '' })
  const [statusResult, setStatusResult] = useState<ApplicationStatusResult | null>(null)
  const [statusError, setStatusError] = useState('')
  const [statusLoading, setStatusLoading] = useState(false)
  const [showStatusPanel, setShowStatusPanel] = useState(false)
  const statusRef = useRef<HTMLDivElement>(null)

  const selectedGroup = groups.find(group => group.name === form.group)
  const seat = form.studentId.replace(/\D/g, '').slice(-2) || '01'
  const statusMeta = statusResult ? STATUS_META[statusResult.status] : null

  const update = (field: keyof ApplicationForm, value: string) => {
    setForm(current => ({ ...current, [field]: value }))
    setErrors(current => ({ ...current, [field]: undefined }))
    setErrorSummary('')
    setSubmitError('')
    setStatusResult(null)
  }

  const validate = () => {
    const next: Partial<Record<keyof ApplicationForm, string>> = {}
    if (form.name.trim().length < 2) next.name = '请填写姓名'
    if (!/^\d{6,12}$/.test(form.studentId.trim())) next.studentId = '学号需 6-12 位数字'
    if (!form.grade.trim()) next.grade = '请填写年级专业'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = '邮箱格式不正确'
    if (!/^\d{11}$/.test(form.phone.trim())) next.phone = '手机号需 11 位数字'
    if (!form.group) next.group = '请选择意向方向'
    if (form.motivation.trim().length < 10) next.motivation = '申请动机至少 10 个字'
    setErrors(next)
    const messages = Object.values(next).filter(Boolean)
    setErrorSummary(messages.length ? messages.join('；') : '')
    return messages.length === 0
  }

  const handleSubmit = async () => {
    if (submitting || submitted) return
    if (!validate()) return
    setSubmitting(true)
    setSubmitError('')
    try {
      const studentId = form.studentId.trim()
      const contact = form.phone.trim()
      const result = await submitApplication({
        name: form.name.trim(),
        student_id: studentId,
        grade_major: form.grade.trim(),
        phone: contact,
        email: form.email.trim(),
        group_id: form.group,
        group_name: form.group,
        motivation: form.motivation.trim(),
        portfolio_url: form.portfolio.trim() || undefined,
          })
      setApplicationId(result.id)
      setSubmitted(true)
      setStatusForm({ studentId, phone: contact })
      void runStatusQuery(studentId, contact)
    } catch (error: unknown) {
      setSubmitError(error instanceof Error ? error.message : '提交失败，请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  const toggleStatusPanel = () => {
    setShowStatusPanel(current => {
      const next = !current
      if (next) window.setTimeout(() => statusRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80)
      return next
    })
  }

  async function runStatusQuery(studentId: string, contact: string) {
    setStatusLoading(true)
    setStatusError('')
    setStatusResult(null)
    try {
      setStatusResult(await queryApplicationStatus(studentId, contact))
    } catch (error: unknown) {
      setStatusError(error instanceof Error ? error.message : '查询失败，请稍后重试')
    } finally {
      setStatusLoading(false)
    }
  }

  const queryStatus = () => {
    const studentId = statusForm.studentId.trim()
    const contact = statusForm.phone.trim()
    if (!studentId || !contact) {
      setStatusError('请输入学号和手机号/邮箱')
      return
    }
    void runStatusQuery(studentId, contact)
  }

  return (
    <div className="page-enter relative z-10 max-w-[1000px] mx-auto px-6 py-20 md:py-24">
      {/* Header */}
      <div className="text-center">
        <p className="font-mono text-xs tracking-[0.3em] uppercase text-[#273C46]/60">Join the crew</p>
        <h1 className="mt-4 text-[36px] md:text-[44px] font-medium text-[#051A24]">
          加入<span className="font-mondwest">我们</span>
        </h1>
        <p className="mt-4 text-sm md:text-base text-[#273C46] leading-relaxed max-w-xl mx-auto">
          填写报名信息，点击票根提交；提交后可在另一面查验审核状态。
        </p>
        <button
          onClick={toggleStatusPanel}
          className="md:hidden mt-4 text-xs font-medium text-[#273C46]/60 hover:text-[#051A24] underline underline-offset-4 transition-colors"
        >
          {showStatusPanel ? '收起状态查询' : '查询报名状态'}
        </button>
      </div>

      {/* Desktop: the ticket itself is the form and the query panel */}
      <div className="hidden md:block mt-10">
        <LunarBoardingPass
          key={submitted ? 'issued' : 'draft'}
          title="星雨作坊"
          tier={statusResult?.status === 'approved' ? 'CREW' : submitted ? 'APPLIED' : 'APPLICANT'}
          date="2026"
          welcome={'加入我们\n一起造点东西'}
          eyebrow={'A pass to\nbuild real things'}
          words={['', '']}
          notes={['学生开发者社群 · 长期招新', '前端 / 后端 / 设计 / 算法 / 产品']}
          passenger={form.name || 'YOUR NAME'}
          from="CAMPUS"
          to={selectedGroup?.code || 'XINGYU'}
          craft={form.studentId || 'STUDENT ID'}
          dateCode="OPEN2026"
          gate="A1"
          group="CREW"
          seat={seat}
          boardingTime="ANYTIME"
          site="GUILIN"
          lat={25.2736}
          lon={110.29}
          seq=""
          featuring={selectedGroup?.name || '前端 · 后端 · 设计 · 算法 · 产品'}
          headline={submitted ? 'Application received' : 'Join the crew'}
          stamp={submitted ? 'APPLIED' : 'PENDING'}
          sideLabels={['查询状态', submitted ? '查看报名' : '填写报名']}
          night="#051A24"
          starInk="#e8eef2"
          paper="#f0ece6"
          paperInk="#0d212c"
          stampColor="#3457ff"
          maxWidth={960}
          defaultSide="back"
          flipOnClick={false}
          tilt={6}
          defaultTorn={submitted}
          stubMode="submit"
          onStubSubmit={handleSubmit}
          stubContent={
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
              <span className="lbp-c" style={{ display: 'block', fontSize: '1.5cqw', paddingBottom: '0.8cqw', borderBottom: '1px solid var(--lbp-rule)' }}>
                {submitted ? 'Submitted' : 'Submit'}
              </span>
              <div>
                <p className="lbp-c" style={{ fontSize: '1.15cqw', lineHeight: 1.35 }}>
                  {submitted ? '报名已提交' : submitting ? '正在提交…' : '确认信息后'}
                  {!submitted && <br />}
                  {!submitted && (submitting ? '请稍候' : '点击提交')}
                </p>
                <p className="lbp-m" style={{ fontSize: '0.72cqw', marginTop: '0.6cqw', opacity: 0.55 }}>
                  {submitted ? `#${applicationId}` : submitting ? 'PLEASE WAIT' : 'CLICK TO BOARD'}
                </p>
              </div>
              <span className="lbp-d" style={{ fontSize: '1.7cqw', alignSelf: 'flex-end' }}>
                {submitted ? '✓' : '→'}
              </span>
            </div>
          }
          backForm={
            <TicketForm
              form={form}
              errors={errors}
              errorSummary={errorSummary || submitError}
              submitting={submitting}
              submitted={submitted}
              onChange={update}
            />
          }
          frontOverlay={
            <TicketQuery
              form={statusForm}
              result={statusResult}
              error={statusError}
              loading={statusLoading}
              onChange={(field, value) => setStatusForm(current => ({ ...current, [field]: value }))}
              onQuery={queryStatus}
            />
          }
        />
      </div>

      {/* Mobile: stacked paper form with the same ticket language */}
      <div className="md:hidden mt-8">
        {submitted ? (
          <div className="rounded-[28px] bg-[#051A24] text-[#F6FCFF] px-6 py-7 shadow-xl">
            <div className="flex items-center justify-between font-mono text-[10px] tracking-[0.24em] text-white/45 uppercase">
              <span>CREW PASS</span>
              <span>APPLIED</span>
            </div>
            <p className="mt-8 text-[32px] leading-[1.05] tracking-tight">{form.name}</p>
            <div className="mt-6 grid grid-cols-3 gap-3 border-t border-dashed border-white/20 pt-5 font-mono text-[10px] uppercase tracking-widest text-white/40">
              <div><span className="block text-white/30">To</span>{selectedGroup?.code || 'XINGYU'}</div>
              <div><span className="block text-white/30">Seat</span>{seat}</div>
              <div><span className="block text-white/30">No.</span>#{applicationId}</div>
            </div>
          </div>
        ) : (
          <MobileForm
            form={form}
            errors={errors}
            errorSummary={errorSummary || submitError}
            submitting={submitting}
            onChange={update}
            onSubmit={handleSubmit}
          />
        )}
      </div>

      {/* Mobile status query */}
      {showStatusPanel && (
        <div ref={statusRef} className="md:hidden mt-8 rounded-[28px] border border-[#0d212c]/10 bg-[#f0ece6]/95 p-6 shadow-lg">
          <div className="flex items-start justify-between gap-4 border-b border-dashed border-[#0d212c]/25 pb-4">
            <div>
              <p className="font-mono text-[10px] tracking-[0.24em] uppercase text-[#0d212c]/45">Pass status</p>
              <h2 className="text-lg font-medium text-[#0d212c] mt-1">查验报名状态</h2>
            </div>
            <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-[#0d212c]/35">Check-in</span>
          </div>
          <div className="grid grid-cols-1 gap-5 mt-5">
            <PaperInput label="学号" value={statusForm.studentId} placeholder="提交申请时的学号" onChange={value => setStatusForm(current => ({ ...current, studentId: value }))} />
            <PaperInput label="手机号" value={statusForm.phone} placeholder="提交申请时的手机号" onChange={value => setStatusForm(current => ({ ...current, phone: value }))} />
          </div>
          {statusError && <p className="text-[11px] text-red-500 mt-3">{statusError}</p>}
          {statusResult && statusMeta && (
            <div className="mt-5 overflow-hidden rounded-2xl border border-[#0d212c]/12 bg-white/65 shadow-sm">
              <div className="flex items-center justify-between border-b border-dashed border-[#0d212c]/15 px-4 py-2 font-mono text-[9px] uppercase tracking-[0.2em] text-[#0d212c]/40">
                <span>Check-in result</span>
                <span>
                  {(statusResult.processed_at || statusResult.created_at)
                    ? new Date(statusResult.processed_at || statusResult.created_at || '').toLocaleDateString('zh-CN')
                    : ''}
                </span>
              </div>
              <div className="flex items-center gap-4 p-4">
                <div className="shrink-0 -rotate-6 rounded-lg border-2 px-3 py-2 text-center" style={{ borderColor: statusMeta.color, color: statusMeta.color }}>
                  <span className="block text-lg font-bold tracking-[0.18em]">{statusMeta.label}</span>
                  <span className="block font-mono text-[8px] tracking-[0.22em] opacity-70">{statusMeta.code}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#0d212c]">{statusResult.group_name || '意向方向待定'}</p>
                  <p className="mt-1 text-xs leading-relaxed text-[#0d212c]/55">
                    {statusResult.admin_note ? `备注：${statusResult.admin_note}` : statusHint(statusResult.status)}
                  </p>
                  {(statusResult.processed_at || statusResult.created_at) && (
                    <p className="mt-1.5 font-mono text-[10px] text-[#0d212c]/35">
                      {statusResult.processed_at ? '处理于 ' : '提交于 '}
                      {new Date(statusResult.processed_at || statusResult.created_at || '').toLocaleString('zh-CN')}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
          <div className="flex justify-end mt-5">
            <Button variant="primary" onClick={queryStatus} disabled={statusLoading}>
              {statusLoading ? '查询中…' : '查询'}
            </Button>
          </div>
        </div>
      )}

      {/* Desktop success note */}
      {submitted && (
        <div className="mt-8 rounded-[24px] border border-emerald-700/15 bg-emerald-50/90 px-6 py-4 text-center">
          <p className="text-sm font-medium text-emerald-900">报名已提交 · 申请编号 #{applicationId}</p>
          <p className="text-xs text-emerald-800/65 mt-1">票面已记名并盖章；切到另一面可查验审核状态。</p>
        </div>
      )}

      {/* Validation / API error banner */}
      {!submitted && (submitError || errorSummary) && (
        <div className="mt-6 rounded-[20px] border border-red-500/20 bg-red-50/95 px-6 py-3 text-center">
          <p className="text-xs text-red-700">{submitError || errorSummary}</p>
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   Ticket back: application form, sized in container-query units
   ═══════════════════════════════════════════════════════════════ */

function TicketForm({ form, errors, errorSummary, submitting, submitted, onChange }: {
  form: ApplicationForm
  errors: Partial<Record<keyof ApplicationForm, string>>
  errorSummary: string
  submitting: boolean
  submitted: boolean
  onChange: (field: keyof ApplicationForm, value: string) => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '0.65cqw' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr 1.2fr', gap: '0.5cqw 1.2cqw' }}>
        <TicketInput label="姓名" value={form.name} error={errors.name} placeholder="你的姓名" readOnly={submitted} onChange={value => onChange('name', value)} />
        <TicketInput label="学号" value={form.studentId} error={errors.studentId} placeholder="6-12 位数字" readOnly={submitted} onChange={value => onChange('studentId', value)} />
        <TicketInput label="年级专业" value={form.grade} error={errors.grade} placeholder="如 2024级 计算机" readOnly={submitted} onChange={value => onChange('grade', value)} />
        <TicketInput label="手机" value={form.phone} error={errors.phone} placeholder="11 位手机号" readOnly={submitted} onChange={value => onChange('phone', value)} />
        <TicketInput label="邮箱" value={form.email} error={errors.email} placeholder="you@example.com" readOnly={submitted} onChange={value => onChange('email', value)} />
        <label style={{ display: 'block', minWidth: 0 }}>
          <span style={{ display: 'block', fontFamily: 'var(--lbp-mono)', fontSize: '0.92cqw', letterSpacing: '0.06em', opacity: 0.55, marginBottom: '0.2cqw', whiteSpace: 'nowrap' }}>
            意向方向
          </span>
          <select
            value={form.group}
            disabled={submitted}
            onChange={event => onChange('group', event.target.value)}
            style={{
              width: '100%', appearance: 'none', background: 'transparent', border: 0,
              borderBottom: `1px solid ${errors.group ? '#b73a32' : 'rgba(13,33,44,.3)'}`,
              padding: '0.2cqw 0', fontSize: '1.38cqw', color: '#0d212c', outline: 'none',
              fontFamily: 'var(--lbp-cond)', borderRadius: 0,
            }}
          >
            <option value="">选择方向</option>
            {groups.map(group => <option key={group.name} value={group.name}>{group.short}</option>)}
          </select>
        </label>
      </div>

      <label style={{ display: 'block' }}>
        <span style={{ display: 'block', fontFamily: 'var(--lbp-mono)', fontSize: '0.92cqw', letterSpacing: '0.06em', opacity: 0.55, marginBottom: '0.2cqw' }}>
          申请动机（至少 10 个字）
        </span>
        <textarea
          value={form.motivation}
          readOnly={submitted}
          onChange={event => onChange('motivation', event.target.value)}
          rows={2}
          placeholder="为什么想加入星雨作坊？想做什么方向？"
          style={{
            width: '100%', background: 'transparent', border: 0,
            borderBottom: `1px solid ${errors.motivation ? '#b73a32' : 'rgba(13,33,44,.3)'}`,
            padding: '0.2cqw 0', fontSize: '1.32cqw', lineHeight: 1.35, color: '#0d212c',
            outline: 'none', resize: 'none', fontFamily: 'var(--lbp-cond)', borderRadius: 0,
          }}
        />
      </label>

      <TicketInput label="作品 / GitHub 链接（选填）" value={form.portfolio} placeholder="https://..." readOnly={submitted} onChange={value => onChange('portfolio', value)} />

      {errorSummary && (
            <p style={{ fontFamily: 'var(--lbp-mono)', fontSize: '0.8cqw', lineHeight: 1.3, color: '#b73a32', margin: 0 }}>
          {errorSummary}
        </p>
      )}
      <p style={{ marginTop: 'auto', fontFamily: 'var(--lbp-mono)', fontSize: '0.7cqw', letterSpacing: '0.08em', opacity: 0.45 }}>
        {submitting ? '提交中…' : submitted ? '已提交' : '填写后点击右侧票根提交'}
      </p>
    </div>
  )
}

function TicketInput({ label, value, error, placeholder, readOnly, onChange }: {
  label: string
  value: string
  error?: string
  placeholder: string
  readOnly?: boolean
  onChange: (value: string) => void
}) {
  return (
    <label style={{ display: 'block', minWidth: 0 }}>
      <span style={{ display: 'block', fontFamily: 'var(--lbp-mono)', fontSize: '0.92cqw', letterSpacing: '0.06em', opacity: 0.55, marginBottom: '0.2cqw', whiteSpace: 'nowrap' }}>
        {label}
      </span>
      <input
        value={value}
        readOnly={readOnly}
        onChange={event => onChange(event.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', background: 'transparent', border: 0,
          borderBottom: `1px solid ${error ? '#b73a32' : 'rgba(13,33,44,.3)'}`,
          padding: '0.2cqw 0', fontSize: '1.38cqw', color: '#0d212c', outline: 'none',
          fontFamily: 'var(--lbp-cond)', borderRadius: 0,
        }}
      />
    </label>
  )
}

/* ═══════════════════════════════════════════════════════════════
   Ticket front: status query
   ═══════════════════════════════════════════════════════════════ */

function TicketQuery({ form, result, error, loading, onChange, onQuery }: {
  form: { studentId: string; phone: string }
  result: ApplicationStatusResult | null
  error: string
  loading: boolean
  onChange: (field: 'studentId' | 'phone', value: string) => void
  onQuery: () => void
}) {
  const meta = result ? STATUS_META[result.status] : null

  return (
    <div
      data-no-tilt
      style={{
        position: 'absolute', left: '26.5%', right: '2.8%', top: '49%',
        background: 'rgba(5,26,36,.94)', border: '1px solid rgba(232,238,242,.22)',
        borderRadius: '0.55cqw', padding: '0.8cqw 1cqw', backdropFilter: 'blur(8px)',
        boxShadow: '0 1cqw 2.4cqw rgba(0,0,0,.35)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '0.5cqw' }}>
        <span className="lbp-c" style={{ fontSize: '1.15cqw', letterSpacing: '0.08em' }}>查询报名状态</span>
        <span className="lbp-m" style={{ fontSize: '0.62cqw', opacity: 0.4 }}>CHECK-IN</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1cqw' }}>
        <FrontField label="学号" value={form.studentId} placeholder="输入学号" onChange={value => onChange('studentId', value)} />
        <FrontField label="手机号 / 邮箱" value={form.phone} placeholder="手机号或邮箱" onChange={value => onChange('phone', value)} />
        <button
          type="button"
          onClick={onQuery}
          disabled={loading}
          style={{
            border: 0, borderRadius: 999, padding: '0.45cqw 1.1cqw', cursor: 'pointer',
            background: '#e8eef2', color: '#051A24', fontFamily: 'var(--lbp-mono)',
            fontSize: '0.72cqw', letterSpacing: '0.12em', textTransform: 'uppercase', whiteSpace: 'nowrap',
          }}
        >
          {loading ? '查询中…' : '查验'}
        </button>
      </div>
      {error && (
        <p style={{ margin: '0.4cqw 0 0', fontFamily: 'var(--lbp-mono)', fontSize: '0.66cqw', color: '#ff9b93' }}>{error}</p>
      )}
      {result && meta && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '1.05cqw',
          marginTop: '0.6cqw', paddingTop: '0.55cqw',
          borderTop: '1px dashed rgba(232,238,242,.18)',
        }}>
          <div style={{
            flex: '0 0 auto', transform: 'rotate(-7deg)', textAlign: 'center',
            border: `2px solid ${meta.color}`, borderRadius: '0.3cqw',
            padding: '0.3cqw 0.75cqw', opacity: 0.92,
            boxShadow: `inset 0 0 0 1px ${meta.color}44, 0 0 1.2cqw ${meta.color}22`,
          }}>
            <span style={{
              display: 'block', fontFamily: 'var(--lbp-cond)', fontWeight: 700,
              fontSize: '1.28cqw', letterSpacing: '0.16em', lineHeight: 1, color: meta.color,
            }}>
              {meta.label}
            </span>
            <span style={{
              display: 'block', fontFamily: 'var(--lbp-mono)', fontSize: '0.52cqw',
              letterSpacing: '0.22em', marginTop: '0.18cqw', color: meta.color, opacity: 0.7,
            }}>
              {meta.code}
            </span>
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{
              margin: 0, fontFamily: 'var(--lbp-cond)', fontSize: '1.02cqw',
              letterSpacing: '0.06em', color: '#e8eef2',
            }}>
              {result.group_name || '意向方向待定'}
            </p>
            <p style={{
              margin: '0.2cqw 0 0', fontFamily: 'var(--lbp-mono)', fontSize: '0.7cqw',
              color: 'rgba(232,238,242,.55)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {result.admin_note ? `备注：${result.admin_note}` : statusHint(result.status)}
            </p>
            {(result.processed_at || result.created_at) && (
              <p style={{
                margin: '0.18cqw 0 0', fontFamily: 'var(--lbp-mono)', fontSize: '0.56cqw',
                letterSpacing: '0.08em', color: 'rgba(232,238,242,.3)',
              }}>
                {result.processed_at ? '处理于 ' : '提交于 '}
                {new Date(result.processed_at || result.created_at || '').toLocaleString('zh-CN')}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function FrontField({ label, value, placeholder, onChange }: {
  label: string
  value: string
  placeholder: string
  onChange: (value: string) => void
}) {
  return (
    <label style={{ flex: 1, minWidth: 0 }}>
      <span style={{ display: 'block', fontFamily: 'var(--lbp-mono)', fontSize: '0.72cqw', letterSpacing: '0.1em', color: 'rgba(232,238,242,.5)', marginBottom: '0.2cqw' }}>
        {label}
      </span>
      <input
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%', background: 'transparent', border: 0,
          borderBottom: '1px solid rgba(232,238,242,.35)', padding: '0.2cqw 0',
          fontSize: '1.15cqw', color: '#e8eef2', outline: 'none',
          fontFamily: 'var(--lbp-cond)', borderRadius: 0,
        }}
      />
    </label>
  )
}

/* ═══════════════════════════════════════════════════════════════
   Mobile
   ═══════════════════════════════════════════════════════════════ */

function MobileForm({ form, errors, errorSummary, submitting, onChange, onSubmit }: {
  form: ApplicationForm
  errors: Partial<Record<keyof ApplicationForm, string>>
  errorSummary: string
  submitting: boolean
  onChange: (field: keyof ApplicationForm, value: string) => void
  onSubmit: () => void
}) {
  return (
    <div className="rounded-[28px] border border-[#0d212c]/10 bg-[#f0ece6] p-6 shadow-xl">
      <div className="flex items-center justify-between border-b border-dashed border-[#0d212c]/25 pb-3">
        <span className="font-mono text-[10px] tracking-[0.24em] uppercase text-[#0d212c]/45">Boarding information</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#0d212c]/35">2026</span>
      </div>
      <div className="grid grid-cols-1 gap-5 mt-5">
        <PaperInput label="姓名" value={form.name} error={errors.name} placeholder="你的姓名" onChange={value => onChange('name', value)} />
        <PaperInput label="学号" value={form.studentId} error={errors.studentId} placeholder="6-12 位数字" onChange={value => onChange('studentId', value)} />
        <PaperInput label="年级专业" value={form.grade} error={errors.grade} placeholder="如 2024级 计算机科学" onChange={value => onChange('grade', value)} />
        <PaperInput label="手机" value={form.phone} error={errors.phone} placeholder="11 位手机号" onChange={value => onChange('phone', value)} />
        <PaperInput label="邮箱" value={form.email} error={errors.email} placeholder="you@example.com" onChange={value => onChange('email', value)} />
        <label className="block">
          <span className="block text-xs font-medium text-[#0d212c]/55 mb-1.5">意向方向</span>
          <select
            value={form.group}
            onChange={event => onChange('group', event.target.value)}
            className="w-full border-0 border-b border-[#0d212c]/20 bg-transparent px-0 py-2.5 text-sm text-[#0d212c] focus:outline-none focus:border-[#051A24]"
          >
            <option value="">请选择</option>
            {groups.map(group => <option key={group.name} value={group.name}>{group.name}</option>)}
          </select>
        </label>
        <PaperTextarea label="申请动机" value={form.motivation} error={errors.motivation} placeholder="为什么想加入星雨作坊？想做什么方向？（至少 10 个字）" onChange={value => onChange('motivation', value)} />
        <PaperInput label="作品 / GitHub 链接（选填）" value={form.portfolio} placeholder="https://..." onChange={value => onChange('portfolio', value)} />
      </div>
      {errorSummary && <p className="text-[11px] text-red-500 mt-4">{errorSummary}</p>}
      <Button variant="primary" onClick={onSubmit} disabled={submitting} className="w-full mt-5">
        {submitting ? '提交中…' : '提交报名'}
      </Button>
    </div>
  )
}

function PaperInput({ label, value, error, placeholder, onChange }: {
  label: string
  value: string
  error?: string
  placeholder: string
  onChange: (value: string) => void
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-[#0d212c]/55 mb-1.5">{label}</span>
      <input
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full border-0 border-b border-[#0d212c]/20 bg-transparent px-0 py-2.5 text-sm text-[#0d212c] placeholder:text-[#0d212c]/25 focus:outline-none focus:border-[#051A24]"
      />
      {error && <span className="block text-[11px] text-red-500 mt-1">{error}</span>}
    </label>
  )
}

function PaperTextarea({ label, value, error, placeholder, onChange }: {
  label: string
  value: string
  error?: string
  placeholder: string
  onChange: (value: string) => void
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-[#0d212c]/55 mb-1.5">{label}</span>
      <textarea
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full border-0 border-b border-[#0d212c]/20 bg-transparent px-0 py-2.5 text-sm text-[#0d212c] placeholder:text-[#0d212c]/25 focus:outline-none focus:border-[#051A24] resize-none"
      />
      {error && <span className="block text-[11px] text-red-500 mt-1">{error}</span>}
    </label>
  )
}
