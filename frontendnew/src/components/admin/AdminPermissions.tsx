import { useState, useEffect, useCallback } from 'react'
import { Mail, Users, Plus, KeyRound } from 'lucide-react'
import AdminLayout from './AdminLayout'
import AdminModal, { Field, Input, Select } from './AdminModal'
import {
  adminListUsers, adminCreateUser, adminUpdateUser,
  type AdminUserData,
} from '../../services/adminApi'
import { useToast } from './Toast'

export default function AdminPermissions() {
  const { toast } = useToast()
  const [users, setUsers] = useState<AdminUserData[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<AdminUserData | null>(null)
  const [form, setForm] = useState({ username: '', password: '', role: 'teacher' as 'admin' | 'teacher', email: '' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const data = await adminListUsers().catch(() => [])
    setUsers(data)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const openCreate = () => {
    setEditing(null)
    setForm({ username: '', password: '', role: 'teacher', email: '' })
    setModalOpen(true)
  }

  const openEdit = (user: AdminUserData) => {
    setEditing(user)
    setForm({ username: user.username, password: '', role: user.role, email: user.email || '' })
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!form.username.trim()) { toast('warning', '请填写用户名'); return }
    if (!editing && form.password.length < 6) { toast('warning', '密码至少需要6个字符'); return }
    setSaving(true)
    try {
      if (editing) {
        const payload: { password?: string; role: 'admin' | 'teacher'; email: string } = { role: form.role, email: form.email.trim() }
        if (form.password) payload.password = form.password
        await adminUpdateUser(editing.id, payload)
        toast('success', '账号已更新')
      } else {
        await adminCreateUser({ username: form.username.trim(), password: form.password, role: form.role, email: form.email.trim() })
        toast('success', '账号已创建')
      }
      setModalOpen(false)
      load()
    } catch (e: unknown) {
      toast('error', (e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <AdminLayout>
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-[28px] font-medium text-[#051A24] tracking-tight"
              style={{ fontFamily: "'PP Neue Montreal', 'Noto Sans SC', sans-serif", fontWeight: 500 }}>
              权限管理
            </h1>
            <p className="text-sm text-[#273C46]/50 mt-1">管理员可创建教师账号并分配权限</p>
          </div>
          <button onClick={openCreate}
            className="btn-primary text-xs px-4 py-2.5 inline-flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" /> 新建账号
          </button>
        </div>

        {loading ? (
          <div className="card p-4 animate-pulse flex items-center gap-4" style={{ borderRadius: 20 }}>
            <div className="w-9 h-9 rounded-xl bg-[#f0ece6]" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-48 bg-[#f0ece6] rounded-lg" />
              <div className="h-3 w-32 bg-[#f0ece6] rounded-md" />
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {users.map(user => (
              <div key={user.id} className="card p-4 flex items-center gap-4" style={{ borderRadius: 20 }}>
                <div className="w-9 h-9 rounded-xl bg-[#051A24] flex items-center justify-center">
                  <Users className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#051A24]">{user.username}</p>
                  <p className="text-[11px] text-[#273C46]/50 mt-0.5">
                    {user.role === 'teacher' ? '教师' : '管理员'}
                    {user.email ? ` · ${user.email}` : ''}
                  </p>
                </div>
                <button onClick={() => openEdit(user)}
                  className="btn-secondary text-xs px-3 py-2 inline-flex items-center gap-1.5">
                  <KeyRound className="w-3 h-3" /> 重置密码 / 角色
                </button>
              </div>
            ))}
          </div>
        )}

        <AdminModal open={modalOpen} title={editing ? `编辑账号：${editing.username}` : '新建后台账号'}
          onClose={() => setModalOpen(false)} maxWidth="max-w-md">
          <div className="space-y-4">
            <Field label="用户名">
              <Input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} disabled={!!editing} />
            </Field>
            <Field label="通知邮箱">
              <div className="relative">
                <Mail className="w-4 h-4 text-[#273C46]/35 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="teacher@example.com" className="pl-9" />
              </div>
            </Field>
            <Field label={editing ? '新密码（留空不修改）' : '密码'}>
              <Input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="至少6个字符" />
            </Field>
            <Field label="角色">
              <Select value={form.role} onChange={e => setForm({ ...form, role: e.target.value as 'admin' | 'teacher' })}>
                <option value="teacher">教师（审阅周报/审核证书/查看成员项目）</option>
                <option value="admin">管理员（全部权限）</option>
              </Select>
            </Field>
            <button onClick={handleSave} disabled={saving}
              className="btn-primary w-full py-3 text-sm font-medium disabled:opacity-50">
              {saving ? '保存中...' : (editing ? '保存修改' : '创建账号')}
            </button>
          </div>
        </AdminModal>
      </div>
    </AdminLayout>
  )
}
