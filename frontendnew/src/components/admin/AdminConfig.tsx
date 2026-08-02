import { useState, useEffect } from 'react'
import { Save } from 'lucide-react'
import AdminLayout from './AdminLayout'
import { useToast } from './Toast'
import { adminGetConfig, adminUpdateConfig } from '../../services/adminApi'

export default function AdminConfig() {
  const { toast } = useToast()
  const [config, setConfig] = useState<Record<string, unknown>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeSection, setActiveSection] = useState('hero')

  useEffect(() => {
    adminGetConfig()
      .then(data => { setConfig(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      await adminUpdateConfig(config)
      toast('success', '配置已保存')
    } catch (e: unknown) { toast('error', (e as Error).message) }
    finally { setSaving(false) }
  }

  const updateSection = (key: string, value: unknown) => {
    setConfig({ ...config, [key]: value })
  }

  const sections = [
    { key: 'hero', label: 'Hero 区域' },
    { key: 'about', label: '关于我们' },
    { key: 'members', label: '成员区域' },
    { key: 'footer', label: '页脚' },
    { key: 'sections', label: '区块开关' },
  ]

  if (loading) return <AdminLayout><div className="text-center py-12 text-[#273C46]/60">加载中...</div></AdminLayout>

  return (
    <AdminLayout>
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-medium text-[#051A24]">站点配置</h1>
            <p className="text-sm text-[#273C46]/60 mt-1">全局站点设置</p>
          </div>
          <button onClick={handleSave} disabled={saving} className="btn-primary text-sm px-4 py-2 flex items-center gap-2">
            <Save className="w-4 h-4" /> {saving ? '保存中...' : '保存配置'}
          </button>
        </div>

        <div className="flex gap-6">
          {/* Section tabs */}
          <div className="w-40 shrink-0 space-y-1">
            {sections.map(s => (
              <button key={s.key} onClick={() => setActiveSection(s.key)}
                className={`w-full text-left px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${activeSection === s.key ? 'bg-[#051A24] text-white' : 'text-[#273C46] hover:bg-[rgba(0,0,0,0.04)]'}`}>
                {s.label}
              </button>
            ))}
          </div>

          {/* Editor area */}
          <div className="flex-1 min-w-0">
            <div className="card p-6" style={{ borderRadius: 24 }}>
              {activeSection === 'hero' && (
                <SectionEditor
                  title="Hero 区域"
                  data={config.hero as Record<string, unknown> || {}}
                  onChange={(val) => updateSection('hero', val)}
                  fields={[
                    { key: 'eyebrow', label: '标签文字', type: 'text' },
                    { key: 'title', label: '主标题', type: 'textarea' },
                    { key: 'description', label: '描述', type: 'textarea' },
                    { key: 'video_url', label: '背景视频 URL（留空使用默认）', type: 'text' },
                  ]}
                />
              )}
              {activeSection === 'about' && (
                <SectionEditor
                  title="关于我们"
                  data={config.about as Record<string, unknown> || {}}
                  onChange={(val) => updateSection('about', val)}
                  fields={[
                    { key: 'title', label: '标题', type: 'text' },
                    { key: 'description', label: '描述', type: 'textarea' },
                  ]}
                />
              )}
              {activeSection === 'members' && (
                <SectionEditor
                  title="成员区域"
                  data={config.members as Record<string, unknown> || {}}
                  onChange={(val) => updateSection('members', val)}
                  fields={[
                    { key: 'description', label: '描述', type: 'textarea' },
                  ]}
                />
              )}
              {activeSection === 'footer' && (
                <SectionEditor
                  title="页脚"
                  data={config.footer as Record<string, unknown> || {}}
                  onChange={(val) => updateSection('footer', val)}
                  fields={[
                    { key: 'brand', label: '品牌名', type: 'text' },
                    { key: 'slogan', label: '标语', type: 'text' },
                    { key: 'logo', label: 'Logo 路径', type: 'text' },
                  ]}
                />
              )}
              {activeSection === 'sections' && (
                <SectionEditor
                  title="区块开关"
                  data={config.sections as Record<string, unknown> || {}}
                  onChange={(val) => updateSection('sections', val)}
                  fields={[
                    { key: 'hero_enabled', label: 'Hero', type: 'toggle' },
                    { key: 'about_enabled', label: '关于', type: 'toggle' },
                    { key: 'members_enabled', label: '成员', type: 'toggle' },
                    { key: 'projects_enabled', label: '项目', type: 'toggle' },
                    { key: 'awards_enabled', label: '奖项', type: 'toggle' },
                    { key: 'join_enabled', label: '加入 CTA', type: 'toggle' },
                  ]}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}

function SectionEditor({ title, data, onChange, fields }: {
  title: string
  data: Record<string, unknown>
  onChange: (val: Record<string, unknown>) => void
  fields: { key: string; label: string; type: 'text' | 'textarea' | 'toggle' }[]
}) {
  return (
    <div>
      <h3 className="text-sm font-medium text-[#051A24] mb-4">{title}</h3>
      <div className="space-y-4">
        {fields.map(f => (
          <div key={f.key}>
            <label className="block text-xs font-medium text-[#273C46]/60 mb-1.5">{f.label}</label>
            {f.type === 'toggle' ? (
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={!!data[f.key]} onChange={e => onChange({ ...data, [f.key]: e.target.checked })}
                  className="rounded border-[rgba(0,0,0,0.2)]" />
                <span className="text-sm text-[#273C46]">{data[f.key] ? '开启' : '关闭'}</span>
              </label>
            ) : f.type === 'textarea' ? (
              <textarea value={String(data[f.key] || '')} onChange={e => onChange({ ...data, [f.key]: e.target.value })} rows={3}
                className="w-full px-4 py-2 rounded-xl border border-[rgba(0,0,0,0.08)] text-sm focus:outline-none focus:border-[#051A24] resize-none" />
            ) : (
              <input type="text" value={String(data[f.key] || '')} onChange={e => onChange({ ...data, [f.key]: e.target.value })}
                className="w-full px-4 py-2 rounded-xl border border-[rgba(0,0,0,0.08)] text-sm focus:outline-none focus:border-[#051A24]" />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
