import test from 'node:test'
import assert from 'node:assert/strict'
import { affectedSiteResources, affectedPages, SITE_RESOURCES, notifySiteDataChange, subscribeSiteDataChanges } from '../src/lib/siteDataEvents.ts'

test('successful admin writes invalidate the matching public collections and statistics', () => {
  assert.deepEqual(affectedSiteResources('/admin/members/2', 'PUT'), ['members', 'config'])
  assert.deepEqual(affectedSiteResources('/admin/projects/2', 'DELETE'), ['projects', 'config'])
  assert.deepEqual(affectedSiteResources('/admin/awards', 'POST'), ['awards', 'config'])
  assert.deepEqual(affectedSiteResources('/admin/certificates/4/review', 'POST'), ['awards', 'config'])
  assert.deepEqual(affectedSiteResources('/admin/blogs/2', 'PATCH'), ['blogPosts'])
  assert.deepEqual(affectedSiteResources('/admin/config', 'PUT'), ['config'])
  assert.deepEqual(affectedSiteResources('/admin/import', 'POST'), [...SITE_RESOURCES])
  assert.deepEqual(affectedSiteResources('/admin/pages/home', 'PUT'), ['config'])
})

test('reads, uploads and authentication do not invalidate public data', () => {
  assert.deepEqual(affectedSiteResources('/admin/projects'), [])
  assert.deepEqual(affectedSiteResources('/admin/projects', 'HEAD'), [])
  assert.deepEqual(affectedSiteResources('/admin/login', 'POST'), [])
  assert.deepEqual(affectedSiteResources('/admin/upload', 'POST'), [])
})

test('page writes invalidate the specific slug, while create and import invalidate all pages', () => {
  assert.deepEqual(affectedPages('/admin/pages/research', 'PUT'), ['research'])
  assert.deepEqual(affectedPages('/admin/pages/about?revision=1', 'DELETE'), ['about'])
  assert.equal(affectedPages('/admin/pages', 'POST'), null)
  assert.equal(affectedPages('/admin/import?mode=merge', 'POST'), null)
  assert.deepEqual(affectedPages('/admin/pages/research'), [])
  assert.deepEqual(affectedPages('/admin/config', 'PUT'), [])
})

test('page notifications share same-tab and cross-tab invalidation and validate slugs', () => {
  const previousWindow = globalThis.window
  const target = new EventTarget()
  let stored
  target.localStorage = { setItem: (key, value) => { stored = { key, value } } }
  globalThis.window = target
  try {
    const updates = []
    const unsubscribe = subscribeSiteDataChanges(() => {}, pages => updates.push(pages))
    notifySiteDataChange('/admin/pages/research', 'PUT')
    assert.deepEqual(updates, [['research']])
    const event = new Event('storage')
    Object.assign(event, { key: stored.key, newValue: JSON.stringify({ resources: [], pages: ['about', '../private', 12] }) })
    target.dispatchEvent(event)
    assert.deepEqual(updates[1], ['about'])
    notifySiteDataChange('/admin/import', 'POST')
    assert.equal(updates[2], null)
    unsubscribe()
    notifySiteDataChange('/admin/pages/about', 'PUT')
    assert.equal(updates.length, 3)
  } finally { globalThis.window = previousWindow }
})

test('same-tab and cross-tab notifications validate resources and unsubscribe', () => {
  const previousWindow = globalThis.window
  const target = new EventTarget()
  let stored
  target.localStorage = { setItem: (key, value) => { stored = { key, value } } }
  globalThis.window = target
  try {
    const updates = []
    const unsubscribe = subscribeSiteDataChanges(resources => updates.push(resources))
    notifySiteDataChange('/admin/projects/2', 'PUT')
    assert.deepEqual(updates, [['config', 'projects']])
    assert.deepEqual(JSON.parse(stored.value).resources, ['projects', 'config'])
    const sendStorage = value => {
      const event = new Event('storage')
      Object.assign(event, { key: stored.key, newValue: value })
      target.dispatchEvent(event)
    }
    sendStorage(JSON.stringify({ resources: ['members', 'untrusted'] }))
    sendStorage('malformed')
    sendStorage('null')
    assert.deepEqual(updates[1], ['members'])
    assert.equal(updates.length, 2)
    target.localStorage.setItem = () => { throw new Error('storage blocked') }
    notifySiteDataChange('/admin/blogs/1', 'PUT')
    assert.deepEqual(updates[2], ['blogPosts'])
    unsubscribe()
    notifySiteDataChange('/admin/blogs/1', 'PUT')
    assert.equal(updates.length, 3)
  } finally { globalThis.window = previousWindow }
})
