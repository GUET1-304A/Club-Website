import { useState } from 'react'
import { MapPin, Mail, Phone, Clock, Send, CheckCircle2, LoaderCircle } from 'lucide-react'
import Card from '../ui/Card'
import { submitContact } from '../../services/api'

import { useSiteData } from '../../store/useSiteData'

const EMPTY_FORM = { name: '', email: '', phone: '', subject: '', message: '', isAnonymous: false }

export default function ContactPage() {
  const { config } = useSiteData(['config'])
  const contact = config.contact ?? {}
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const validate = () => {
    const next: Record<string, string> = {}
    if (!form.isAnonymous) {
      if (!form.name.trim()) next.name = '请填写姓名'
      if (!form.email.trim() || !/^\S+@\S+\.\S+$/.test(form.email)) next.email = '请填写有效邮箱'
    }
    if (!form.subject.trim()) next.subject = '请填写留言主题'
    if (form.message.trim().length < 5) next.message = '留言内容至少 5 个字'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setSubmitting(true)
    setSubmitError('')
    try {
      await submitContact({
        name: form.isAnonymous ? '匿名访客' : form.name.trim(),
        email: form.isAnonymous ? 'anonymous@example.com' : form.email.trim(),
        phone: form.phone.trim() || undefined,
        subject: form.subject.trim(),
        message: form.message.trim(),
        is_anonymous: form.isAnonymous,
      })
      setSubmitted(true)
      setForm({ ...EMPTY_FORM })
    } catch (error: unknown) {
      setSubmitError((error as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="page-enter max-w-[1000px] mx-auto px-6 py-24">
      <h1 className="text-[36px] md:text-[44px] font-medium text-[#051A24] text-center">
        联系<span className="font-mondwest">我们</span>
      </h1>
      <p className="text-center text-sm text-[#273C46] mt-4">有问题、有想法，或者想聊聊合作？欢迎随时联系我们</p>

      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6 mt-12">
        {/* Contact info */}
        <div className="space-y-4">
          <Card className="p-6 !rounded-[28px]">
            <h2 className="text-lg font-medium text-[#051A24] mb-5">联系方式</h2>
            <div className="space-y-4">
              <InfoRow icon={<MapPin className="w-4 h-4" />} label="地址" value={contact.address || '暂未设置'} />
              <InfoRow icon={<Mail className="w-4 h-4" />} label="邮箱" value={contact.email || '暂未设置'} href={contact.email ? `mailto:${contact.email}` : undefined} />
              <InfoRow icon={<Phone className="w-4 h-4" />} label="电话" value={contact.phone || '暂未设置'} href={contact.phone ? `tel:${contact.phone}` : undefined} />
              <InfoRow icon={<Clock className="w-4 h-4" />} label="时间" value={contact.hours || '暂未设置'} />
            </div>
          </Card>
          {contact.socials && contact.socials.length > 0 && (
            <Card className="p-6 !rounded-[28px]">
              <h2 className="text-lg font-medium text-[#051A24] mb-4">社交平台</h2>
              <div className="flex flex-wrap gap-2">
                {contact.socials.map(social => (
                  <a key={social.label} href={social.url} target="_blank" rel="noreferrer"
                    className="px-4 py-2 rounded-full bg-[#f0ece6] text-xs font-medium text-[#273C46] hover:bg-[#051A24] hover:text-white transition-all">
                    {social.label}
                  </a>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Message form */}
        <Card className="p-6 md:p-8 !rounded-[28px]">
          {submitted ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mb-4" />
              <h3 className="text-lg font-medium text-[#051A24]">留言已送达</h3>
              <p className="text-sm text-[#273C46]/60 mt-2">感谢你的反馈，我们会尽快回复。</p>
              <button onClick={() => setSubmitted(false)} className="btn-secondary text-sm px-5 py-2.5 mt-6">再写一条</button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-medium text-[#051A24]">留言反馈</h2>
                <label className="flex items-center gap-2 text-xs text-[#273C46]/60 cursor-pointer">
                  <input type="checkbox" checked={form.isAnonymous}
                    onChange={e => setForm({ ...form, isAnonymous: e.target.checked })}
                    className="rounded border-[rgba(0,0,0,0.2)]" />
                  匿名留言
                </label>
              </div>

              {!form.isAnonymous && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField label="姓名" error={errors.name}>
                    <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="你的姓名"
                      className={inputCls(!!errors.name)} />
                  </FormField>
                  <FormField label="邮箱" error={errors.email}>
                    <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="you@example.com"
                      className={inputCls(!!errors.email)} />
                  </FormField>
                </div>
              )}

              <FormField label="电话（选填）">
                <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="仅用于联系你"
                  className={inputCls(false)} />
              </FormField>

              <FormField label="主题" error={errors.subject}>
                <input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} placeholder="如：合作咨询、加入申请、建议反馈"
                  className={inputCls(!!errors.subject)} />
              </FormField>

              <FormField label="留言内容" error={errors.message}>
                <textarea rows={5} value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} placeholder="请描述你的问题或想法..."
                  className={`${inputCls(!!errors.message)} resize-none`} />
              </FormField>

              {submitError && <p className="text-xs text-red-500">{submitError}</p>}

              <button onClick={handleSubmit} disabled={submitting}
                className="btn-primary w-full py-3 text-sm font-medium flex items-center justify-center gap-2 shadow-lg shadow-[#051A24]/10 disabled:opacity-50">
                {submitting ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {submitting ? '发送中...' : '发送留言'}
              </button>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

function InfoRow({ icon, label, value, href }: { icon: React.ReactNode; label: string; value: string; href?: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-9 h-9 rounded-xl bg-[#f0ece6] flex items-center justify-center text-[#273C46]/60 shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-[10px] font-medium text-[#273C46]/40 uppercase tracking-wider">{label}</p>
        {href ? (
          <a href={href} className="text-sm text-[#0D212C] break-all hover:text-[#051A24]">{value}</a>
        ) : (
          <p className="text-sm text-[#0D212C] break-words">{value}</p>
        )}
      </div>
    </div>
  )
}

function FormField({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-[#273C46]/60 mb-1.5">{label}</label>
      {children}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}

function inputCls(hasError: boolean) {
  return `w-full px-4 py-2.5 rounded-2xl border text-sm text-[#051A24] placeholder:text-[#273C46]/25
    focus:outline-none focus:ring-2 transition-all
    ${hasError
      ? 'border-red-300 bg-red-50/30 focus:border-red-400 focus:ring-red-100'
      : 'border-[rgba(0,0,0,0.08)] bg-[#fcfbfa] focus:border-[#051A24]/30 focus:ring-[#051A24]/5'}`
}
