import test from 'node:test'
import assert from 'node:assert/strict'
import { createResourceCache } from '../src/store/resourceCache.ts'

const deferred = () => {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

test('concurrent consumers share one request, including forced retries', async () => {
  const request = deferred()
  let calls = 0
  const cache = createResourceCache({ members: [] }, { members: () => { calls++; return request.promise } })
  const first = cache.load(['members', 'members'])
  const second = cache.load(['members'], true)
  await Promise.resolve()
  assert.equal(calls, 1)
  assert.equal(cache.getSnapshot().status.members, 'loading')
  request.resolve([{ id: 1 }])
  await Promise.all([first, second])
  assert.deepEqual(cache.getSnapshot().data.members, [{ id: 1 }])
})

test('successful empty collections replace old content without demo fallbacks', async () => {
  const cache = createResourceCache({ members: [{ id: 'old' }] }, { members: async () => [] })
  await cache.load()
  assert.deepEqual(cache.getSnapshot().data.members, [])
  assert.equal(cache.getSnapshot().loaded.members, true)
  assert.equal(cache.getSnapshot().status.members, 'success')
})

test('one failing collection does not erase successful resources and can retry immediately', async () => {
  let failing = true
  const cache = createResourceCache({ members: [], projects: [] }, {
    members: async () => { if (failing) throw new Error('offline'); return [{ id: 2 }] },
    projects: async () => [{ id: 1 }],
  })
  await cache.load()
  assert.equal(cache.getSnapshot().status.members, 'error')
  assert.equal(cache.getSnapshot().loaded.members, false)
  assert.equal(cache.getSnapshot().errors.members, 'offline')
  assert.deepEqual(cache.getSnapshot().data.projects, [{ id: 1 }])
  failing = false
  await cache.load(['members'], true)
  assert.equal(cache.getSnapshot().status.members, 'success')
  assert.equal(cache.getSnapshot().errors.members, undefined)
  assert.deepEqual(cache.getSnapshot().data.members, [{ id: 2 }])
})

test('failed background refresh keeps last successful content and marks it stale', async () => {
  let fail = false
  const cache = createResourceCache({ members: [] }, { members: async () => {
    if (fail) throw new Error('refresh failed')
    return [{ id: 1 }]
  } })
  await cache.load()
  fail = true
  await cache.load(['members'], true)
  assert.deepEqual(cache.getSnapshot().data.members, [{ id: 1 }])
  assert.equal(cache.getSnapshot().loaded.members, true)
  assert.equal(cache.getSnapshot().status.members, 'error')
})

test('TTL skips repeated requests and invalidation refreshes only affected resources', async () => {
  let now = 0
  const calls = { members: 0, projects: 0 }
  const cache = createResourceCache({ members: [], projects: [] }, {
    members: async () => { calls.members++; return [] },
    projects: async () => { calls.projects++; return [] },
  }, { ttl: 60_000, now: () => now })
  await cache.load()
  await cache.load()
  assert.deepEqual(calls, { members: 1, projects: 1 })
  now = 60_001
  await cache.load()
  assert.deepEqual(calls, { members: 2, projects: 2 })
  cache.invalidate(['members'])
  await cache.load()
  assert.deepEqual(calls, { members: 3, projects: 2 })
})

test('a slow invalidated response cannot overwrite fresher data or clear its pending request', async () => {
  const old = deferred(), fresh = deferred()
  let calls = 0
  const cache = createResourceCache({ members: [] }, { members: () => (++calls === 1 ? old : fresh).promise })
  const first = cache.load()
  await Promise.resolve()
  cache.invalidate()
  const second = cache.load()
  await Promise.resolve()
  old.resolve([{ id: 'outdated' }])
  await first
  const third = cache.load()
  assert.equal(cache.getSnapshot().status.members, 'loading')
  assert.equal(calls, 2)
  fresh.resolve([{ id: 'current' }])
  await Promise.all([second, third])
  assert.deepEqual(cache.getSnapshot().data.members, [{ id: 'current' }])
})

test('subscriptions publish immutable snapshots and clean up', async () => {
  const cache = createResourceCache({ members: [] }, { members: async () => [] })
  const snapshots = []
  const unsubscribe = cache.subscribe(() => snapshots.push(cache.getSnapshot()))
  await cache.load()
  assert.equal(snapshots.length, 2)
  assert.equal(snapshots[0].status.members, 'loading')
  assert.equal(snapshots[1].status.members, 'success')
  unsubscribe()
  cache.invalidate()
  assert.equal(snapshots.length, 2)
})
