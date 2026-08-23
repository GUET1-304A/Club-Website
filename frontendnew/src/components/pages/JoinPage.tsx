import { useState } from 'react'
import Button from '../ui/Button'
import Card from '../ui/Card'
import { submitApplication, queryApplicationStatus, type ApplicationStatusResult } from '../../services/api'

const steps = [
  { num: 1, label: '基本信息' },
  { num: 2, label: '意向选择' },
  { num: 3, label: '动机陈述' },
]

const groups = ['流光组（产品策划）', '星绘组（视觉设计）', '逐云组（技术开发）', '拾焰组（内容运营）']

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

  const validate = () => {
    const e: Record<string, string> = {}
    if (step === 0) {
      if (!form.name || form.name.length < 2) e.name = '姓名至少 2 个字符'
      if (!/^\d{6,12}$/.test(form.studentId)) e.studentId = '学号为 6-12 位数字'
      if (!form.grade) e.grade = '请填写年级专业'
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = '邮箱格式不正确'
      if (!/^\d{11}$/.test(form.phone)) e.phone = '手机号为 11 位数字'
    }
    if (step === 1 && !form.group) e.group = '请选择意向组别'
    if (step === 2 && (!form.motivation || form.motivation.length < 10)) e.motivation = '申请动机至少 10 个字'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const next = () => { if (validate()) setStep((s) => s + 1) }
  const prev = () => setStep((s) => s - 1)

  const update = (field: string, value: string) => {
    setForm((f) => ({ ...f, [field]: value }))
    setErrors((e) => ({ ...e, [field]: '' }))
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
    } catch (e: unknown) {
      setStatusError(e instanceof Error ? e.message : '查询失败，请稍后重试')
    } finally {
      setStatusLoading(false)
    }
  }

  return (
    <div className="page-enter max-w-[600px] mx-auto px-6 py-24">
      <div className="text-center">
        <h1 className="text-[36px] md:text-[44px] font-medium text-[#051A24]">
          加入<span className="font-mondwest">我们</span>
        </h1>
        <button
          onClick={() => setShowStatusQuery(v => !v)}
          className="mt-4 text-xs font-medium text-[#273C46]/60 hover:text-[#051A24] underline underline-offset-4 transition-colors"
        >
          {showStatusQuery ? '收起状态查询' : '查询申请状态'}
        </button>
      </div>

      {showStatusQuery && (
        <Card className="p-8 md:p-10 !rounded-[32px] mt-10">
          <h2 className="text-lg font-medium text-[#051A24] mb-2">查询申请状态</h2>
          <p className="text-xs text-[#273C46]/60 mb-5">输入提交申请时使用的学号和手机号，查询当前审核进度。</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputField field="studentId" value={statusForm.studentId} label="学号"
              onChange={(v) => setStatusForm(f => ({ ...f, studentId: v }))} />
            <InputField field="phone" value={statusForm.phone} label="手机号"
              onChange={(v) => setStatusForm(f => ({ ...f, phone: v }))} />
          </div>
          {statusError && <p className="text-xs text-red-500 mt-3">{statusError}</p>}
          {statusResult && (
            <div className="mt-4 p-4 rounded-2xl bg-[#fcfbfa] border border-[rgba(0,0,0,0.04)]">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-semibold rounded-full px-3 py-1 ${
                  statusResult.status === 'approved' ? 'bg-emerald-50 text-emerald-700'
                    : statusResult.status === 'rejected' ? 'bg-red-50 text-red-600'
                      : 'bg-amber-50 text-amber-700'
                }`}>
                  {statusResult.status === 'approved' ? '已通过'
                    : statusResult.status === 'rejected' ? '已拒绝' : '待审核'}
                </span>
                {statusResult.group_name && <span className="text-xs text-[#273C46]/50">{statusResult.group_name}</span>}
              </div>
              {statusResult.admin_note && (
                <p className="text-xs text-[#273C46]/60 mt-2">备注：{statusResult.admin_note}</p>
              )}
              {statusResult.processed_at && (
                <p className="text-[11px] text-[#273C46]/40 mt-2">
                  处理时间：{new Date(statusResult.processed_at).toLocaleString('zh-CN')}
                </p>
              )}
            </div>
          )}
          <div className="flex justify-end mt-5">
            <Button variant="primary" onClick={queryStatus} disabled={statusLoading}>
              {statusLoading ? '查询中...' : '查询'}
            </Button>
          </div>
        </Card>
      )}

      {/* Step indicator */}
      <div className="flex items-center justify-center gap-0 mt-10 mb-12">
        {steps.map((s, i) => (
          <div key={s.num} className="flex items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
              i < step ? 'bg-[#0D212C] text-white' : i === step ? 'bg-[#051A24] text-white' : 'bg-white border border-[rgba(0,0,0,0.08)] text-[#273C46]'
            }`}>
              {i < step ? '✓' : s.num}
            </div>
            {i < steps.length - 1 && <div className={`w-12 h-px ${i < step ? 'bg-[#0D212C]' : 'bg-[rgba(0,0,0,0.08)]'}`} />}
          </div>
        ))}
      </div>

      {submitted ? (
        <Card className="p-12 md:p-16 !rounded-[32px] text-center">
          <h2 className="text-2xl font-medium text-[#051A24] mb-4">🎉 申请已提交</h2>
          <p className="text-sm text-[#273C46] leading-relaxed max-w-sm mx-auto">
            感谢你的报名！我们会在 1 周内通过邮件通知筛选结果，请留意邮箱。
          </p>
          <div className="mt-8">
            <Button variant="tertiary" href="/">返回首页</Button>
          </div>
        </Card>
      ) : (
      <Card className="p-8 md:p-10 !rounded-[32px]">
        {step === 0 && (
          <div className="space-y-5">
            {(['name', 'studentId', 'grade', 'email', 'phone'] as const).map((field) => (
              <InputField key={field} field={field} value={form[field]} error={errors[field]}
                onChange={(v) => update(field, v)}
                labels={{ name: '姓名', studentId: '学号', grade: '年级专业', email: '邮箱', phone: '手机' }}
                types={{ email: 'email', phone: 'tel' }} />
            ))}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <label className="block text-sm font-medium text-[#051A24]">意向组别</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {groups.map((g) => (
                <button key={g}
                  className={`p-3 rounded-2xl border text-sm font-medium transition-all ${
                    form.group === g ? 'bg-[#051A24] text-white border-[#051A24]' : 'bg-white text-[#273C46] border-[rgba(0,0,0,0.08)] hover:border-[rgba(0,0,0,0.2)]'
                  }`}
                  onClick={() => update('group', g)}>{g}</button>
              ))}
            </div>
            {errors.group && <p className="text-xs text-red-500">{errors.group}</p>}
            <TextareaField field="skills" value={form.skills} label="技能自述（选填）"
              onChange={(v) => update('skills', v)} />
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <TextareaField field="motivation" value={form.motivation} label="申请动机" required
              error={errors.motivation} onChange={(v) => update('motivation', v)} />
            <InputField field="portfolio" value={form.portfolio} label="个人作品/项目链接（选填）"
              onChange={(v) => update('portfolio', v)} />
          </div>
        )}

        {submitError && (
          <p className="text-xs text-red-500 text-center mt-4">{submitError}</p>
        )}
        <div className="flex justify-between mt-8">
          {step > 0 ? <Button variant="tertiary" onClick={prev}>上一步</Button> : <div />}
          {step < 2 ? (
            <Button variant="primary" onClick={next}>下一步</Button>
          ) : (
            <Button
              variant="primary"
              onClick={async () => {
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
                } catch (e: unknown) {
                  setSubmitError(e instanceof Error ? e.message : '提交失败，请稍后重试')
                } finally {
                  setSubmitting(false)
                }
              }}
            >
              {submitting ? '提交中...' : '提交申请'}
            </Button>
          )}
        </div>
      </Card>
      )}
    </div>
  )
}

function InputField({ field, value, label, error, onChange, type, labels, types }: {
  field: string; value: string; label?: string; error?: string; onChange: (v: string) => void
  type?: string; labels?: Record<string, string>; types?: Record<string, string>
}) {
  const displayLabel = label || (labels && labels[field]) || field
  const inputType = type || (types && types[field]) || 'text'
  return (
    <div>
      <label className="block text-sm font-medium text-[#051A24] mb-1.5">{displayLabel}</label>
      <input type={inputType} value={value} onChange={(e) => onChange(e.target.value)}
        className={`w-full rounded-xl border px-4 py-2.5 text-sm text-[#051A24] placeholder:text-[#273C46]/30 outline-none transition-colors ${
          error ? 'border-red-400' : 'border-[rgba(0,0,0,0.08)] focus:border-[#051A24]'
        }`} />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}

function TextareaField({ value, label, required, error, onChange }: {
  field?: string; value: string; label: string; required?: boolean; error?: string; onChange: (v: string) => void
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-[#051A24] mb-1.5">
        {label}{required && ' *'}
      </label>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={4}
        className={`w-full rounded-xl border px-4 py-2.5 text-sm text-[#051A24] placeholder:text-[#273C46]/30 outline-none transition-colors resize-none ${
          error ? 'border-red-400' : 'border-[rgba(0,0,0,0.08)] focus:border-[#051A24]'
        }`} />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}
