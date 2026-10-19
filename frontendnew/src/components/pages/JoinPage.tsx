import { useRef, useState } from 'react'
import Button from '../ui/Button'
import LunarBoardingPass from '../ui/lunar-boarding-pass'
import { submitApplication, queryApplicationStatus, type ApplicationStatusResult } from '../../services/api'

const steps = [
  { num: 1, label: '基本信息' },
  { num: 2, label: '意向选择' },
  { num: 3, label: '动机陈述' },
]

const groups = [
  { name: '流光组（产品策划）', code: 'PRODUCT' },
  { name: '星绘组（视觉设计）', code: 'DESIGN' },
  { name: '逐云组（技术开发）', code: 'DEV' },
  { name: '拾焰组（内容运营）', code: 'CONTENT' },
]

export default function JoinPage() {
  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [showStatusQuery, setShowStatusQuery] = useState(false)
  const [statusForm, setStatusForm] = useState({ studentId: '', phone: '' })
  const [statusResult, setStatusResult] = useState<ApplicationStatusResult | null>(null)
  const [statusError, setStatusError] = useState('')
  const [statusLoading, setStatusLoading] = useState(false)
  const [form, setForm] = useState({
    name: '', studentId: '', grade: '', email: '', phone: '',
    group: '', skills: '', motivation: '', portfolio: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const statusRef = useRef<HTMLDivElement>(null)

  const selectedGroup = groups.find(group => group.name === form.group)
  const seat = form.studentId.replace(/\D/g, '').slice(-2) || '01'
  const stamp = submitted ? 'APPLIED' : 'PENDING'

  const validate = () => {
    const next: Record<string, string> = {}
    if (step === 0) {
      if (!form.name || form.name.length < 2) next.name = '姓名至少 2 个字符'
      if (!/^\d{6,12}$/.test(form.studentId)) next.studentId = '学号为 6-12 位数字'
      if (!form.grade) next.grade = '请填写年级专业'
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) next.email = '邮箱格式不正确'
      if (!/^\d{11}$/.test(form.phone)) next.phone = '手机号为 11 位数字'
    }
    if (step === 1 && !form.group) next.group = '请选择意向组别'
    if (step === 2 && (!form.motivation || form.motivation.length < 10)) next.motivation = '申请动机至少 10 个字'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const next = () => { if (validate()) setStep(current => current + 1) }
  const prev = () => setStep(current => current - 1)

  const update = (field: string, value: string) => {
    setForm(current => ({ ...current, [field]: value }))
    setErrors(current => ({ ...current, [field]: '' }))
  }

  const toggleStatus = () => {
    setShowStatusQuery(current => {
      const nextValue = !current
      if (nextValue) {
        window.setTimeout(() => statusRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80)
      }
      return nextValue
    })
  }

  const queryStatus = async () => {
    if (!statusForm.studentId.trim() || !statusForm.phone.trim()) {
      setStatusError('请输入学号和手机号')
      return
    }
    setStatusLoading(true)
    setStatusError('')
    setStatusResult(null)
    try {
      const result = await queryApplicationStatus(statusForm.studentId.trim(), statusForm.phone.trim())
      setStatusResult(result)
    } catch (error: unknown) {
      setStatusError(error instanceof Error ? error.message : '查询失败，请稍后重试')
    } finally {
      setStatusLoading(false)
    }
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setSubmitting(true)
    setSubmitError('')
    try {
      await submitApplication({
        name: form.name,
        student_id: form.studentId,
        grade_major: form.grade,
        phone: form.phone,
        email: form.email,
        group_id: form.group,
        group_name: form.group,
        motivation: form.motivation,
        github_url: form.portfolio || undefined,
      })
      setSubmitted(true)
    } catch (error: unknown) {
      setSubmitError(error instanceof Error ? error.message : '提交失败，请稍后重试')
    } finally {
      setSubmitting(false)
    }
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
          填写登船信息，领取你的成员凭证。提交后可凭学号与手机号查验审核状态。
        </p>
        <button
          onClick={toggleStatus}
          className="mt-4 text-xs font-medium text-[#273C46]/60 hover:text-[#051A24] underline underline-offset-4 transition-colors"
        >
          {showStatusQuery ? '收起凭证查验' : '已有申请？查验登船状态 →'}
        </button>
      </div>

      {/* Boarding pass */}
      <div className="mt-10">
        <div className="hidden md:block">
          <LunarBoardingPass
            key={submitted ? 'issued' : 'draft'}
            title="星雨作坊"
            tier={submitted ? 'CREW' : 'APPLICANT'}
            date="2026"
            welcome={'加入我们\n一起造点东西'}
            eyebrow={'A pass to\nbuild real things'}
            words={['Build', 'Together']}
            notes={['学生开发者社群 · 长期招新', '前端 / 后端 / 设计 / 算法 / 产品']}
            passenger={form.name || 'YOUR NAME'}
            from="CAMPUS"
            to={selectedGroup?.code || 'XINGYU'}
            craft="STUDIO-01"
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
            headline={submitted ? 'Welcome aboard' : 'Join the crew'}
            stamp={stamp}
            sideLabels={['申请凭证', '填报须知']}
            night="#051A24"
            starInk="#e8eef2"
            paper="#f0ece6"
            paperInk="#0d212c"
            stampColor="#3457ff"
            maxWidth={960}
            defaultSide={submitted ? 'back' : 'front'}
            defaultTorn={submitted}
          />
        </div>

        {/* Compact pass on mobile */}
        <div className="md:hidden relative overflow-hidden rounded-[28px] bg-[#051A24] text-[#F6FCFF] px-6 py-7 shadow-xl">
          <div className="flex items-center justify-between font-mono text-[10px] tracking-[0.24em] text-white/45 uppercase">
            <span>{submitted ? 'Crew pass' : 'Applicant pass'}</span>
            <span>2026</span>
          </div>
          <p className="mt-10 text-[32px] leading-[1.05] tracking-tight">{form.name || 'YOUR NAME'}</p>
          <div className="mt-8 grid grid-cols-3 gap-3 border-t border-dashed border-white/20 pt-5 font-mono text-[10px] uppercase tracking-widest text-white/40">
            <div><span className="block text-white/30">From</span>CAMPUS</div>
            <div><span className="block text-white/30">To</span>{selectedGroup?.code || 'XINGYU'}</div>
            <div><span className="block text-white/30">Seat</span>{seat}</div>
          </div>
          <p className="mt-5 font-mono text-[10px] tracking-[0.2em] uppercase text-white/45">
            Status · {submitted ? 'Applied' : 'Draft'}
          </p>
        </div>
      </div>

      {/* Form */}
      {!submitted ? (
        <div className="mt-8 overflow-hidden rounded-[32px] border border-[#0d212c]/10 bg-[#f0ece6] shadow-[0_24px_60px_-30px_rgba(5,26,36,0.45)]">
          <div className="h-2 opacity-15" style={{ background: 'radial-gradient(circle, #0d212c 1px, transparent 1.4px) 0 0 / 12px 8px repeat-x' }} />
          <div className="p-6 md:p-10">
            <div className="flex items-start justify-between gap-4 border-b border-dashed border-[#0d212c]/25 pb-4">
              <div>
                <p className="font-mono text-[10px] tracking-[0.24em] uppercase text-[#0d212c]/45">Boarding information</p>
                <h2 className="text-xl font-medium text-[#0d212c] mt-1">填写登船信息</h2>
              </div>
              <span className="font-mono text-[10px] tracking-[0.2em] text-[#0d212c]/45">STEP 0{step + 1} / 03</span>
            </div>

            <div className="flex flex-wrap gap-x-6 gap-y-2 mt-4">
              {steps.map((item, index) => (
                <button
                  key={item.num}
                  type="button"
                  onClick={() => index < step && setStep(index)}
                  disabled={index > step}
                  className={`font-mono text-[10px] uppercase tracking-[0.18em] transition-colors ${
                    index === step ? 'text-[#0d212c]' : index < step ? 'text-[#0d212c]/45 hover:text-[#0d212c]' : 'text-[#0d212c]/20'
                  }`}
                >
                  0{item.num} {item.label}
                </button>
              ))}
            </div>

            <div className="mt-8">
              {step === 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                  <PaperInput field="name" value={form.name} error={errors.name} label="姓名" placeholder="你的姓名" onChange={value => update('name', value)} />
                  <PaperInput field="studentId" value={form.studentId} error={errors.studentId} label="学号" placeholder="6-12 位数字" onChange={value => update('studentId', value)} />
                  <PaperInput field="grade" value={form.grade} error={errors.grade} label="年级专业" placeholder="如 2024级 计算机科学" onChange={value => update('grade', value)} />
                  <PaperInput field="email" value={form.email} error={errors.email} label="邮箱" placeholder="you@example.com" type="email" onChange={value => update('email', value)} />
                  <PaperInput field="phone" value={form.phone} error={errors.phone} label="手机" placeholder="11 位手机号" type="tel" onChange={value => update('phone', value)} />
                  <div>
                    <span className="block text-xs font-medium text-[#0d212c]/55 mb-1.5">招新批次</span>
                    <div className="border-b border-[#0d212c]/20 py-2.5 font-mono text-sm text-[#0d212c]/60">2026 · OPEN</div>
                  </div>
                </div>
              )}

              {step === 1 && (
                <div>
                  <span className="block text-xs font-medium text-[#0d212c]/55 mb-3">意向方向 <span className="text-red-400">*</span></span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {groups.map(group => (
                      <button
                        key={group.name}
                        type="button"
                        onClick={() => update('group', group.name)}
                        className={`rounded-2xl border px-4 py-3 text-left transition-all ${
                          form.group === group.name
                            ? 'bg-[#051A24] text-[#f0ece6] border-[#051A24]'
                            : 'border-[#0d212c]/15 text-[#0d212c] hover:border-[#0d212c]/40'
                        }`}
                      >
                        <span className={`block font-mono text-[9px] tracking-[0.2em] uppercase ${form.group === group.name ? 'text-white/45' : 'text-[#0d212c]/35'}`}>{group.code}</span>
                        <span className="block text-sm mt-1">{group.name}</span>
                      </button>
                    ))}
                  </div>
                  {errors.group && <p className="text-[11px] text-red-500 mt-2">{errors.group}</p>}
                  <div className="mt-7">
                    <PaperTextarea field="skills" value={form.skills} label="技能自述（选填）" placeholder="会什么、做过什么，都可以写一点" onChange={value => update('skills', value)} />
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-7">
                  <PaperTextarea field="motivation" value={form.motivation} label="申请动机" required error={errors.motivation} placeholder="为什么想加入星雨作坊？想做什么方向？（至少 10 个字）" onChange={value => update('motivation', value)} />
                  <PaperInput field="portfolio" value={form.portfolio} label="个人作品 / 项目链接（选填）" placeholder="https://..." onChange={value => update('portfolio', value)} />
                </div>
              )}
            </div>

            {submitError && (
              <p className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-xs text-red-600">{submitError}</p>
            )}

            <div className="flex items-center justify-between mt-8">
              {step > 0 ? <Button variant="tertiary" onClick={prev}>上一步</Button> : <span />}
              {step < 2 ? (
                <Button variant="primary" onClick={next}>下一步</Button>
              ) : (
                <Button variant="primary" onClick={handleSubmit} disabled={submitting}>
                  {submitting ? '提交中…' : '提交申请'}
                </Button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-8 rounded-[32px] border border-emerald-700/15 bg-emerald-50/90 p-6 md:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] tracking-[0.24em] uppercase text-emerald-700/60">Application received</p>
            <h2 className="text-xl font-medium text-emerald-900 mt-1">申请已提交 · 登船凭证已签发</h2>
            <p className="text-xs text-emerald-800/70 mt-2">我们会在 1 周内通过邮件通知筛选结果，请留意邮箱；也可以随时查验审核状态。</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="tertiary" onClick={toggleStatus}>查验状态</Button>
            <Button variant="tertiary" href="/">返回首页</Button>
          </div>
        </div>
      )}

      {/* Status query */}
      {showStatusQuery && (
        <div ref={statusRef} className="mt-8 rounded-[32px] border border-[#0d212c]/10 bg-[#f0ece6]/95 p-6 md:p-8 shadow-lg">
          <div className="flex items-start justify-between gap-4 border-b border-dashed border-[#0d212c]/25 pb-4">
            <div>
              <p className="font-mono text-[10px] tracking-[0.24em] uppercase text-[#0d212c]/45">Pass status</p>
              <h2 className="text-lg font-medium text-[#0d212c] mt-1">查验登船状态</h2>
            </div>
            <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-[#0d212c]/35">Check-in</span>
          </div>
          <p className="text-xs text-[#0d212c]/55 mt-4">输入提交申请时使用的学号和手机号。</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-5">
            <PaperInput field="statusStudentId" value={statusForm.studentId} label="学号" placeholder="提交申请时的学号" onChange={value => setStatusForm(current => ({ ...current, studentId: value }))} />
            <PaperInput field="statusPhone" value={statusForm.phone} label="手机号" placeholder="提交申请时的手机号" onChange={value => setStatusForm(current => ({ ...current, phone: value }))} />
          </div>
          {statusError && <p className="text-[11px] text-red-500 mt-3">{statusError}</p>}
          {statusResult && (
            <div className="mt-5 rounded-2xl border border-dashed border-[#0d212c]/25 bg-white/55 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className={`inline-block rotate-[-4deg] rounded-md border-2 px-3 py-1 font-mono text-xs font-bold tracking-[0.18em] uppercase ${
                  statusResult.status === 'approved' ? 'border-emerald-600 text-emerald-700'
                    : statusResult.status === 'rejected' ? 'border-red-500 text-red-600'
                      : 'border-amber-500 text-amber-700'
                }`}>
                  {statusResult.status === 'approved' ? '已通过' : statusResult.status === 'rejected' ? '未通过' : '待审核'}
                </span>
                {statusResult.group_name && <span className="font-mono text-[10px] tracking-[0.12em] uppercase text-[#0d212c]/50">{statusResult.group_name}</span>}
              </div>
              {statusResult.admin_note && (
                <p className="text-xs text-[#0d212c]/60 mt-3">备注：{statusResult.admin_note}</p>
              )}
              {statusResult.processed_at && (
                <p className="text-[10px] text-[#0d212c]/40 mt-2">处理时间：{new Date(statusResult.processed_at).toLocaleString('zh-CN')}</p>
              )}
            </div>
          )}
          <div className="flex justify-end mt-5">
            <Button variant="primary" onClick={queryStatus} disabled={statusLoading}>
              {statusLoading ? '查询中…' : '查验'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function PaperInput({ field, value, label, error, onChange, placeholder, type = 'text' }: {
  field: string
  value: string
  label: string
  error?: string
  onChange: (value: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-[#0d212c]/55 mb-1.5">{label}</span>
      <input
        name={field}
        type={type}
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full border-0 border-b border-[#0d212c]/20 bg-transparent px-0 py-2.5 text-sm text-[#0d212c] placeholder:text-[#0d212c]/25 focus:outline-none focus:border-[#051A24] transition-colors"
      />
      {error && <span className="block text-[11px] text-red-500 mt-1">{error}</span>}
    </label>
  )
}

function PaperTextarea({ field, value, label, required, error, onChange, placeholder }: {
  field: string
  value: string
  label: string
  required?: boolean
  error?: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-[#0d212c]/55 mb-1.5">
        {label}{required && <span className="text-red-400"> *</span>}
      </span>
      <textarea
        name={field}
        value={value}
        onChange={event => onChange(event.target.value)}
        rows={4}
        placeholder={placeholder}
        className="w-full border-0 border-b border-[#0d212c]/20 bg-transparent px-0 py-2.5 text-sm text-[#0d212c] placeholder:text-[#0d212c]/25 focus:outline-none focus:border-[#051A24] transition-colors resize-none"
      />
      {error && <span className="block text-[11px] text-red-500 mt-1">{error}</span>}
    </label>
  )
}
