import { useState, useEffect } from 'react'
import { Plus, Save, Trash2 } from 'lucide-react'
import AdminLayout from './AdminLayout'
import { useToast } from './Toast'
import { adminGetConfig, adminUpdateConfig } from '../../services/adminApi'

type WeeklyTemplateField = {
  key: string
  label: string
  required: boolean
  placeholder: string
  rows: number
}

type WeeklyTemplate = {
  title: string
  fields: WeeklyTemplateField[]
}

const DEFAULT_WEEKLY_TEMPLATE: WeeklyTemplate = {
  title: '周报模板',
  fields: [
    { key: 'done', label: '本周完成', required: true, placeholder: '本周完成了哪些工作？', rows: 3 },
    { key: 'plan', label: '下周计划', required: false, placeholder: '下周计划做什么？', rows: 2 },
    { key: 'issues', label: '遇到的问题', required: false, placeholder: '遇到的问题、风险或需要帮助的地方（可选）', rows: 2 },
    { key: 'summary', label: '一句话总结', required: false, placeholder: '本周整体进展的一句话总结', rows: 2 },
  ],
}

function normalizeWeeklyTemplate(value: unknown): WeeklyTemplate {
  const data = value && typeof value === 'object' ? value as Partial<WeeklyTemplate> : {}
  const fields = Array.isArray(data.fields) && data.fields.length > 0 ? data.fields : DEFAULT_WEEKLY_TEMPLATE.fields
  return {
    title: String(data.title || DEFAULT_WEEKLY_TEMPLATE.title),
    fields: fields.map(field => ({
      key: String(field.key || ''),
      label: String(field.label || ''),
      required: !!field.required,
      placeholder: String(field.placeholder || ''),
      rows: Math.max(1, Math.min(6, Number(field.rows || 2))),
    })).filter(field => field.key && field.label),
  }
}

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
    { key: 'projects', label: '作品区域' },
    { key: 'awards', label: '奖项区域' },
    { key: 'join', label: '加入区域' },
    { key: 'footer', label: '页脚' },
    { key: 'icp', label: '备案信息' },
    { key: 'contact', label: '联系我们' },
    { key: 'sections', label: '区块开关' },
    { key: 'weekly_report_template', label: '周报模板' },
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
                    { key: 'title', label: '主标题（**文字** 为衬线强调，换行即换行）', type: 'textarea' },
                    { key: 'description', label: '描述（空一行分段）', type: 'textarea' },
                    { key: 'video_url', label: '背景视频 URL（留空使用默认）', type: 'text' },
                    { key: 'primary_label', label: '主按钮文字', type: 'text' },
                    { key: 'primary_href', label: '主按钮链接', type: 'text' },
                    { key: 'secondary_label', label: '次按钮文字', type: 'text' },
                    { key: 'secondary_href', label: '次按钮链接', type: 'text' },
                  ]}
                />
              )}
              {activeSection === 'about' && (
                <SectionEditor
                  title="关于我们"
                  data={config.about as Record<string, unknown> || {}}
                  onChange={(val) => updateSection('about', val)}
                  fields={[
                    { key: 'title', label: '标题（**文字** 为衬线强调，换行即换行）', type: 'text' },
                    { key: 'description', label: '描述', type: 'textarea' },
                    { key: 'extra', label: '第二段描述（可选）', type: 'textarea' },
                  ]}
                />
              )}
              {activeSection === 'members' && (
                <SectionEditor
                  title="成员区域"
                  data={config.members as Record<string, unknown> || {}}
                  onChange={(val) => updateSection('members', val)}
                  fields={[
                    { key: 'eyebrow', label: '英文标签（如 TEAM）', type: 'text' },
                    { key: 'title', label: '标题（**文字** 为衬线强调）', type: 'text' },
                    { key: 'description', label: '描述', type: 'textarea' },
                    { key: 'cta', label: '底部按钮文字', type: 'text' },
                  ]}
                />
              )}
              {activeSection === 'projects' && (
                <SectionEditor
                  title="作品区域"
                  data={config.projects as Record<string, unknown> || {}}
                  onChange={(val) => updateSection('projects', val)}
                  fields={[
                    { key: 'eyebrow', label: '英文标签（如 WORKS）', type: 'text' },
                    { key: 'title', label: '标题（**文字** 为衬线强调）', type: 'text' },
                    { key: 'cta', label: '底部按钮文字', type: 'text' },
                  ]}
                />
              )}
              {activeSection === 'awards' && (
                <SectionEditor
                  title="奖项区域"
                  data={config.awards as Record<string, unknown> || {}}
                  onChange={(val) => updateSection('awards', val)}
                  fields={[
                    { key: 'eyebrow', label: '英文标签（如 HONORS）', type: 'text' },
                    { key: 'title', label: '标题（**文字** 为衬线强调）', type: 'text' },
                    { key: 'cta', label: '底部按钮文字', type: 'text' },
                  ]}
                />
              )}
              {activeSection === 'join' && (
                <SectionEditor
                  title="加入区域"
                  data={config.join as Record<string, unknown> || {}}
                  onChange={(val) => updateSection('join', val)}
                  fields={[
                    { key: 'eyebrow', label: '左侧英文标签', type: 'text' },
                    { key: 'title', label: '左侧标题（**文字** 为衬线强调）', type: 'text' },
                    { key: 'cta_eyebrow', label: '右侧英文标签', type: 'text' },
                    { key: 'cta_title', label: '右侧标题（**文字** 为衬线强调）', type: 'text' },
                    { key: 'cta_description', label: '右侧描述', type: 'textarea' },
                    { key: 'cta_button', label: '右侧按钮文字', type: 'text' },
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
                    { key: 'description', label: '页脚介绍', type: 'textarea' },
                    { key: 'github_url', label: 'GitHub 链接', type: 'text' },
                    { key: 'email', label: '联系邮箱', type: 'text' },
                  ]}
                />
              )}
              {activeSection === 'icp' && (
                <SectionEditor
                  title="备案信息"
                  data={config.icp as Record<string, unknown> || {}}
                  onChange={(val) => updateSection('icp', val)}
                  fields={[
                    { key: 'number', label: 'ICP 备案号', type: 'text' },
                    { key: 'url', label: '备案查询链接', type: 'text' },
                    { key: 'police_number', label: '公安联网备案号（办好后填）', type: 'text' },
                    { key: 'police_url', label: '公安备案链接', type: 'text' },
                  ]}
                />
              )}
              {activeSection === 'contact' && (
                <SectionEditor
                  title="联系我们"
                  data={config.contact as Record<string, unknown> || {}}
                  onChange={(val) => updateSection('contact', val)}
                  fields={[
                    { key: 'address', label: '地址', type: 'text' },
                    { key: 'email', label: '邮箱', type: 'text' },
                    { key: 'phone', label: '电话', type: 'text' },
                    { key: 'hours', label: '开放时间', type: 'text' },
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
                    { key: 'announcement_enabled', label: '公告动态', type: 'toggle' },
                    { key: 'join_enabled', label: '加入 CTA', type: 'toggle' },
                  ]}
                />
              )}
              {activeSection === 'weekly_report_template' && (
                <WeeklyTemplateEditor
                  data={normalizeWeeklyTemplate(config.weekly_report_template)}
                  onChange={(val) => updateSection('weekly_report_template', val)}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}

function WeeklyTemplateEditor({ data, onChange }: {
  data: WeeklyTemplate
  onChange: (val: WeeklyTemplate) => void
}) {
  const updateField = (index: number, patch: Partial<WeeklyTemplateField>) => {
    onChange({
      ...data,
      fields: data.fields.map((field, i) => i === index ? { ...field, ...patch } : field),
    })
  }

  const addField = () => {
    const nextIndex = data.fields.length + 1
    onChange({
      ...data,
      fields: [
        ...data.fields,
        {
          key: `custom_${nextIndex}`,
          label: '自定义字段',
          required: false,
          placeholder: '',
          rows: 2,
        },
      ],
    })
  }

  const removeField = (index: number) => {
    if (data.fields.length <= 1) return
    onChange({ ...data, fields: data.fields.filter((_, i) => i !== index) })
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className="text-sm font-medium text-[#051A24]">周报模板</h3>
        <button onClick={addField} className="btn-secondary text-xs px-3 py-2 inline-flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" /> 添加字段
        </button>
      </div>
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-[#273C46]/60 mb-1.5">模板名称</label>
          <input type="text" value={data.title} onChange={e => onChange({ ...data, title: e.target.value })}
            className="w-full px-4 py-2 rounded-xl border border-[rgba(0,0,0,0.08)] text-sm focus:outline-none focus:border-[#051A24]" />
        </div>
        {data.fields.map((field, index) => (
          <div key={`${field.key}-${index}`} className="rounded-2xl border border-[rgba(0,0,0,0.08)] p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#273C46]/60 mb-1.5">字段键</label>
                <input type="text" value={field.key} onChange={e => updateField(index, { key: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[rgba(0,0,0,0.08)] text-sm focus:outline-none focus:border-[#051A24]" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#273C46]/60 mb-1.5">显示名称</label>
                <input type="text" value={field.label} onChange={e => updateField(index, { label: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[rgba(0,0,0,0.08)] text-sm focus:outline-none focus:border-[#051A24]" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-[#273C46]/60 mb-1.5">占位提示</label>
                <input type="text" value={field.placeholder} onChange={e => updateField(index, { placeholder: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-[rgba(0,0,0,0.08)] text-sm focus:outline-none focus:border-[#051A24]" />
              </div>
              <label className="flex items-center gap-2 text-sm text-[#273C46]">
                <input type="checkbox" checked={field.required} onChange={e => updateField(index, { required: e.target.checked })}
                  className="rounded border-[rgba(0,0,0,0.2)]" />
                必填
              </label>
              <div className="flex items-center gap-3">
                <label className="text-xs font-medium text-[#273C46]/60">行数</label>
                <input type="number" min={1} max={6} value={field.rows} onChange={e => updateField(index, { rows: Number(e.target.value) })}
                  className="w-20 px-3 py-2 rounded-xl border border-[rgba(0,0,0,0.08)] text-sm focus:outline-none focus:border-[#051A24]" />
                <button onClick={() => removeField(index)} disabled={data.fields.length <= 1}
                  className="ml-auto p-2 rounded-xl text-red-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-30 disabled:hover:bg-transparent">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
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
