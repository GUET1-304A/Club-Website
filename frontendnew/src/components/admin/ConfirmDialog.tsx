import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, X } from 'lucide-react'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'default'
  onConfirm: () => void
  onCancel: () => void
  loading?: boolean
}

export default function ConfirmDialog({
  open, title, message, confirmLabel = '确认', cancelLabel = '取消',
  variant = 'default', onConfirm, onCancel, loading,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = original }
  }, [open])

  if (!open) return null

  return createPortal((
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30 backdrop-blur-sm p-4" onClick={onCancel}>
      <div
        className="bg-white rounded-[28px] shadow-2xl w-full max-w-sm overflow-hidden animate-fade-in-scale"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[rgba(0,0,0,0.06)]">
          <div className="flex items-center gap-2">
            {variant === 'danger' && <AlertTriangle className="w-5 h-5 text-red-500" />}
            <h2 className="text-lg font-medium text-[#051A24]">{title}</h2>
          </div>
          <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-[rgba(0,0,0,0.04)] text-[#273C46] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6">
          <p className="text-sm text-[#273C46] leading-relaxed">{message}</p>

          <div className="flex gap-3 mt-6">
            <button onClick={onCancel} className="btn-secondary flex-1 text-sm py-2.5">
              {cancelLabel}
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className={`flex-1 text-sm py-2.5 rounded-full font-medium transition-all duration-300
                ${variant === 'danger'
                  ? 'bg-red-500 text-white hover:bg-red-600 shadow-sm'
                  : 'btn-primary'
                }
                ${loading ? 'opacity-60 cursor-not-allowed' : ''}
              `}
            >
              {loading ? '处理中...' : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  ), document.body)
}
