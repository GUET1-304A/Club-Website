import assert from 'node:assert/strict'
import { createHmac, randomBytes, scryptSync } from 'node:crypto'
import { once } from 'node:events'
import { createServer, request } from 'node:http'
import test from 'node:test'
import { createAiriDemoGateway } from '../airi-demo-gateway.mjs'

const hostname = 'airi.304aistudio.cn'
const origin = `https://${hostname}`
const headers = { host: hostname, 'x-forwarded-proto': 'https' }

async function fixture(t, extra = {}) {
  const seen = []
  const sockets = new Set()
  const upstream = createServer((req, res) => {
    seen.push({ path: req.url, headers: req.headers })
    res.writeHead(200, { 'Content-Type': 'application/json' }).end('{"stage":"ready"}')
  })
  upstream.on('connection', socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)) })
  upstream.on('upgrade', (req, socket) => {
    seen.push({ path: req.url, headers: req.headers })
    socket.write('HTTP/1.1 101 Switching Protocols\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n')
    socket.on('data', data => socket.write(data))
  })
  upstream.listen(0, '127.0.0.1')
  await once(upstream, 'listening')
  const password = randomBytes(24).toString('base64url')
  const config = { hostname, upstreamPort: upstream.address().port, passwordSalt: 'test-only',
    passwordHash: scryptSync(password, 'test-only', 32).toString('hex'), sessionKey: randomBytes(32).toString('hex'), ...extra }
  const gateway = createAiriDemoGateway(config)
  gateway.listen(0, '127.0.0.1')
  await once(gateway, 'listening')
  t.after(() => { for (const socket of sockets) socket.destroy(); gateway.closeAllConnections(); gateway.close(); upstream.closeAllConnections(); upstream.close() })
  const call = (path, options = {}) => new Promise((resolve, reject) => {
    const req = request({ hostname: '127.0.0.1', port: gateway.address().port, path,
      method: options.method ?? 'GET', headers: { ...headers, ...options.headers } }, res => {
      const chunks = []
      res.on('data', chunk => chunks.push(chunk))
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString() }))
    })
    req.on('error', reject)
    req.end(options.body)
  })
  async function login() {
    const response = await call('/__demo/login', { method: 'POST', headers: { origin }, body: new URLSearchParams({ password }).toString() })
    assert.equal(response.status, 303)
    return response.headers['set-cookie'][0].split(';')[0]
  }
  return { call, login, password, config, seen, gateway }
}

test('anonymous visitors cannot read settings, assets, or pass into the upstream', async t => {
  const f = await fixture(t)
  const page = await f.call('/')
  assert.equal(page.status, 200)
  assert.equal(page.headers['referrer-policy'], 'same-origin')
  assert.match(page.body, /演示密码/)
  for (const path of ['/api/shared-settings', '/assets/stage.js', '/api/local-vision/persons'])
    assert.equal((await f.call(path)).status, 401)
  assert.equal(f.seen.length, 0)
})

test('host and HTTPS boundary reject forged origins before login', async t => {
  const f = await fixture(t)
  for (const invalid of [{ host: 'evil.example' }, { origin: 'https://evil.example' }, { 'x-forwarded-proto': 'http' }])
    assert.equal((await f.call('/', { headers: invalid })).status, 403)
  assert.equal((await f.call('/__demo/login', { method: 'POST', body: 'password=wrong' })).status, 403)
})

test('password grants a signed secure session and never forwards demo credentials', async t => {
  const f = await fixture(t)
  const response = await f.call('/__demo/login', { method: 'POST', headers: { origin }, body: new URLSearchParams({ password: f.password }).toString() })
  assert.equal(response.status, 303)
  const session = response.headers['set-cookie'][0]
  for (const attribute of ['HttpOnly', 'Secure', 'SameSite=Strict', 'Path=/']) assert.ok(session.includes(attribute))
  const cookie = session.split(';')[0]
  const proxied = await f.call('/api/shared-settings', { headers: { cookie: `${cookie}; airi_business=example`, origin, authorization: 'private-demo-header' } })
  assert.equal(proxied.status, 200)
  assert.equal(f.seen[0].headers.host, `127.0.0.1:${f.config.upstreamPort}`)
  assert.equal(f.seen[0].headers.origin, `http://127.0.0.1:${f.config.upstreamPort}`)
  assert.equal(f.seen[0].headers.cookie, ' airi_business=example'.trim())
  assert.equal(f.seen[0].headers.authorization, undefined)
  assert.equal(proxied.headers['cache-control'], 'no-store')
})

test('incorrect passwords are rate limited', async t => {
  const f = await fixture(t)
  for (let attempt = 0; attempt < 10; attempt++)
    assert.equal((await f.call('/__demo/login', { method: 'POST', headers: { origin }, body: 'password=wrong' })).status, 401)
  assert.equal((await f.call('/__demo/login', { method: 'POST', headers: { origin }, body: 'password=wrong' })).status, 429)
})

test('tampered and expired session cookies cannot reach settings', async t => {
  const f = await fixture(t)
  const cookie = await f.login()
  assert.equal((await f.call('/api/shared-settings', { headers: { cookie: `${cookie}tampered` } })).status, 401)
  const payload = `${Date.now() - 1000}.${randomBytes(18).toString('base64url')}`
  const signature = createHmac('sha256', Buffer.from(f.config.sessionKey, 'hex')).update(payload).digest('base64url')
  assert.equal((await f.call('/api/shared-settings', { headers: { cookie: `__Host-airi_demo=${payload}.${signature}` } })).status, 401)
})

test('authorized viewers still cannot load development tools or project manager APIs', async t => {
  const f = await fixture(t)
  const cookie = await f.login()
  for (const path of ['/@fs/F:/private.txt', '/@vite/client', '/.local/secret', '/src/main.ts', '/api/tasks'])
    assert.equal((await f.call(path, { headers: { cookie } })).status, 404)
  assert.equal(f.seen.length, 0)
})

test('voice WebSocket needs the demo session and preserves its local origin', async t => {
  const f = await fixture(t)
  const cookie = await f.login()
  const upgrade = (path, extra = {}) => new Promise((resolve, reject) => {
    const req = request({ hostname: '127.0.0.1', port: f.gateway.address().port, path,
      headers: { ...headers, origin, connection: 'Upgrade', upgrade: 'websocket', ...extra } })
    req.on('upgrade', (res, socket) => { socket.destroy(); resolve(res.statusCode) })
    req.on('response', res => { res.resume(); resolve(res.statusCode) })
    req.on('error', reject)
    req.end()
  })
  assert.equal(await upgrade('/api/realtime-voice'), 401)
  assert.equal(await upgrade('/api/realtime-voice', { cookie, origin: 'https://evil.example' }), 401)
  assert.equal(await upgrade('/anything', { cookie }), 404)
  assert.equal(await upgrade('/api/realtime-voice', { cookie }), 101)
  assert.equal(f.seen[0].headers.origin, `http://127.0.0.1:${f.config.upstreamPort}`)
  assert.equal(f.seen[0].headers.cookie, '')
})
