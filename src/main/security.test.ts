import { describe, expect, it } from 'vitest'
import { PROD_CSP, isLocalUrl, isTrustedOrigin } from './security'

describe('security policy', () => {
  it('production CSP names no remote origins and no eval', () => {
    expect(PROD_CSP).not.toMatch(/https?:|wss?:|\*/)
    expect(PROD_CSP).not.toContain("'unsafe-eval'")
    expect(PROD_CSP).toContain("default-src 'none'")
    expect(PROD_CSP).toContain("connect-src 'self'")
  })
  it('treats only app, data and blob URLs as local in production', () => {
    expect(isLocalUrl('app://bundle/index.html', null)).toBe(true)
    expect(isLocalUrl('blob:app://bundle/123', null)).toBe(true)
    expect(isLocalUrl('https://storage.googleapis.com/x', null)).toBe(false)
    expect(isLocalUrl('http://localhost:5173/', null)).toBe(false)
    expect(isLocalUrl('file:///etc/passwd', null)).toBe(false)
    expect(isLocalUrl('app://evil/index.html', null)).toBe(false)
  })
  it('allows the dev server only when one is configured', () => {
    expect(isLocalUrl('http://localhost:5173/src/main.tsx', 'http://localhost:5173')).toBe(true)
    expect(isTrustedOrigin('http://localhost:5173/', null)).toBe(false)
    expect(isTrustedOrigin('app://bundle/index.html', null)).toBe(true)
  })
})
