import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { blockedRequests, launch, mainEvents, openDiagnostics, waitForTracking } from './app'

// B2, B3, B4, B5: the pose model loads from the bundle, runs in a worker, processes camera frames,
// and nothing is requested from the network. Detection quality on real people is NOT tested here.
test('model loads offline and processes frames from a (fake) camera with zero network requests', async () => {
  const { app, win, netlog } = await launch()
  try {
    await openDiagnostics(win)
    await waitForTracking(win)
    // The synthetic camera shows no person, so the counter must report that honestly.
    await expect(win.getByTestId('hint')).toContainText('Step into view', { timeout: 30_000 })

    const workers = win.workers().map((w) => w.url())
    expect(workers.some((u) => /pose\.worker/.test(u))).toBe(true)

    const model = await win.locator('[data-panel="model"]').textContent()
    expect(model).toMatch(/Load time\s*\d+ ms/)
    expect(model).toMatch(/Inference\s*[\d.]+ ms/)
    // Delegate is recorded; if the GPU path was not used, the reason is shown.
    expect(model).toMatch(/Runs on(Graphics card \(GPU\)|Processor \(CPU\))/)
    if (/Processor \(CPU\)/.test(model ?? '')) expect(model).toContain('Fell back to CPU')

    await win.waitForTimeout(3000)
    const events = await mainEvents(app)
    expect(events.filter((e) => e.type === 'csp.violation')).toEqual([])
    expect(await blockedRequests(app)).toEqual([])
  } finally {
    await app.close()
  }
  // Chromium's network log covers every process. It must contain no remote URLs at all.
  const log = readFileSync(netlog, 'utf8')
  const remote = [...log.matchAll(/"url":"((?:https?|wss?|ftp):[^"]+)"/g)].map((m) => m[1])
  expect(remote).toEqual([])
})
