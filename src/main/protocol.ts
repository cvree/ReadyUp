import { protocol } from 'electron'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize, sep } from 'node:path'
import { APP_HOST, APP_SCHEME, PROD_CSP } from './security'

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.task': 'application/octet-stream',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
}

/** Must run before app 'ready'. */
export function registerAppScheme(): void {
  protocol.registerSchemesAsPrivileged([
    { scheme: APP_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true, codeCache: true } }
  ])
}

/** Serves the bundled renderer from disk (inside the asar in packaged builds) with a strict CSP. */
export function handleAppProtocol(rootDir: string): void {
  const root = normalize(rootDir)
  protocol.handle(APP_SCHEME, async (request) => {
    const url = new URL(request.url)
    if (url.host !== APP_HOST) return new Response('Not found', { status: 404 })
    const rel = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)
    const file = normalize(join(root, rel))
    if (!file.startsWith(root + sep)) return new Response('Forbidden', { status: 403 })
    try {
      const body = await readFile(file)
      return new Response(body, {
        headers: {
          'content-type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream',
          'content-security-policy': PROD_CSP,
          'x-content-type-options': 'nosniff',
          'cache-control': 'no-cache'
        }
      })
    } catch {
      return new Response('Not found', { status: 404 })
    }
  })
}
