import { useState, useEffect, useCallback } from 'react'
import { Check, X, Eye, UserPlus, ExternalLink } from 'lucide-react'
import AdminLayout from './AdminLayout'
import AdminModal from './AdminModal'
import ConfirmDialog from './ConfirmDialog'
import TagPill from '../ui/TagPill'
import { useToast } from './Toast'
import { adminListApplications, adminUpdateApplication } from '../../services/adminApi'
import type { AdminApplication } from '../../services/adminApi'

const STATUS_COLORS: Record<string, string> = { pending: 'bg-amber-50 text-amber-700 border-amber-200', approved: 'bg-emerald-50 text-emerald-700 border-emerald-200', rejected: 'bg-red-50 text-red-500 border-red-200' }
const STATUS_LABELS: Record<string, string> = { pending: '待处理', approved: '已通过', rejected: '已拒绝' }

export default function AdminApplications() {
  const { toast } = useToast()
  const [apps, setApps] = useState<AdminApplication[]>([])
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<AdminApplication | null>(null)
  const [note, setNote] = useState('')
  const [confirmAction, setConfirmAction] = useState<{ app: AdminApplication; action: 'approved' | 'rejected' } | null>(null)
  const [acting, setActing] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const params: Record<string, string> = {}
    if (status) params.status = status
    setApps(await adminListApplications(params).catch(() => []))
    setLoading(false)
  }, [status])
  useEffect(() => { load() }, [load])

  const handleAction = async () => {
    if (!confirmAction) return; setActing(true)
    try {
      await adminUpdateApplication(confirmAction.app.id, { status: confirmAction.action, admin_note: note })
      toast('success', confirmAction.action === 'approved' ? '申请已通过' : '申请已拒绝')
      setConfirmAction(null); setNote(''); load()
    } catch (e: unknown) { toast('error', (e as Error).message) } finally { setActing(false) }
  }

  function renderContent() {
    if (loading) return <TableSkeleton />
    if (apps.length === 0) return (
      <div className="flex flex-col items-center py-20 text-center"><div className="w-16 h-16 rounded-2xl bg-[#f0ece6] flex items-center justify-center mb-4"><UserPlus className="w-7 h-7 text-[#273C46]/20" /></div><p className="text-sm text-[#273C46]/50">暂无申请</p></div>
    )
    return (
      <div className="card overflow-hidden" style={{ borderRadius: 24 }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-[#fcfbfa] border-b border-[rgba(0,0,0,0.06)]">{['姓名', '学号', '意向组别', '联系方式', '状态', '时间', ''].map(h => (<th key={h} className={`text-left px-5 py-3 text-[11px] font-semibold text-[#273C46]/40 uppercase tracking-wider ${h === '' ? 'text-right' : ''}`}>{h || '操作'}</th>))}</tr></thead>
            <tbody>
              {apps.map((a) => (
                <tr key={a.id} className={`border-b border-[rgba(0,0,0,0.03)] hover:bg-[#fcfbfa] transition-colors ${a.status === 'pending' ? 'bg-amber-50/10' : ''}`}>
                  <td className="px-5 py-3 font-semibold text-[#051A24]">{a.name}</td>
                  <td className="px-5 py-3 text-[#273C46]/60 text-xs font-mono">{a.student_id}</td>
                  <td className="px-5 py-3"><span className="text-xs bg-[#f0ece6] text-[#273C46] rounded-full px-2.5 py-1 font-medium">{a.group_name}</span></td>
                  <td className="px-5 py-3 text-[#273C46]/60 text-xs">{a.phone}<br/>{a.email}</td>
                  <td className="px-5 py-3"><span className={`inline-flex items-center gap-1 text-xs font-medium rounded-full px-2.5 py-1 border ${STATUS_COLORS[a.status] || ''}`}><span className={`w-1.5 h-1.5 rounded-full ${a.status === 'pending' ? 'bg-amber-500' : a.status === 'approved' ? 'bg-emerald-500' : 'bg-red-400'}`} />{STATUS_LABELS[a.status] || a.status}</span></td>
                  <td className="px-5 py-3 text-[#273C46]/30 text-xs whitespace-nowrap font-mono">{a.created_at ? new Date(a.created_at).toLocaleDateString('zh-CN') : ''}</td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-0.5">
                      <button onClick={() => { setDetail(a); setNote('') }} className="p-2 rounded-xl hover:bg-[rgba(0,0,0,0.04)] text-[#273C46]/40 hover:text-[#051A24] transition-all"><Eye className="w-4 h-4" /></button>
                      {a.status === 'pending' && (<>
                        <button onClick={() => { setConfirmAction({ app: a, action: 'approved' }); setNote('') }} className="p-2 rounded-xl hover:bg-emerald-50 text-[#273C46]/30 hover:text-emerald-600 transition-all"><Check className="w-4 h-4" /></button>
                        <button onClick={() => { setConfirmAction({ app: a, action: 'rejected' }); setNote('') }} className="p-2 rounded-xl hover:bg-red-50 text-[#273C46]/30 hover:text-red-500 transition-all"><X className="w-4 h-4" /></button>
                      </>)}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <AdminLayout>
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div><h1 className="text-[28px] font-medium text-[#051A24] tracking-tight" style={{ fontFamily: "'PP Neue Montreal', 'Noto Sans SC', sans-serif", fontWeight: 500 }}>入社申请</h1><p className="text-sm text-[#273C46]/50 mt-1">{apps.length} 条申请 · {apps.filter(a => a.status === 'pending').length} 条待处理</p></div>
        </div>
        <div className="flex gap-1.5 flex-wrap mb-6">
          {[{ value: '', label: '全部' }, { value: 'pending', label: '待处理' }, { value: 'approved', label: '已通过' }, { value: 'rejected', label: '已拒绝' }].map(s => (<TagPill key={s.value} label={s.label} active={status === s.value} onClick={() => setStatus(s.value)} />))}
        </div>
        {renderContent()}

        {/* Detail Modal */}
        <AdminModal open={!!detail} title={`${detail?.name || ''} 的申请`} onClose={() => setDetail(null)}>
          {detail && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[['姓名', detail.name], ['学号', detail.student_id], ['年级专业', detail.grade_major], ['意向组别', detail.group_name], ['手机', detail.phone], ['邮箱', detail.email]].map(([label, val]) => (<div key={label}><span className="text-[#273C46]/50 text-xs">{label}</span><p className="text-[#051A24] font-medium mt-0.5">{val}</p></div>))}
              </div>
              {detail.github_url && <div><span className="text-[#273C46]/50 text-xs">GitHub</span><a href={detail.github_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[#051A24] text-sm font-medium mt-0.5 hover:underline"><ExternalLink className="w-3 h-3" />{detail.github_url}</a></div>}
              {detail.experience && <div><span className="text-[#273C46]/50 text-xs">技能/经历</span><p className="text-sm text-[#051A24] bg-[#f8f7f5] rounded-xl p-3 mt-1 whitespace-pre-wrap leading-relaxed">{detail.experience}</p></div>}
              <div><span className="text-[#273C46]/50 text-xs">申请动机</span><p className="text-sm text-[#051A24] bg-[#f8f7f5] rounded-xl p-3 mt-1 whitespace-pre-wrap leading-relaxed">{detail.motivation}</p></div>
            </div>
          )}
        </AdminModal>

        {/* Confirm action */}
        <ConfirmDialog
          open={!!confirmAction}
          title={confirmAction?.action === 'approved' ? '通过申请' : '拒绝申请'}
          message={`确定要${confirmAction?.action === 'approved' ? '通过' : '拒绝'}「${confirmAction?.app.name}」的申请吗？`}
          variant={confirmAction?.action === 'rejected' ? 'danger' : 'default'}
          confirmLabel={confirmAction?.action === 'approved' ? '通过' : '拒绝'}
          onConfirm={handleAction}
          onCancel={() => setConfirmAction(null)}
          loading={acting}
        />
      </div>
    </AdminLayout>
  )
}
function TableSkeleton() { return <div className="card overflow-hidden animate-pulse" style={{ borderRadius: 24 }}><div className="p-5 space-y-4">{Array.from({ length: 4 }).map((_, i) => (<div key={i} className="flex items-center gap-4"><div className="h-4 w-20 bg-[#f0ece6] rounded-lg" /><div className="h-4 w-24 bg-[#f0ece6] rounded-lg" /><div className="h-6 w-14 bg-[#f0ece6] rounded-full" /><div className="h-4 w-28 bg-[#f0ece6] rounded-lg ml-auto" /></div>))}</div></div> }
