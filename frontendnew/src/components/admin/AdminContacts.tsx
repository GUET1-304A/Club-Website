import { useState, useEffect, useCallback } from 'react'
import { Eye, Reply, MessageSquare } from 'lucide-react'
import AdminLayout from './AdminLayout'
import AdminModal, { Textarea } from './AdminModal'
import TagPill from '../ui/TagPill'
import { useToast } from './Toast'
import { adminListContacts, adminUpdateContact } from '../../services/adminApi'
import type { AdminContact } from '../../services/adminApi'

const STATUS_MAP: Record<string, string> = { unread: '未读', read: '已读', replied: '已回复' }
const STATUS_STYLES: Record<string, string> = { unread: 'bg-blue-50 text-blue-700 border-blue-200', read: 'bg-gray-50 text-gray-400 border-gray-200', replied: 'bg-emerald-50 text-emerald-700 border-emerald-200' }

export default function AdminContacts() {
  const { toast } = useToast()
  const [msgs, setMsgs] = useState<AdminContact[]>([])
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<AdminContact | null>(null)
  const [reply, setReply] = useState('')
  const [replying, setReplying] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const params: Record<string, string> = {}
    if (status) params.status = status
    setMsgs(await adminListContacts(params).catch(() => []))
    setLoading(false)
  }, [status])
  useEffect(() => { load() }, [load])

  const handleMarkRead = async (id: number) => {
    try { await adminUpdateContact(id, { status: 'read' }); load() }
    catch (e: unknown) { toast('error', (e as Error).message) }
  }

  const handleReply = async () => {
    if (!detail || !reply.trim()) return
    setReplying(true)
    try { await adminUpdateContact(detail.id, { reply: reply.trim() }); toast('success', '回复已发送'); setDetail(null); setReply(''); load() }
    catch (e: unknown) { toast('error', (e as Error).message) } finally { setReplying(false) }
  }

  function renderContent() {
    if (loading) return <TableSkeleton />
    if (msgs.length === 0) return (
      <div className="flex flex-col items-center py-20 text-center"><div className="w-16 h-16 rounded-2xl bg-[#f0ece6] flex items-center justify-center mb-4"><MessageSquare className="w-7 h-7 text-[#273C46]/20" /></div><p className="text-sm text-[#273C46]/50">暂无留言</p></div>
    )
    return (
      <div className="card overflow-hidden" style={{ borderRadius: 24 }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-[#fcfbfa] border-b border-[rgba(0,0,0,0.06)]">{['主题', '发送者', '联系方式', '状态', '时间', ''].map(h => (<th key={h} className={`text-left px-5 py-3 text-[11px] font-semibold text-[#273C46]/40 uppercase tracking-wider ${h === '' ? 'text-right' : ''}`}>{h || '操作'}</th>))}</tr></thead>
            <tbody>
              {msgs.map((m) => (
                <tr key={m.id} className={`border-b border-[rgba(0,0,0,0.03)] hover:bg-[#fcfbfa] transition-colors ${m.status === 'unread' ? 'bg-blue-50/10' : ''}`}>
                  <td className="px-5 py-3 font-semibold text-[#051A24] max-w-[200px] truncate">{m.subject}</td>
                  <td className="px-5 py-3 text-[#273C46]/80 text-xs">{m.is_anonymous ? <span className="text-[#273C46]/40 italic">匿名用户</span> : m.name}</td>
                  <td className="px-5 py-3 text-[#273C46]/50 text-xs">{m.email}{m.phone ? ` · ${m.phone}` : ''}</td>
                  <td className="px-5 py-3"><span className={`inline-flex items-center gap-1 text-xs font-medium rounded-full px-2.5 py-1 border ${STATUS_STYLES[m.status] || ''}`}><span className={`w-1.5 h-1.5 rounded-full ${m.status === 'unread' ? 'bg-blue-500' : m.status === 'replied' ? 'bg-emerald-500' : 'bg-gray-300'}`} />{STATUS_MAP[m.status] || m.status}</span></td>
                  <td className="px-5 py-3 text-[#273C46]/30 text-xs whitespace-nowrap font-mono">{m.created_at ? new Date(m.created_at).toLocaleDateString('zh-CN') : ''}</td>
                  <td className="px-5 py-3 text-right">
                    <button onClick={() => { setDetail(m); setReply(''); if (m.status === 'unread') handleMarkRead(m.id) }} className="p-2 rounded-xl hover:bg-[rgba(0,0,0,0.04)] text-[#273C46]/40 hover:text-[#051A24] transition-all"><Eye className="w-4 h-4" /></button>
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
          <div><h1 className="text-[28px] font-medium text-[#051A24] tracking-tight" style={{ fontFamily: "var(--font-sans)", fontWeight: 500 }}>留言管理</h1><p className="text-sm text-[#273C46]/50 mt-1">{msgs.length} 条留言 · {msgs.filter(m => m.status === 'unread').length} 条未读</p></div>
        </div>
        <div className="flex gap-1.5 flex-wrap mb-6">
          {[{ value: '', label: '全部' }, { value: 'unread', label: '未读' }, { value: 'read', label: '已读' }, { value: 'replied', label: '已回复' }].map(s => (<TagPill key={s.value} label={s.label} variant="glass" active={status === s.value} onClick={() => setStatus(s.value)} />))}
        </div>
        {renderContent()}

        <AdminModal open={!!detail} title="留言详情" onClose={() => setDetail(null)}>
          {detail && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[['发送者', detail.is_anonymous ? '匿名用户' : detail.name], ['邮箱', detail.email || '—'], ['手机', detail.phone || '—'], ['时间', detail.created_at ? new Date(detail.created_at).toLocaleString('zh-CN') : '—']].map(([label, val]) => (<div key={label}><span className="text-[#273C46]/50 text-xs">{label}</span><p className="text-[#051A24] font-medium mt-0.5">{val}</p></div>))}
              </div>
              <div><span className="text-[#273C46]/50 text-xs">主题</span><p className="text-[#051A24] font-semibold mt-0.5">{detail.subject}</p></div>
              <div><span className="text-[#273C46]/50 text-xs">内容</span><p className="text-sm text-[#051A24] bg-[#f8f7f5] rounded-xl p-3 mt-1 whitespace-pre-wrap leading-relaxed">{detail.message}</p></div>
              {detail.reply ? (
                <div><span className="text-[#273C46]/50 text-xs">已回复</span><p className="text-sm text-emerald-700 bg-emerald-50 rounded-xl p-3 mt-1 whitespace-pre-wrap leading-relaxed">{detail.reply}</p></div>
              ) : (
                <div className="border-t border-[rgba(0,0,0,0.06)] pt-4">
                  <Textarea value={reply} onChange={e => setReply(e.target.value)} placeholder="输入回复内容..." rows={3} />
                  <button onClick={handleReply} disabled={replying || !reply.trim()} className="btn-primary w-full py-3 text-sm font-medium mt-3 flex items-center justify-center gap-2 disabled:opacity-50">
                    <Reply className="w-4 h-4" /> {replying ? '发送中...' : '发送回复'}
                  </button>
                </div>
              )}
            </div>
          )}
        </AdminModal>
      </div>
    </AdminLayout>
  )
}
function TableSkeleton() { return <div className="card overflow-hidden animate-pulse" style={{ borderRadius: 24 }}><div className="p-5 space-y-4">{Array.from({ length: 4 }).map((_, i) => (<div key={i} className="flex items-center gap-4"><div className="h-4 w-36 bg-[#f0ece6] rounded-lg flex-1" /><div className="h-4 w-16 bg-[#f0ece6] rounded-lg" /><div className="h-6 w-14 bg-[#f0ece6] rounded-full" /></div>))}</div></div> }
