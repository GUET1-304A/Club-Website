import { useState } from 'react'
import {
  User, Lock, Bell, Save, Camera, AlertCircle, Check,
} from 'lucide-react'
import MemberLayout from './MemberLayout'
import {
  memberUpdateMe, memberChangePassword,
  type MemberProfile,
} from '../../services/memberApi'
import { useToast } from '../admin/Toast'

type Tab = 'profile' | 'security' | 'notifications'

const TABS: { key: Tab; label: string; icon: typeof User }[] = [
  { key: 'profile', label: '个人资料', icon: User },
  { key: 'security', label: '账号安全', icon: Lock },
  { key: 'notifications', label: '通知偏好', icon: Bell },
]

const NOTIFICATION_ITEMS = [
  { key: 'taskAssigned', label: '任务分配通知', description: '当有新任务分配给你时' },
  { key: 'statusChange', label: '任务状态变更', description: '当你关注的任务状态发生变化时' },
  { key: 'milestone', label: '里程碑达成', description: '当项目里程碑完成时' },
  { key: 'weeklyReport', label: '周报提醒', description: '每周提交周报的提醒' },
  { key: 'announcement', label: '社团公告', description: '新公告和重要通知' },
]

interface Props {
  member: MemberProfile
  onUpdate: (member: MemberProfile) => void
}

export default function MemberProfilePage({ member: initialMember, onUpdate }: Props) {
  const { toast } = useToast()
  const [tab, setTab] = useState<Tab>('profile')
  const [member, setMember] = useState(initialMember)
  const [saving, setSaving] = useState(false)

  // ── Profile form state ──
  const [name, setName] = useState(member.name || '')
  const [phone, setPhone] = useState(member.phone || '')
  const [bio, setBio] = useState(member.bio || '')
  const [github, setGithub] = useState(member.github || '')
  const [blog, setBlog] = useState(member.blog || '')
  const [grade, setGrade] = useState(member.grade || '')
  const [skillsStr, setSkillsStr] = useState((member.skills || []).join(', '))

  // ── Password form state ──
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState(false)
  const [changingPw, setChangingPw] = useState(false)

  // ── Notification prefs ──
  const [prefs, setPrefs] = useState<Record<string, boolean>>(member.notificationPrefs || {})

  // ── Save profile ──
  const handleSaveProfile = async () => {
    if (!name.trim()) { toast('warning', '请填写姓名'); return }
    setSaving(true)
    try {
      const skills = skillsStr.split(',').map(s => s.trim()).filter(Boolean)
      const result = await memberUpdateMe({ name: name.trim(), phone, bio, github, blog, grade, skills })
      setMember(result.member)
      onUpdate(result.member)
      toast('success', '个人资料已更新')
    } catch (e: unknown) {
      toast('error', (e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  // ── Change password ──
  const handleChangePassword = async () => {
    setPwError('')
    setPwSuccess(false)

    if (!currentPw || !newPw || !confirmPw) {
      setPwError('请填写所有密码字段')
      return
    }
    if (newPw !== confirmPw) {
      setPwError('两次输入的新密码不一致')
      return
    }
    if (newPw.length < 6) {
      setPwError('新密码至少需要6个字符')
      return
    }

    setChangingPw(true)
    try {
      await memberChangePassword(currentPw, newPw)
      setPwSuccess(true)
      setCurrentPw('')
      setNewPw('')
      setConfirmPw('')
      toast('success', '密码已更新')
    } catch (e: unknown) {
      setPwError((e as Error).message)
    } finally {
      setChangingPw(false)
    }
  }

  // ── Save notification prefs ──
  const handleSavePrefs = async () => {
    setSaving(true)
    try {
      const result = await memberUpdateMe({ notificationPrefs: prefs })
      setMember(result.member)
      toast('success', '通知偏好已更新')
    } catch (e: unknown) {
      toast('error', (e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  /* ─── Render helpers ─── */

  function renderTabBar() {
    return (
      <div className="flex items-center gap-1 mb-6 bg-white rounded-2xl p-1 border border-[rgba(0,0,0,0.04)] w-fit">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all
              ${tab === t.key
                ? 'bg-[#051A24] text-white shadow-sm shadow-[#051A24]/10'
                : 'text-[#273C46]/60 hover:text-[#051A24] hover:bg-[rgba(0,0,0,0.02)]'
              }`}
          >
            <t.icon className="w-4 h-4" strokeWidth={1.5} />
            {t.label}
          </button>
        ))}
      </div>
    )
  }

  function renderProfileTab() {
    return (
      <div className="card p-6" style={{ borderRadius: 24 }}>
        {/* Avatar */}
        <div className="flex items-center gap-4 mb-6">
          <div className="relative group">
            <div className="w-[72px] h-[72px] rounded-2xl bg-gradient-to-br from-[#f0ece6] to-[#e8e4dc] overflow-hidden ring-2 ring-white shadow-md">
              {member.avatar
                ? <img src={member.avatar} alt="" className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center text-2xl text-[#273C46]/20 font-semibold">{member.name?.[0] || '?'}</div>
              }
            </div>
            <label className="absolute inset-0 bg-black/30 rounded-2xl flex flex-col items-center justify-center gap-1
              opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
              <Camera className="w-4 h-4 text-white" />
              <span className="text-[10px] text-white font-medium">更换</span>
              <input type="file" accept="image/*" className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0]; if (!file) return
                  toast('info', '头像上传功能将在 Phase 4 与资源中心一起实现')
                }}
              />
            </label>
          </div>
          <div>
            <h2 className="text-lg font-medium text-[#051A24]"
              style={{ fontFamily: "'PP Neue Montreal', 'Noto Sans SC', sans-serif", fontWeight: 500 }}>
              {member.name}
            </h2>
            <p className="text-xs text-[#273C46]/50">{member.role || member.group || '成员'}</p>
            {member.studentId && <p className="text-xs text-[#273C46]/30 font-mono mt-0.5">学号: {member.studentId}</p>}
          </div>
        </div>

        {/* Form fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="姓名 *">
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="你的姓名" />
          </Field>
          <Field label="手机号">
            <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="手机号码" />
          </Field>
          <Field label="年级">
            <Input value={grade} onChange={e => setGrade(e.target.value)} placeholder="2022级" />
          </Field>
          <Field label="GitHub">
            <Input value={github} onChange={e => setGithub(e.target.value)} placeholder="https://github.com/..." />
          </Field>
        </div>
        <div className="mt-4">
          <Field label="博客">
            <Input value={blog} onChange={e => setBlog(e.target.value)} placeholder="https://blog.example.com" />
          </Field>
        </div>
        <div className="mt-4">
          <Field label="技能（逗号分隔）">
            <Input value={skillsStr} onChange={e => setSkillsStr(e.target.value)} placeholder="React, TypeScript, Node.js" />
          </Field>
        </div>
        <div className="mt-4">
          <Field label="个人简介">
            <textarea
              value={bio}
              onChange={e => setBio(e.target.value)}
              placeholder="介绍一下你自己..."
              rows={3}
              className="w-full px-4 py-3 rounded-2xl border border-[rgba(0,0,0,0.08)] bg-[#fcfbfa]
                text-sm text-[#051A24] placeholder:text-[#273C46]/25 resize-none
                focus:outline-none focus:border-[#051A24]/30 focus:ring-2 focus:ring-[#051A24]/5 transition-all"
            />
          </Field>
        </div>

        <button
          onClick={handleSaveProfile}
          disabled={saving}
          className="btn-primary text-sm px-6 py-2.5 mt-6 flex items-center gap-2 shadow-lg shadow-[#051A24]/10"
        >
          {saving ? (
            <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> 保存中...</>
          ) : (
            <><Save className="w-4 h-4" /> 保存修改</>
          )}
        </button>
      </div>
    )
  }

  function renderSecurityTab() {
    return (
      <div className="card p-6" style={{ borderRadius: 24 }}>
        <h3 className="text-base font-medium text-[#051A24] mb-1"
          style={{ fontFamily: "'PP Neue Montreal', 'Noto Sans SC', sans-serif", fontWeight: 500 }}>
          修改密码
        </h3>
        <p className="text-xs text-[#273C46]/50 mb-5">修改你的登录密码。修改后需要重新登录。</p>

        {/* Error */}
        {pwError && (
          <div className="flex items-start gap-2.5 mb-4 px-4 py-3 bg-red-50 border border-red-100 rounded-2xl text-sm text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{pwError}</span>
          </div>
        )}

        {/* Success */}
        {pwSuccess && (
          <div className="flex items-start gap-2.5 mb-4 px-4 py-3 bg-emerald-50 border border-emerald-100 rounded-2xl text-sm text-emerald-700">
            <Check className="w-4 h-4 shrink-0 mt-0.5" />
            <span>密码已更新成功</span>
          </div>
        )}

        <div className="space-y-4 max-w-md">
          <Field label="当前密码">
            <Input type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} placeholder="输入当前密码" />
          </Field>
          <Field label="新密码">
            <Input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="至少6个字符" />
          </Field>
          <Field label="确认新密码">
            <Input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} placeholder="再次输入新密码" />
          </Field>
        </div>

        <button
          onClick={handleChangePassword}
          disabled={changingPw}
          className="btn-primary text-sm px-6 py-2.5 mt-5 flex items-center gap-2 shadow-lg shadow-[#051A24]/10"
        >
          {changingPw ? (
            <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> 更新中...</>
          ) : (
            <><Lock className="w-4 h-4" /> 更新密码</>
          )}
        </button>
      </div>
    )
  }

  function renderNotificationsTab() {
    return (
      <div className="card p-6" style={{ borderRadius: 24 }}>
        <h3 className="text-base font-medium text-[#051A24] mb-1"
          style={{ fontFamily: "'PP Neue Montreal', 'Noto Sans SC', sans-serif", fontWeight: 500 }}>
          通知偏好
        </h3>
        <p className="text-xs text-[#273C46]/50 mb-5">选择你希望接收的通知类型。</p>

        <div className="space-y-3 max-w-lg">
          {NOTIFICATION_ITEMS.map(item => (
            <label
              key={item.key}
              className="flex items-center gap-3 p-3.5 rounded-2xl border border-[rgba(0,0,0,0.04)] hover:bg-[#fcfbfa] cursor-pointer transition-colors"
            >
              <input
                type="checkbox"
                checked={prefs[item.key] !== false}
                onChange={e => setPrefs({ ...prefs, [item.key]: e.target.checked })}
                className="w-4 h-4 rounded border-[rgba(0,0,0,0.15)] text-[#051A24] focus:ring-[#051A24]/10"
              />
              <div>
                <p className="text-sm font-medium text-[#051A24]">{item.label}</p>
                <p className="text-xs text-[#273C46]/50">{item.description}</p>
              </div>
            </label>
          ))}
        </div>

        <button
          onClick={handleSavePrefs}
          disabled={saving}
          className="btn-primary text-sm px-6 py-2.5 mt-5 flex items-center gap-2 shadow-lg shadow-[#051A24]/10"
        >
          {saving ? (
            <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> 保存中...</>
          ) : (
            <><Save className="w-4 h-4" /> 保存偏好</>
          )}
        </button>
      </div>
    )
  }

  return (
    <MemberLayout member={member}>
      <div className="animate-fade-in-up">
        {/* Header */}
        <div className="mb-2">
          <h1 className="text-[28px] font-medium text-[#051A24] tracking-tight"
            style={{ fontFamily: "'PP Neue Montreal', 'Noto Sans SC', sans-serif", fontWeight: 500 }}>
            个人设置
          </h1>
          <p className="text-sm text-[#273C46]/50 mt-1">管理你的个人资料、密码和通知偏好</p>
        </div>

        {/* Tab bar */}
        {renderTabBar()}

        {/* Tab content */}
        {tab === 'profile' && renderProfileTab()}
        {tab === 'security' && renderSecurityTab()}
        {tab === 'notifications' && renderNotificationsTab()}
      </div>
    </MemberLayout>
  )
}

/* ─── Mini form helpers ─── */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-[#273C46]/60 mb-1.5 ml-1">{label}</label>
      {children}
    </div>
  )
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full px-4 py-3 rounded-2xl border border-[rgba(0,0,0,0.08)] bg-[#fcfbfa]
        text-sm text-[#051A24] placeholder:text-[#273C46]/25
        focus:outline-none focus:border-[#051A24]/30 focus:ring-2 focus:ring-[#051A24]/5
        transition-all ${props.className || ''}`}
    />
  )
}
