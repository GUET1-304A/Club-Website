import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createServer, request as proxyRequest } from 'node:http'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const cookieName = '__Host-airi_demo'
const loginPath = '/__demo/login'

function loginPage(error = '') {
  return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>数字生命 AIRI · 演示访问</title><style>body{margin:0;background:#f5f2ed;color:#273c46;font:16px/1.8 system-ui}main{max-width:420px;margin:14vh auto;padding:32px}small{letter-spacing:.18em;color:#57416e}h1{font-size:30px;color:#051a24}input,button{box-sizing:border-box;width:100%;padding:14px 16px;border-radius:12px;font:inherit}input{border:1px solid #ccc;background:#fff}button{margin-top:16px;background:#57416e;color:white;border:0;cursor:pointer}a{color:inherit}.error{color:#a12738}label{display:block;margin-bottom:8px}</style><main><small>304 AI STUDIO / AIRI</small><h1>数字生命 AIRI</h1><p>这是面向受邀访客的演示。请输入演示负责人提供的访问密码。</p><form method="post" action="${loginPath}"><label for="password">演示密码</label><input id="password" name="password" type="password" autocomplete="current-password" required maxlength="256"><button>进入演示</button></form><p class="error" role="alert">${error}</p><p><a href="https://304aistudio.cn/projects">返回作品画廊</a></p></main></html>`
}

export function createAiriDemoGateway(config) {
  const origin = `https://${config.hostname}`
  const localOrigin = `http://127.0.0.1:${config.upstreamPort}`
  const secret = Buffer.from(config.sessionKey, 'hex')
  const expectedHash = Buffer.from(config.passwordHash, 'hex')
  if (secret.length !== 32 || expectedHash.length !== 32 || !/^[a-z0-9.-]+$/.test(config.hostname)
    || !Number.isInteger(config.upstreamPort) || config.upstreamPort < 1 || config.upstreamPort > 65535)
    throw new Error('Invalid private gateway configuration')
  const attempts = new Map()
  const connections = new Set()
  const sessionSeconds = config.sessionSeconds ?? 28800
  const mac = value => createHmac('sha256', secret).update(value).digest('base64url')
  const equal = (a, b) => a.length === b.length && timingSafeEqual(a, b)

  function authorized(request) {
    const value = request.headers.cookie?.split(';').map(part => part.trim())
      .find(part => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1)
    if (!value || value.length > 180) return false
    const [expires, nonce, signature, extra] = value.split('.')
    return !extra && /^\d+$/.test(expires) && /^[A-Za-z0-9_-]{24}$/.test(nonce ?? '')
      && Number(expires) > Date.now() && Number(expires) <= Date.now() + sessionSeconds * 1000
      && equal(Buffer.from(signature ?? ''), Buffer.from(mac(`${expires}.${nonce}`)))
  }

  function boundary(request) {
    return request.headers.host === config.hostname
      && request.headers['x-forwarded-proto'] === 'https'
      && (!request.headers.origin || request.headers.origin === origin)
  }

  function upstreamHeaders(request) {
    const headers = { ...request.headers, host: `127.0.0.1:${config.upstreamPort}` }
    if (headers.origin) headers.origin = localOrigin
    if (headers.referer) headers.referer = `${localOrigin}/`
    for (const key of ['authorization', 'forwarded', 'x-forwarded-host', 'x-forwarded-for', 'x-forwarded-proto', 'x-real-ip']) delete headers[key]
    if (headers.cookie) headers.cookie = headers.cookie.split(';').filter(part => !part.trim().startsWith(`${cookieName}=`)).join(';')
    return headers
  }

  const server = createServer(async (request, response) => {
    response.setHeader('Cache-Control', 'no-store')
    response.setHeader('X-Robots-Tag', 'noindex, nofollow')
    response.setHeader('Referrer-Policy', 'no-referrer')
    response.setHeader('X-Content-Type-Options', 'nosniff')
    const send = (status, body, type = 'text/html; charset=utf-8') => {
      response.writeHead(status, { 'Content-Type': type }).end(body)
    }
    if (!boundary(request)) return send(403, '访问来源不被允许。')
    // Preserve raw paths for the fixed upstream, without interpreting a supplied URL as a target.
    if (!request.url?.startsWith('/') || request.url.startsWith('//')) return send(400, '无效路径。')
    const path = request.url.split('?')[0]
    if (path === loginPath && request.method === 'POST') {
      if (request.headers.origin !== origin) return send(403, '请从演示登录页提交。')
      const ip = request.headers['x-real-ip'] ?? request.socket.remoteAddress
      const now = Date.now()
      for (const [key, value] of attempts) if (value.until < now) attempts.delete(key)
      const record = attempts.get(ip) ?? { count: 0, until: now + 900000 }
      if (record.count >= 10 || attempts.size > 4000) {
        response.setHeader('Retry-After', '900')
        return send(429, loginPage('尝试次数过多，请稍后再试。'))
      }
      record.count++
      attempts.set(ip, record)
      const chunks = []
      let size = 0
      try {
        for await (const chunk of request) {
          size += chunk.length
          if (size > 2048) return send(413, '请求过大。')
          chunks.push(chunk)
        }
        const password = new URLSearchParams(Buffer.concat(chunks).toString('utf8')).get('password') ?? ''
        if (password.length > 256 || !equal(scryptSync(password, config.passwordSalt, 32), expectedHash))
          return send(401, loginPage('演示密码不正确。'))
        attempts.delete(ip)
        const payload = `${Date.now() + sessionSeconds * 1000}.${randomBytes(18).toString('base64url')}`
        response.setHeader('Set-Cookie', `${cookieName}=${payload}.${mac(payload)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${sessionSeconds}`)
        response.writeHead(303, { Location: '/' }).end()
      } catch { if (!response.headersSent) send(400, '无法读取请求。') }
      return
    }
    if (!authorized(request)) {
      if (request.method === 'GET' && (path === '/' || path === loginPath)) return send(200, loginPage())
      return send(401, '{"error":"demo-login-required"}', 'application/json; charset=utf-8')
    }
    if (path === '/__demo/logout' && request.method === 'POST') {
      if (request.headers.origin !== origin) return send(403, '访问来源不被允许。')
      response.setHeader('Set-Cookie', `${cookieName}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`)
      return response.writeHead(303, { Location: '/' }).end()
    }
    // The published client uses the production bundle. Development tools and workspace files never cross this edge.
    if (/^\/(?:@|__vite|__open-in-editor|node_modules|\.local|\.git|src\/|api\/(?:state|tasks|sync|wiki))(?:.*)/i.test(path))
      return send(404, '页面不存在。')
    const upstream = proxyRequest({ hostname: '127.0.0.1', port: config.upstreamPort, path: request.url,
      method: request.method, headers: upstreamHeaders(request) }, result => {
      const headers = { ...result.headers, 'cache-control': path.startsWith('/assets/')
        ? 'private, max-age=31536000, immutable' : 'no-store' }
      delete headers['access-control-allow-origin']
      response.writeHead(result.statusCode ?? 502, headers)
      result.pipe(response)
    })
    upstream.on('error', () => { if (!response.headersSent) send(503, 'AIRI 台式机服务暂时离线，请稍后重试。'); else response.destroy() })
    upstream.setTimeout(300000, () => upstream.destroy())
    request.on('aborted', () => upstream.destroy())
    response.on('close', () => upstream.destroy())
    request.pipe(upstream)
  })

  server.on('connection', socket => {
    connections.add(socket)
    socket.on('close', () => connections.delete(socket))
  })
  server.on('close', () => { for (const socket of connections) socket.destroy() })
  server.on('upgrade', (request, socket, head) => {
    if (!boundary(request) || request.headers.origin !== origin || !authorized(request))
      return socket.end('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n')
    if (!['/api/realtime-voice', '/api/local-vision/stream'].includes(request.url?.split('?')[0]))
      return socket.end('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n')
    const upstream = proxyRequest({ hostname: '127.0.0.1', port: config.upstreamPort, path: request.url, headers: upstreamHeaders(request) })
    upstream.on('upgrade', (result, stream, upstreamHead) => {
      socket.write(`HTTP/1.1 ${result.statusCode} ${result.statusMessage}\r\n`)
      for (let index = 0; index < result.rawHeaders.length; index += 2)
        socket.write(`${result.rawHeaders[index]}: ${result.rawHeaders[index + 1]}\r\n`)
      socket.write('\r\n')
      if (upstreamHead.length) socket.write(upstreamHead)
      if (head.length) stream.write(head)
      stream.on('error', () => socket.destroy())
      socket.on('error', () => stream.destroy())
      socket.on('close', () => stream.destroy())
      stream.on('close', () => socket.end())
      stream.pipe(socket).pipe(stream)
    })
    upstream.on('response', result => {
      socket.end(`HTTP/1.1 ${result.statusCode} Rejected\r\nConnection: close\r\n\r\n`)
      result.resume()
    })
    upstream.on('error', () => socket.destroy())
    socket.on('close', () => upstream.destroy())
    upstream.end()
  })
  return server
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const config = JSON.parse(readFileSync(process.argv[2], 'utf8'))
  const server = createAiriDemoGateway(config)
  server.listen(config.port, '127.0.0.1', () => console.log(`AIRI invited demo gateway listening on 127.0.0.1:${config.port}`))
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { server.close(); server.closeAllConnections() })
}
