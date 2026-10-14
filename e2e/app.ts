import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export interface Launched {
  app: ElectronApplication
  win: Page
  userData: string
  exportDir: string
  netlog: string
  dir: string
}

export async function launch(opts: { userData?: string; env?: Record<string, string> } = {}): Promise<Launched> {
  const dir = mkdtempSync(join(tmpdir(), 'readyup-e2e-'))
  const userData = opts.userData ?? join(dir, 'userData')
  const exportDir = join(dir, 'exports')
  const netlog = join(dir, 'netlog.json')
  const app = await electron.launch({
    args: ['.'],
    cwd: process.cwd(),
    env: {
      ...process.env,
      READYUP_E2E: '1',
      READYUP_USER_DATA: userData,
      READYUP_E2E_EXPORT_DIR: exportDir,
      READYUP_NETLOG: netlog,
      ...opts.env
    } as Record<string, string>
  })
  const win = await app.firstWindow()
  await win.waitForLoadState('domcontentloaded')
  return { app, win, userData, exportDir, netlog, dir }
}

export async function mainEvents(app: ElectronApplication): Promise<Array<{ type: string; data: Record<string, unknown> }>> {
  return app.evaluate(() => (globalThis as unknown as { __readyupTest: { events: () => Array<{ type: string; data: Record<string, unknown> }> } }).__readyupTest.events())
}

export async function blockedRequests(app: ElectronApplication): Promise<Array<{ url: string }>> {
  return app.evaluate(() => (globalThis as unknown as { __readyupTest: { blockedRequests: () => Array<{ url: string }> } }).__readyupTest.blockedRequests())
}

/** Skips onboarding if shown, then opens Diagnostics (which turns the camera on). */
export async function openDiagnostics(win: Page): Promise<void> {
  const skip = win.getByRole('button', { name: 'Skip setup' })
  await win.locator('.onboarding, .lobby').first().waitFor()
  if (await skip.isVisible()) await skip.click()
  await win.locator('.lobby').waitFor()
  await win.keyboard.press('Control+Shift+D')
  await win.getByRole('heading', { name: 'Diagnostics' }).waitFor()
}

/** Skips onboarding if shown and waits for the Lobby. */
export async function toLobby(win: Page): Promise<void> {
  await win.locator('.onboarding, .lobby').first().waitFor()
  const skip = win.getByRole('button', { name: 'Skip setup' })
  if (await skip.isVisible()) await skip.click()
  await win.locator('.lobby').waitFor()
}

/** Waits until the pose model is ready and frames have been processed. */
export async function waitForTracking(win: Page): Promise<void> {
  await win.locator('[data-panel="model"] h2 em', { hasText: 'ready' }).waitFor({ timeout: 60_000 })
  await win.waitForFunction(() => {
    const panel = document.querySelector('[data-panel="model"]')?.textContent ?? ''
    return /Inference\s*\d/.test(panel)
  }, undefined, { timeout: 60_000 })
}
