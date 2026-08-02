import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'

interface AdminModalProps {
  open: boolean
  title: string
  children: ReactNode
  onClose: () => void
  maxWidth?: string
}

export default function AdminModal({ open, title, children, onClose, maxWidth = 'max-w-lg' }: AdminModalProps) {
  useEffect(() => {
    if (!open) return
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = original }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className={`bg-white rounded-[28px] shadow-2xl w-full ${maxWidth} animate-fade-in-up`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[rgba(0,0,0,0.06)]">
          <h2 className="text-lg font-medium text-[#051A24]">{title}</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-[rgba(0,0,0,0.04)] text-[#273C46]/60 hover:text-[#051A24] transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          {children}
        </div>
      </div>
    </div>
  )
}

/* ===== Shared form field component used across admin pages ===== */
export function Field({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-[#273C46]/60 mb-1.5">{label}</label>
      {children}
    </div>
  )
}

export function Input({ className = '', ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full px-4 py-2.5 rounded-xl border border-[rgba(0,0,0,0.08)] text-sm text-[#051A24] placeholder:text-[#273C46]/40
        focus:outline-none focus:border-[#051A24] focus:ring-1 focus:ring-[#051A24]/10 transition-all
        disabled:bg-[#f8f7f5] disabled:text-[#273C46]/50 ${className}`}
      {...props}
    />
  )
}

export function Select({ className = '', children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`w-full px-4 py-2.5 rounded-xl border border-[rgba(0,0,0,0.08)] text-sm text-[#051A24]
        focus:outline-none focus:border-[#051A24] focus:ring-1 focus:ring-[#051A24]/10 transition-all
        bg-white ${className}`}
      {...props}
    >
      {children}
    </select>
  )
}

export function Textarea({ className = '', ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`w-full px-4 py-2.5 rounded-xl border border-[rgba(0,0,0,0.08)] text-sm text-[#051A24] placeholder:text-[#273C46]/40
        focus:outline-none focus:border-[#051A24] focus:ring-1 focus:ring-[#051A24]/10 transition-all resize-none
        ${className}`}
      {...props}
    />
  )
}
