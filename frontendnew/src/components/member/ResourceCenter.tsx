import { useState, useEffect, useCallback, useRef } from 'react'
import {
  FolderOpen, File, Upload, FolderPlus, Search, ArrowLeft,
  ChevronRight, Download, Trash2, FileText,
  Image, Film, Archive, Code,
} from 'lucide-react'
import MemberLayout from './MemberLayout'
import {
  memberListFolders, memberCreateFolder,
  memberListFiles, memberUploadResource, memberDeleteResource,
  type MemberProfile, type ResourceFolderData, type ResourceFileData,
} from '../../services/memberApi'
import { useToast } from '../admin/Toast'

/* ─── File type icon mapper ─── */
function fileIcon(ext?: string) {
  if (!ext) return FileText
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return Image
  if (['mp4', 'webm'].includes(ext)) return Film
  if (['zip', 'rar'].includes(ext)) return Archive
  if (['py', 'js', 'ts', 'html', 'css', 'java', 'go', 'rs', 'json'].includes(ext)) return Code
  if (['pdf'].includes(ext)) return FileText
  return File
}

function formatSize(bytes?: number) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/* ═══════════════════════════════════════════════════════════════ */

export default function ResourceCenter({ member }: { member: MemberProfile }) {
  const { toast } = useToast()
  const [folders, setFolders] = useState<ResourceFolderData[]>([])
  const [files, setFiles] = useState<ResourceFileData[]>([])
  const [currentFolder, setCurrentFolder] = useState<ResourceFolderData | null>(null)
  const [folderStack, setFolderStack] = useState<ResourceFolderData[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const parentId = currentFolder?.id
    const [foldersData, filesData] = await Promise.all([
      memberListFolders(parentId).catch(() => []),
      memberListFiles({ folderId: parentId, search: search || undefined }).catch(() => []),
    ])
    setFolders(foldersData)
    setFiles(filesData)
    setLoading(false)
  }, [currentFolder, search])

  useEffect(() => { load() }, [load])

  /* ── Navigation ── */
  const navigateTo = (folder: ResourceFolderData | null) => {
    if (currentFolder) setFolderStack(prev => [...prev, currentFolder])
    setCurrentFolder(folder)
    setSearch('')
  }

  const goBack = () => {
    const prev = folderStack[folderStack.length - 1]
    setFolderStack(s => s.slice(0, -1))
    setCurrentFolder(prev || null)
    setSearch('')
  }

  const goRoot = () => {
    setCurrentFolder(null)
    setFolderStack([])
    setSearch('')
  }

  /* ── Actions ── */
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) { setShowNewFolder(false); return }
    try {
      await memberCreateFolder(newFolderName.trim(), currentFolder?.id)
      toast('success', '文件夹已创建')
      setNewFolderName('')
      setShowNewFolder(false)
      load()
    } catch (e: unknown) { toast('error', (e as Error).message) }
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      await memberUploadResource(file, currentFolder?.id)
      toast('success', `「${file.name}」已上传`)
      load()
    } catch (err: unknown) { toast('error', (err as Error).message) }
    e.target.value = ''
  }

  const handleDelete = async (f: ResourceFileData) => {
    if (!confirm(`确定要删除「${f.name}」吗？`)) return
    try {
      await memberDeleteResource(f.id)
      toast('success', '文件已移到回收站')
      load()
    } catch (e: unknown) { toast('error', (e as Error).message) }
  }

  /* ── Breadcrumb ── */
  const breadcrumbs = []
  let c: ResourceFolderData | null = currentFolder
  while (c) {
    breadcrumbs.unshift(c)
    c = null // simplified; full path requires tree traversal
  }

  return (
    <MemberLayout member={member}>
      <div className="animate-fade-in-up">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-[28px] font-medium text-[#051A24] tracking-tight"
              style={{ fontFamily: "var(--font-sans)", fontWeight: 500 }}>
              资源中心
            </h1>
            <p className="text-sm text-[#273C46]/50 mt-1">
              {files.length + folders.length} 个项目
              {currentFolder && <span> · {currentFolder.name}</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowNewFolder(true)}
              className="btn-secondary text-xs px-4 py-2.5 flex items-center gap-1.5">
              <FolderPlus className="w-3.5 h-3.5" /> 新建文件夹
            </button>
            <button onClick={() => fileInputRef.current?.click()}
              className="btn-primary text-xs px-4 py-2.5 flex items-center gap-1.5 shadow-lg shadow-[#051A24]/10">
              <Upload className="w-3.5 h-3.5" /> 上传文件
            </button>
            <input ref={fileInputRef} type="file" className="hidden" onChange={handleUpload} />
          </div>
        </div>

        <div className="flex gap-6">
          {/* Sidebar — Folder tree */}
          <div className="hidden lg:block w-56 shrink-0">
            <div className="card p-3" style={{ borderRadius: 20 }}>
              <button
                onClick={goRoot}
                className={`flex items-center gap-2 w-full px-3 py-2 rounded-xl text-sm font-medium transition-all
                  ${!currentFolder ? 'bg-[#051A24] text-white' : 'text-[#273C46] hover:bg-[rgba(0,0,0,0.02)]'}`}
              >
                <FolderOpen className="w-4 h-4" strokeWidth={1.5} />
                全部文件
              </button>
              <div className="mt-1">
                {folders.map(f => (
                  <button
                    key={f.id}
                    onClick={() => navigateTo(f)}
                    className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-sm text-[#273C46]/70
                      hover:bg-[rgba(0,0,0,0.02)] hover:text-[#051A24] transition-all"
                  >
                    <ChevronRight className="w-3 h-3 text-[#273C46]/30" />
                    <FolderOpen className="w-4 h-4" strokeWidth={1.5} />
                    <span className="truncate">{f.name}</span>
                    {f.fileCount ? <span className="text-[10px] text-[#273C46]/30 ml-auto">{f.fileCount}</span> : null}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            {/* Toolbar */}
            <div className="flex items-center gap-3 mb-4">
              {currentFolder && (
                <button onClick={goBack}
                  className="flex items-center gap-1 text-xs text-[#273C46]/50 hover:text-[#051A24] transition-colors shrink-0">
                  <ArrowLeft className="w-3.5 h-3.5" /> 返回上级
                </button>
              )}
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#273C46]/25" />
                <input
                  type="text" value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="搜索文件..."
                  className="w-full pl-10 pr-4 py-2 rounded-2xl border border-[rgba(0,0,0,0.06)] bg-white text-sm
                    placeholder:text-[#273C46]/30 focus:outline-none focus:border-[#051A24]/30"
                />
              </div>
            </div>

            {/* New folder input */}
            {showNewFolder && (
              <div className="flex items-center gap-2 mb-4 bg-white rounded-2xl border border-[rgba(0,0,0,0.06)] p-2 max-w-xs">
                <FolderPlus className="w-4 h-4 text-[#273C46]/30 ml-2" />
                <input
                  autoFocus
                  value={newFolderName}
                  onChange={e => setNewFolderName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleCreateFolder(); if (e.key === 'Escape') setShowNewFolder(false) }}
                  placeholder="文件夹名称"
                  className="flex-1 text-sm bg-transparent outline-none text-[#051A24] placeholder:text-[#273C46]/30"
                />
                <button onClick={handleCreateFolder} className="text-xs bg-[#051A24] text-white rounded-xl px-3 py-1 font-medium">创建</button>
              </div>
            )}

            {/* Content */}
            {loading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="card p-4 animate-pulse flex flex-col items-center gap-2" style={{ borderRadius: 20 }}>
                    <div className="w-10 h-10 rounded-xl bg-[#f0ece6]" />
                    <div className="h-3 w-20 bg-[#f0ece6] rounded-md" />
                  </div>
                ))}
              </div>
            ) : folders.length + files.length === 0 ? (
              <div className="flex flex-col items-center py-16 text-center">
                <FolderOpen className="w-12 h-12 text-[#273C46]/15 mb-3" />
                <p className="text-sm text-[#273C46]/50">此文件夹为空</p>
                <p className="text-xs text-[#273C46]/30 mt-1">上传文件或创建子文件夹</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                {/* Folders first */}
                {folders.map(f => (
                  <button
                    key={f.id}
                    onClick={() => navigateTo(f)}
                    className="card p-4 flex flex-col items-center gap-2 group hover:translate-y-[-2px] transition-all text-center"
                    style={{ borderRadius: 20 }}
                  >
                    <FolderOpen className="w-10 h-10 text-[#273C46]/25 group-hover:text-[#051A24]/40 transition-colors" />
                    <span className="text-xs font-medium text-[#051A24] truncate w-full">{f.name}</span>
                    {f.fileCount ? <span className="text-[10px] text-[#273C46]/30">{f.fileCount} 文件</span> : null}
                  </button>
                ))}
                {/* Files */}
                {files.map(f => {
                  const Icon = fileIcon(f.fileType)
                  return (
                    <div
                      key={f.id}
                      className="card p-4 flex flex-col items-center gap-2 group relative"
                      style={{ borderRadius: 20 }}
                    >
                      <Icon className="w-10 h-10 text-[#273C46]/25" />
                      <span className="text-xs font-medium text-[#051A24] truncate w-full text-center">{f.name}</span>
                      <span className="text-[10px] text-[#273C46]/30">{formatSize(f.fileSize)}</span>
                      {f.uploaderName && (
                        <span className="text-[10px] text-[#273C46]/25">{f.uploaderName}</span>
                      )}
                      {/* Actions overlay */}
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5">
                        <a href={f.filePath} download target="_blank" rel="noreferrer"
                          className="p-1.5 rounded-lg bg-white shadow-sm text-[#273C46]/50 hover:text-[#051A24] transition-all"
                          title="下载">
                          <Download className="w-3 h-3" />
                        </a>
                        <button onClick={() => handleDelete(f)}
                          className="p-1.5 rounded-lg bg-white shadow-sm text-[#273C46]/30 hover:text-red-500 transition-all"
                          title="删除">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </MemberLayout>
  )
}
