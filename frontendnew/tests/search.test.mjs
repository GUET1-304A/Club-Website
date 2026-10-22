import test from 'node:test'
import assert from 'node:assert/strict'
import { searchItems } from '../src/lib/search.ts'

test('exact and prefix titles rank ahead of title substrings and descriptions', () => {
  const items = [
    { id: 'desc', title: '开发指南', description: 'AI 上手指南' },
    { id: 'contains', title: '校园 AI 工具' },
    { id: 'prefix', title: 'AI 助手' },
    { id: 'exact', title: 'AI' },
  ]
  assert.deepEqual(searchItems(items, ' ai ').map(x => x.id), ['exact', 'prefix', 'contains', 'desc'])
})

test('full-width input, mixed case, categories and multiple tokens work together', () => {
  const items = [
    { id: '1', title: 'AI 办公助手', category: 'AI/算法', keywords: ['Python', 'Agent'] },
    { id: '2', title: '校园工具', category: 'Web 应用', description: 'Python' },
  ]
  assert.deepEqual(searchItems(items, 'ＡＩ   python').map(x => x.id), ['1'])
  assert.deepEqual(searchItems(items, 'web').map(x => x.id), ['2'])
  assert.deepEqual(searchItems(items, '不存在'), [])
})

test('blank queries show six suggestions and equal ranks preserve input order without mutation', () => {
  const items = Array.from({ length: 9 }, (_, i) => ({ id: String(i), title: `项目 ${i}`, description: 'demo' }))
  assert.equal(searchItems(items, '  ').length, 6)
  assert.deepEqual(searchItems(items, 'demo').map(x => x.id), items.map(x => x.id))
  assert.equal(items.length, 9)
})
