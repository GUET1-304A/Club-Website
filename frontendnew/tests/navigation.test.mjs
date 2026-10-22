import test from 'node:test'
import assert from 'node:assert/strict'
import { clientLinkUrl } from '../src/lib/navigation.ts'

const event = { defaultPrevented: false, button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false }
const anchor = { href: '/projects?category=ai#featured', target: '', download: false }
const current = 'http://localhost:3000/blog'

test('ordinary same-origin navigation preserves query and fragment', () => {
  const url = clientLinkUrl(event, anchor, current)
  assert.equal(url.pathname + url.search + url.hash, '/projects?category=ai#featured')
  assert.equal(clientLinkUrl(event, { ...anchor, href: '#目录' }, current).hash, '#%E7%9B%AE%E5%BD%95')
})

test('modifier, middle and already handled clicks retain native browser behavior', () => {
  for (const modifier of ['metaKey', 'ctrlKey', 'shiftKey', 'altKey', 'defaultPrevented']) {
    assert.equal(clientLinkUrl({ ...event, [modifier]: true }, anchor, current), null, modifier)
  }
  assert.equal(clientLinkUrl({ ...event, button: 1 }, anchor, current), null)
})

test('downloads, targets, external URLs and server endpoints are not SPA routes', () => {
  for (const changed of [
    { download: true }, { target: '_blank' }, { target: 'preview' },
    { href: 'https://github.com/example' }, { href: 'mailto:hello@example.com' },
    { href: 'javascript:void(0)' }, { href: '/api/export' }, { href: '/uploads/certificate.pdf' },
    { href: 'http://localhost:5000/projects' },
  ]) assert.equal(clientLinkUrl(event, { ...anchor, ...changed }, current), null, JSON.stringify(changed))
  assert.ok(clientLinkUrl(event, { ...anchor, target: '_self' }, current))
})
