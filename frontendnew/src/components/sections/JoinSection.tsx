import { useRef, useState } from 'react'
import { useInViewAnimation } from '../../hooks/useInViewAnimation'
import Button from '../ui/Button'
import LunarBoardingPass from '../ui/lunar-boarding-pass'
import { useSiteData } from '../../store/useSiteData'
import { renderRichText } from '../../lib/richText'
import { submitApplication } from '../../services/api'
import { Users, Code, Rocket, Heart } from 'lucide-react'

const benefits = [
  { icon: Code, title: '实战项目', desc: '参与真实项目，积累作品集，不再只做课堂作业' },
  { icon: Users, title: '团队协作', desc: '和志同道合的伙伴一起成长，体验真实开发流程' },
  { icon: Rocket, title: '技术提升', desc: '定期技术分享 + 导师指导，快速突破瓶颈' },
  { icon: Heart, title: '温暖社群', desc: '不止是技术，这里有一群懂你的朋友' },
]

const groups = ['流光组（产品策划）', '星绘组（视觉设计）', '逐云组（技术开发）', '拾焰组（内容运营）']

const EMPTY_FORM = {
  name: '',
  studentId: '',
  grade: '',
  email: '',
  phone: '',
  group: '',
  motivation: '',
  portfolio: '',
}

type ApplicationForm = typeof EMPTY_FORM

export default function JoinSection() {
  const { ref, isInView } = useInViewAnimation({ threshold: 0.05 })
  const { config } = useSiteData()
  const formRef = useRef<HTMLDivElement>(null)
  const ticketRef = useRef<HTMLDivElement>(null)

  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<ApplicationForm>(EMPTY_FORM)
  const [errors, setErrors] = useState<Partial<Record<keyof ApplicationForm, string>>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [applicationId, setApplicationId] = useState<number | null>(null)
  const [applicantName, setApplicantName] = useState('')

  const applied = applicationId !== null

  const openForm = () => {
    setFormOpen(true)
    window.setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80)
  }

  const update = (key: keyof ApplicationForm, value: string) => {
    setForm(current => ({ ...current, [key]: value }))
    setErrors(current => ({ ...current, [key]: undefined }))
  }

  const validate = () => {
    const next: Partial<Record<keyof ApplicationForm, string>> = {}
    if (form.name.trim().length < 2) next.name = '请填写姓名'
    if (!/^\d{6,12}$/.test(form.studentId.trim())) next.studentId = '学号为 6-12 位数字'
    if (!form.grade.trim()) next.grade = '请填写年级专业'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = '邮箱格式不正确'
    if (!/^\d{11}$/.test(form.phone.trim())) next.phone = '手机号为 11 位数字'
    if (!form.group) next.group = '请选择意向方向'
    if (form.motivation.trim().length < 10) next.motivation = '申请动机至少 10 个字'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setSubmitting(true)
    setSubmitError('')
    try {
      const result = await submitApplication({
        name: form.name.trim(),
        student_id: form.studentId.trim(),
        grade_major: form.grade.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        group_id: form.group,
        group_name: form.group,
        motivation: form.motivation.trim(),
        portfolio_url: form.portfolio.trim() || undefined,
      })
      setApplicationId(result.id)
      setApplicantName(form.name.trim())
      setFormOpen(false)
      setForm(EMPTY_FORM)
      window.setTimeout(() => ticketRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 150)
    } catch (error: unknown) {
      setSubmitError(error instanceof Error ? error.message : '提交失败，请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section ref={ref} className="relative z-10 py-24 md:py-32">
      <div className="max-w-[1000px] mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-10 md:mb-12">
          <p className="font-mono text-sm text-[#051A24] tracking-widest uppercase mb-4">
            {config.joinEyebrow}
          </p>
          <h2 className="text-[28px] md:text-[36px] text-[#051A24] leading-[1.15] tracking-tight">
            {renderRichText(config.joinTitle)}
          </h2>
          <p className="text-sm md:text-base text-[#273C46] leading-relaxed max-w-2xl mx-auto mt-4">
            {config.joinCtaDescription}
          </p>
        </div>

        {/* Boarding pass */}
        <div ref={ticketRef} className={isInView ? 'animate-fade-in-up delay-100' : 'opacity-0'}>
          <div className="hidden md:block">
            <LunarBoardingPass
              key={applied ? 'issued' : 'blank'}
              title={config.siteName}
              tier="CREW"
              date="2026"
              welcome={'加入我们\n一起造点东西'}
              eyebrow={'A pass to\nbuild real things'}
              words={['Build', 'Together']}
              notes={['学生开发者社群 · 长期招新', '前端 / 后端 / 设计 / 算法 / 产品']}
              passenger={applicantName || 'YOUR NAME'}
              from="CAMPUS"
              to="XINGYU"
              craft="STUDIO-01"
              dateCode="OPEN2026"
              gate="A1"
              group="CREW"
              seat="01"
              boardingTime="ANYTIME"
              site="GUILIN"
              lat={25.2736}
              lon={110.29}
              seq=""
              featuring="前端 · 后端 · 设计 · 算法 · 产品"
              headline="Join the crew"
              stamp={applied ? 'APPLIED' : 'WELCOME'}
              sideLabels={['成员凭证', '加入须知']}
              night="#051A24"
              starInk="#e8eef2"
              paper="#f0ece6"
              paperInk="#0d212c"
              stampColor="#3457ff"
              maxWidth={960}
              defaultSide={applied ? 'back' : 'front'}
              defaultTorn={applied}
              onTear={(torn) => { if (torn && !applied) window.setTimeout(openForm, 500) }}
            />
          </div>

          {/* Mobile: a compact version of the same ticket */}
          <div className="md:hidden relative overflow-hidden rounded-[28px] bg-[#051A24] text-[#F6FCFF] px-6 py-7 shadow-xl">
            <div className="flex items-center justify-between font-mono text-[10px] tracking-[0.24em] text-white/45 uppercase">
              <span>{config.siteName}</span>
              <span>CREW PASS</span>
            </div>
            <p className="mt-10 text-[32px] leading-[1.05] tracking-tight">
              加入我们
              <br />
              一起造点东西
            </p>
            <div className="mt-8 grid grid-cols-3 gap-3 border-t border-dashed border-white/20 pt-5 font-mono text-[10px] uppercase tracking-widest text-white/40">
              <div><span className="block text-white/30">Name</span>{applicantName || 'YOUR NAME'}</div>
              <div><span className="block text-white/30">From</span>CAMPUS</div>
              <div><span className="block text-white/30">To</span>XINGYU</div>
            </div>
            <p className="mt-5 text-[11px] leading-relaxed text-white/50">
              学生开发者社群 · 长期招新
              <br />
              前端 / 后端 / 设计 / 算法 / 产品
            </p>
            {applied ? (
              <p className="mt-6 rounded-full bg-emerald-400/15 px-4 py-2.5 text-center text-xs text-emerald-200">
                已提交 · 申请编号 #{applicationId}
              </p>
            ) : (
              <Button variant="secondary" onClick={openForm} className="w-full mt-6">
                {config.joinCtaButton}
              </Button>
            )}
          </div>
        </div>

        {/* Application form */}
        {formOpen && !applied && (
          <div
            ref={formRef}
            className="mt-8 rounded-[28px] border border-[#051A24]/10 bg-white/85 backdrop-blur-md p-6 md:p-8 shadow-lg"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-[10px] tracking-[0.24em] uppercase text-[#273C46]/45">Boarding information</p>
                <h3 className="text-xl font-medium text-[#051A24] mt-1">填写登船信息</h3>
              </div>
              <button onClick={() => setFormOpen(false)} className="text-xs text-[#273C46]/50 hover:text-[#051A24] transition-colors">
                收起
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              <TextField label="姓名" required value={form.name} error={errors.name} placeholder="你的姓名" onChange={v => update('name', v)} />
              <TextField label="学号" required value={form.studentId} error={errors.studentId} placeholder="6-12 位数字" onChange={v => update('studentId', v)} />
              <TextField label="年级专业" required value={form.grade} error={errors.grade} placeholder="如 2024级 计算机科学" onChange={v => update('grade', v)} />
              <TextField label="手机号" required value={form.phone} error={errors.phone} placeholder="11 位手机号" onChange={v => update('phone', v)} />
              <TextField label="邮箱" required value={form.email} error={errors.email} placeholder="you@example.com" onChange={v => update('email', v)} />
              <label className="block">
                <span className="block text-xs font-medium text-[#273C46]/60 mb-1.5">意向方向 <span className="text-red-400">*</span></span>
                <select
                  value={form.group}
                  onChange={e => update('group', e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-[#051A24]/12 bg-white text-sm text-[#051A24] focus:outline-none focus:border-[#051A24]"
                >
                  <option value="">请选择</option>
                  {groups.map(group => <option key={group} value={group}>{group}</option>)}
                </select>
                {errors.group && <span className="block text-[11px] text-red-500 mt-1">{errors.group}</span>}
              </label>
              <label className="block md:col-span-2">
                <span className="block text-xs font-medium text-[#273C46]/60 mb-1.5">申请动机 <span className="text-red-400">*</span></span>
                <textarea
                  value={form.motivation}
                  onChange={e => update('motivation', e.target.value)}
                  rows={3}
                  placeholder="为什么想加入星雨作坊？想做什么方向？（至少 10 个字）"
                  className="w-full px-4 py-2.5 rounded-xl border border-[#051A24]/12 bg-white text-sm text-[#051A24] focus:outline-none focus:border-[#051A24] resize-none"
                />
                {errors.motivation && <span className="block text-[11px] text-red-500 mt-1">{errors.motivation}</span>}
              </label>
              <TextField label="作品 / GitHub 链接（可选）" value={form.portfolio} placeholder="https://..." onChange={v => update('portfolio', v)} className="md:col-span-2" />
            </div>

            {submitError && (
              <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-xs text-red-600">{submitError}</p>
            )}

            <div className="mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-[11px] text-[#273C46]/50">提交后可凭学号 + 手机号在报名页查询审核进度。</p>
              <Button variant="primary" onClick={handleSubmit} disabled={submitting}>
                {submitting ? '提交中…' : '提交报名'}
              </Button>
            </div>
          </div>
        )}

        {/* Success */}
        {applied && (
          <div className="mt-8 rounded-[28px] border border-emerald-600/15 bg-emerald-50/85 backdrop-blur-sm p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-emerald-800">报名已提交 · 凭证已记名</p>
              <p className="text-xs text-emerald-700/70 mt-1">
                申请编号 #{applicationId} · {applicantName}，审核结果会通过成员系统通知。
              </p>
            </div>
            <Button variant="tertiary" href="/join" className="shrink-0">
              查看完整报名表
            </Button>
          </div>
        )}

        {/* Benefits */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-12 md:mt-14">
          {benefits.map((benefit) => {
            const Icon = benefit.icon
            return (
              <div key={benefit.title} className="rounded-[24px] bg-white/70 backdrop-blur-sm border border-[#051A24]/8 p-5">
                <div className="w-9 h-9 rounded-xl bg-[#051A24]/5 flex items-center justify-center mb-4">
                  <Icon className="w-4.5 h-4.5 text-[#051A24]" strokeWidth={1.5} />
                </div>
                <h3 className="text-sm font-medium text-[#051A24]">{benefit.title}</h3>
                <p className="text-xs text-[#273C46] leading-relaxed mt-1.5">{benefit.desc}</p>
              </div>
            )
          })}
        </div>

        {/* CTA */}
        {!applied && (
          <div className="text-center mt-10">
            <Button variant="primary" size="lg" onClick={openForm}>
              {config.joinCtaButton}
            </Button>
          </div>
        )}
      </div>
    </section>
  )
}

function TextField({ label, value, onChange, placeholder, error, required, className = '' }: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  error?: string
  required?: boolean
  className?: string
}) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-xs font-medium text-[#273C46]/60 mb-1.5">
        {label} {required && <span className="text-red-400">*</span>}
      </span>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-2.5 rounded-xl border border-[#051A24]/12 bg-white text-sm text-[#051A24] focus:outline-none focus:border-[#051A24]"
      />
      {error && <span className="block text-[11px] text-red-500 mt-1">{error}</span>}
    </label>
  )
}
