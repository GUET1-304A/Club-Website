import test from 'node:test'
import assert from 'node:assert/strict'
import { PAGE_SLUGS, validatePageContent } from '../src/lib/pageContent.ts'

test('explicitly cleared arrays and strings are valid and stay empty', () => {
  const content = { intro: '', directions: [] }
  assert.equal(validatePageContent('research', content), content)
  assert.deepEqual(validatePageContent('about', { images: [] }).images, [])
  assert.deepEqual(validatePageContent('onboarding', { steps: [] }).steps, [])
  assert.deepEqual(validatePageContent('recruitment', { requirements: [], cta_note: '' }).requirements, [])
})

test('missing optional page fields allow defaults while valid nested content is retained', () => {
  for (const slug of PAGE_SLUGS) assert.deepEqual(validatePageContent(slug, {}), {})
  const page = { intro: '合作', items: [{ type: '交流', title: '共创', description: '', details: [] }] }
  assert.equal(validatePageContent('cooperation', page), page)
  assert.deepEqual(validatePageContent('onboarding', { steps: [{ title: '入门', content: '欢迎' }] }).steps[0].title, '入门')
})

test('invalid root or nested structures produce a retryable format error instead of a render crash', () => {
  for (const content of [null, [], 'text', { intro: 12 }, { directions: {} }, { directions: [null] },
    { directions: [{ name: 'AI', tagline: '', content: '', techFields: 12, scenarios: [] }] }]) {
    assert.throws(() => validatePageContent('research', content), /页面内容格式不正确/)
  }
  assert.throws(() => validatePageContent('about', { images: [123] }), /格式不正确/)
  assert.throws(() => validatePageContent('recruitment', { faq: [{ question: 'Q' }] }), /格式不正确/)
})
