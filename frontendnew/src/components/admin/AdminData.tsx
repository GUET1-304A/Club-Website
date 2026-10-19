import { useState, useRef } from 'react'
import { Download, Upload, Database, FileJson, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react'
import AdminLayout from './AdminLayout'
import ConfirmDialog from './ConfirmDialog'
import { useToast } from './Toast'
import { adminExport, adminImport } from '../../services/adminApi'
import type { ExportData } from '../../services/adminApi'

export default function AdminData() {
  const { toast } = useToast()
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importMode, setImportMode] = useState<'replace' | 'merge'>('merge')
  const [preview, setPreview] = useState<ExportData | null>(null)
  const [showConfirmImport, setShowConfirmImport] = useState(false)
  const [importResult, setImportResult] = useState<{ stats: Record<string, number>; mode: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleExport = async () => {
    setExporting(true)
    try {
      const data = await adminExport()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `xingyu-backup-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      const total = (data.members?.length || 0) + (data.projects?.length || 0) +
        (data.awards?.length || 0) + (data.blogs?.length || 0) +
        (data.pages?.length || 0) + Object.keys(data.config || {}).length
      toast('success', `已导出 ${total} 条数据`)
    } catch (e: unknown) {
      toast('error', (e as Error).message)
    } finally {
      setExporting(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string) as ExportData
        if (!data.version || !data.exported_at) {
          toast('error', '无效的备份文件格式')
          return
        }
        setPreview(data)
        setImportResult(null)
      } catch {
        toast('error', 'JSON 解析失败，请检查文件格式')
      }
    }
    reader.readAsText(file)

    // Reset input so same file can be re-selected
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleImport = async () => {
    if (!preview) return
    setImporting(true)
    setShowConfirmImport(false)
    try {
      const result = await adminImport(preview, importMode)
      setImportResult({ stats: result.stats, mode: result.mode })
      setPreview(null)
      toast('success', result.message)
    } catch (e: unknown) {
      toast('error', (e as Error).message)
    } finally {
      setImporting(false)
    }
  }

  const totalCount = (data: ExportData | null) => {
    if (!data) return 0
    return (data.members?.length || 0) + (data.projects?.length || 0) +
      (data.awards?.length || 0) + (data.blogs?.length || 0) +
      (data.pages?.length || 0) + Object.keys(data.config || {}).length
  }

  const statLabel = (key: string) =>
    ({ members: '成员', projects: '项目', awards: '奖项', blogs: '博客', pages: '页面', config: '配置' })[key] || key

  return (
    <AdminLayout>
      <div className="max-w-3xl">
        <h1 className="text-[28px] font-medium text-[#051A24] tracking-tight"
          style={{ fontFamily: "var(--font-sans)", fontWeight: 500 }}>
          数据管理
        </h1>
        <p className="text-sm text-[#273C46]/50 mt-1">导入 / 导出网站数据</p>

        {/* ─── Export ─── */}
        <div className="card p-6 mt-6" style={{ borderRadius: 24 }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#6b7cff] to-[#35bfd6] flex items-center justify-center shadow-lg shadow-[#6b7cff]/20">
              <Download className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#051A24]">导出数据</h2>
              <p className="text-xs text-[#273C46]/50">将所有网站数据导出为 JSON 备份文件</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button onClick={handleExport} disabled={exporting}
              className="btn-primary text-sm px-5 py-2.5 flex items-center gap-2">
              {exporting ? (
                <><RefreshCw className="w-4 h-4 animate-spin" /> 导出中...</>
              ) : (
                <><Download className="w-4 h-4" /> 一键导出 JSON</>
              )}
            </button>
            <span className="text-xs text-[#273C46]/40">
              导出内容包括：成员、项目、奖项、博客、页面、站点配置
            </span>
          </div>
        </div>

        {/* ─── Import ─── */}
        <div className="card p-6 mt-4" style={{ borderRadius: 24 }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0D212C] to-[#1a3a4a] flex items-center justify-center shadow-md">
              <Upload className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#051A24]">导入数据</h2>
              <p className="text-xs text-[#273C46]/50">从备份文件恢复数据</p>
            </div>
          </div>

          {/* Mode selector */}
          <div className="flex gap-2 mb-4">
            {([
              { value: 'merge', label: '合并模式', desc: '新增数据，跳过已存在的' },
              { value: 'replace', label: '替换模式', desc: '清空后重新导入' },
            ] as const).map(m => (
              <button
                key={m.value}
                onClick={() => setImportMode(m.value)}
                className={`flex-1 p-4 rounded-2xl border text-left transition-all
                  ${importMode === m.value
                    ? 'border-[#051A24] bg-[#051A24]/[0.03]'
                    : 'border-[rgba(0,0,0,0.06)] hover:border-[rgba(0,0,0,0.12)]'
                  }`}
              >
                <div className="text-sm font-semibold text-[#051A24]">{m.label}</div>
                <div className="text-xs text-[#273C46]/50 mt-0.5">{m.desc}</div>
              </button>
            ))}
          </div>

          {/* File input */}
          <div
            className="border-2 border-dashed border-[rgba(0,0,0,0.08)] rounded-2xl p-8 text-center
              hover:border-[rgba(0,0,0,0.15)] transition-colors cursor-pointer"
            onClick={() => fileRef.current?.click()}
          >
            <FileJson className="w-10 h-10 text-[#273C46]/20 mx-auto mb-3" />
            <p className="text-sm text-[#273C46]/60">
              点击选择 <span className="text-[#051A24] font-medium">.json</span> 备份文件
            </p>
            <p className="text-xs text-[#273C46]/30 mt-1">或拖拽文件到此处</p>
            <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleFileSelect} />
          </div>

          {/* Preview */}
          {preview && (
            <div className="mt-4 p-4 bg-[#fcfbfa] rounded-2xl border border-[rgba(0,0,0,0.06)]">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-[#051A24]">预览导入数据</h3>
                  <p className="text-xs text-[#273C46]/40">
                    导出时间：{preview.exported_at ? new Date(preview.exported_at).toLocaleString('zh-CN') : '未知'}
                  </p>
                </div>
                <button onClick={() => setPreview(null)} className="text-xs text-[#273C46]/40 hover:text-red-500 transition-colors">
                  清除
                </button>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {Object.entries({
                  members: preview.members?.length || 0,
                  projects: preview.projects?.length || 0,
                  awards: preview.awards?.length || 0,
                  blogs: preview.blogs?.length || 0,
                  pages: preview.pages?.length || 0,
                  config: Object.keys(preview.config || {}).length,
                }).map(([key, count]) => (
                  <div key={key} className="bg-white rounded-xl p-3 text-center border border-[rgba(0,0,0,0.04)]">
                    <div className="text-lg font-semibold text-[#051A24]">{count}</div>
                    <div className="text-[10px] text-[#273C46]/50 mt-0.5">{statLabel(key)}</div>
                  </div>
                ))}
              </div>

              {importMode === 'replace' && (
                <div className="flex items-center gap-2 mt-4 text-xs text-amber-700 bg-amber-50 rounded-xl px-3 py-2.5">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>替换模式将<strong>清空所有现有数据</strong>后导入，请确认已备份。</span>
                </div>
              )}

              <button
                onClick={() => setShowConfirmImport(true)}
                className="btn-primary w-full mt-4 py-3 text-sm font-medium flex items-center justify-center gap-2">
                <Upload className="w-4 h-4" />
                导入 {totalCount(preview)} 条数据
              </button>
            </div>
          )}

          {/* Import result */}
          {importResult && (
            <div className="mt-4 p-4 bg-emerald-50 rounded-2xl border border-emerald-200">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-semibold text-emerald-800">
                  导入完成（{importResult.mode === 'replace' ? '替换' : '合并'}模式）
                </h3>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {Object.entries(importResult.stats).map(([key, count]) => (
                  <div key={key} className="bg-white rounded-xl p-3 text-center border border-emerald-100">
                    <div className="text-lg font-semibold text-emerald-700">{count}</div>
                    <div className="text-[10px] text-emerald-600/60 mt-0.5">{statLabel(key)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="card p-5 mt-4" style={{ borderRadius: 20 }}>
          <div className="flex items-start gap-3">
            <Database className="w-5 h-5 text-[#273C46]/30 shrink-0 mt-0.5" />
            <div className="text-xs text-[#273C46]/50 leading-relaxed">
              <p className="font-medium text-[#273C46]/70 mb-1">数据管理说明</p>
              <ul className="space-y-1">
                <li>· 导出为 JSON 格式，可用于备份、迁移或版本控制</li>
                <li>· 合并模式：只添加新数据，已有数据不受影响</li>
                <li>· 替换模式：清除所有数据后重新导入，请先导出备份</li>
                <li>· 导入不会影响管理员账号和系统配置</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Confirm import dialog */}
      <ConfirmDialog
        open={showConfirmImport}
        title={importMode === 'replace' ? '替换导入确认' : '合并导入确认'}
        message={
          importMode === 'replace'
            ? `即将清空所有现有数据并导入 ${totalCount(preview)} 条新数据。此操作不可撤销，建议先导出备份。确认继续？`
            : `即将以合并模式导入 ${totalCount(preview)} 条数据，已存在的数据将被跳过。确认继续？`
        }
        variant={importMode === 'replace' ? 'danger' : 'default'}
        confirmLabel={importMode === 'replace' ? '清空并导入' : '开始导入'}
        onConfirm={handleImport}
        onCancel={() => setShowConfirmImport(false)}
        loading={importing}
      />
    </AdminLayout>
  )
}
