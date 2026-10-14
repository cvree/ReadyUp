import { expect, test } from '@playwright/test'
import { launch, mainEvents } from './app'

// A4: Electron hardening and content security policy, checked on the running app.
test('renderer is sandboxed, isolated and has no Node access', async () => {
  const { app, win } = await launch()
  try {
    const prefs = await app.evaluate(({ BrowserWindow }) => {
      // getLastWebPreferences exists at runtime but is missing from Electron's type definitions.
      const wc = BrowserWindow.getAllWindows()[0]!.webContents as unknown as { getLastWebPreferences(): Record<string, unknown> }
      const p = wc.getLastWebPreferences()
      return { contextIsolation: p.contextIsolation, sandbox: p.sandbox, nodeIntegration: p.nodeIntegration, webSecurity: p.webSecurity }
    })
    expect(prefs).toEqual({ contextIsolation: true, sandbox: true, nodeIntegration: false, webSecurity: true })
    const globals = await win.evaluate(() => ({
      require: typeof (window as unknown as { require?: unknown }).require,
      process: typeof (window as unknown as { process?: unknown }).process,
      api: Object.keys(window.readyup).sort()
    }))
    expect(globals.require).toBe('undefined')
    expect(globals.process).toBe('undefined')
    expect(globals.api).toEqual([
      'addMatch', 'clearActiveSession', 'deleteAllData', 'exportHistory', 'exportLog', 'getRuntimeConfig', 'getSettings', 'getStartupMetrics',
      'getSystemInfo', 'launchGame', 'listHistory', 'loadActiveSession', 'log', 'notify', 'onPower', 'openCameraSettings', 'pickShortcut',
      'saveActiveSession', 'saveRecord', 'updateSettings', 'validateGame'
    ])
  } finally {
    await app.close()
  }
})

test('the app is served with a strict CSP that names no remote origins', async () => {
  const { app, win } = await launch()
  try {
    const csp = await win.evaluate(async () => (await fetch('app://bundle/index.html')).headers.get('content-security-policy'))
    expect(csp).toContain("default-src 'none'")
    expect(csp).not.toMatch(/https?:|wss?:|\*/)
    const remoteFetch = await win.evaluate(async () => {
      try {
        await fetch('https://example.com/')
        return 'loaded'
      } catch {
        return 'blocked'
      }
    })
    expect(remoteFetch).toBe('blocked')
  } finally {
    await app.close()
  }
})

test('navigation away from the app and new windows are blocked', async () => {
  const { app, win } = await launch()
  try {
    await win.evaluate(() => {
      window.location.href = 'https://example.com/'
    })
    await win.waitForTimeout(800)
    expect(win.url()).toMatch(/^app:\/\/bundle\//)
    const opened = await win.evaluate(() => window.open('https://example.com/') === null)
    expect(opened).toBe(true)
    expect(app.windows()).toHaveLength(1)
    const events = await mainEvents(app)
    expect(events.some((e) => e.type === 'navigation.blocked')).toBe(true)
  } finally {
    await app.close()
  }
})
