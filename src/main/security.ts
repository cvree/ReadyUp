/** Content-Security-Policy for the packaged app. No remote origins of any kind. */
export const PROD_CSP = [
  "default-src 'none'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "worker-src 'self'",
  "connect-src 'self'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob: mediastream:",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
  "object-src 'none'"
].join('; ')

/** Development only (Vite dev server with hot reload on localhost). Never used in packaged builds. */
export const DEV_CSP = [
  "default-src 'none'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' http://localhost:*",
  "worker-src 'self' blob: http://localhost:*",
  "connect-src 'self' http://localhost:* ws://localhost:*",
  "img-src 'self' data: blob: http://localhost:*",
  "media-src 'self' blob: mediastream:",
  "style-src 'self' 'unsafe-inline' http://localhost:*",
  "font-src 'self' http://localhost:*",
  "object-src 'none'"
].join('; ')

export const APP_SCHEME = 'app'
export const APP_HOST = 'bundle'
export const APP_ORIGIN = `${APP_SCHEME}://${APP_HOST}`

/** Schemes the renderer may load without being counted as a network request. */
export function isLocalUrl(url: string, devServer: string | null): boolean {
  if (url.startsWith(`${APP_ORIGIN}/`) || url === APP_ORIGIN) return true
  if (/^(data|blob|devtools|chrome-extension|chrome):/i.test(url)) return true
  if (devServer) {
    const u = new URL(devServer)
    if (url.startsWith(`${u.protocol}//${u.host}`) || url.startsWith(`ws://${u.host}`)) return true
  }
  return false
}

export function isTrustedOrigin(url: string, devServer: string | null): boolean {
  if (url.startsWith(APP_ORIGIN)) return true
  return devServer !== null && url.startsWith(new URL(devServer).origin)
}
