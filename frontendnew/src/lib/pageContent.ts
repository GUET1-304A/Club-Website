export const PAGE_SLUGS = ['about', 'research', 'cooperation', 'onboarding', 'recruitment'] as const
export type PageSlug = typeof PAGE_SLUGS[number]

type Schema = 'string' | readonly [Schema] | { [key: string]: Schema }
const schemas: Record<PageSlug, Record<string, Schema>> = {
  about: { images: ['string'], body: 'string' },
  research: { intro: 'string', directions: [{ name: 'string', tagline: 'string', content: 'string', techFields: ['string'], scenarios: ['string'] }] },
  cooperation: { intro: 'string', items: [{ type: 'string', title: 'string', description: 'string', details: ['string'] }] },
  onboarding: { steps: [{ title: 'string', content: 'string' }] },
  recruitment: { intro: 'string', requirements: ['string'], process: [{ step: 'string', description: 'string' }], faq: [{ question: 'string', answer: 'string' }], cta_title: 'string', cta_note: 'string', cta_button: 'string' },
}

function matches(value: unknown, schema: Schema, partial = false): boolean {
  if (schema === 'string') return typeof value === 'string'
  if (Array.isArray(schema)) return Array.isArray(value) && value.every(item => matches(item, schema[0]))
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  return Object.entries(schema).every(([key, child]) => (partial && !(key in record)) || matches(record[key], child))
}

export function validatePageContent(slug: PageSlug, content: unknown): Record<string, unknown> {
  if (!matches(content, schemas[slug], true)) throw new Error('页面内容格式不正确，请联系管理员或稍后重试')
  return content as Record<string, unknown>
}
