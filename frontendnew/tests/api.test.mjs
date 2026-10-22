import test from 'node:test'
import assert from 'node:assert/strict'
import { ApiError, fetchProject, fetchProjects } from '../src/services/api.ts'

test('details preserve HTTP status so 404 and server failures have different UI states', async () => {
  const previousFetch = globalThis.fetch
  try {
    for (const status of [404, 500]) {
      globalThis.fetch = async () => new Response(JSON.stringify({ message: 'test failure' }), { status })
      await assert.rejects(fetchProject('missing'), error => error instanceof ApiError && error.status === status)
    }
    globalThis.fetch = async () => new Response('[]', { status: 200 })
    assert.deepEqual(await fetchProjects(), [])
  } finally { globalThis.fetch = previousFetch }
})

test('a stalled GET times out and can be retried', async context => {
  const previousFetch = globalThis.fetch
  context.mock.timers.enable({ apis: ['setTimeout'] })
  try {
    globalThis.fetch = async (_url, options) => new Promise((_, reject) => {
      options.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
    })
    const pending = fetchProjects()
    const assertion = assert.rejects(pending, /请求超时，请重试/)
    context.mock.timers.tick(15_000)
    await assertion
    globalThis.fetch = async () => new Response('[]', { status: 200 })
    assert.deepEqual(await fetchProjects(), [])
  } finally { globalThis.fetch = previousFetch; context.mock.timers.reset() }
})
