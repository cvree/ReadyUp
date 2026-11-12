import { expect, test, type Page } from '@playwright/test'
import { launch, toLobby } from './app'

type Hooks = { __readyup: { engine: { updateSim(p: object): void; setSource(s: string): Promise<void> } } }

/** Runs an accelerated focus block and answers the task, landing on camera setup for Move. */
async function toSetup(win: Page): Promise<void> {
  await toLobby(win)
  await win.keyboard.type('Read chapter 3')
  await win.keyboard.press('Enter')
  await expect(win.getByText('Did you finish')).toBeVisible({ timeout: 20_000 })
  await win.keyboard.press('1')
  await expect(win.getByText("Let's set up your camera")).toBeVisible()
}

const simulate = (win: Page): Promise<void> => win.evaluate(() => {
  const r = (window as unknown as Hooks).__readyup
  r.engine.updateSim({ presetId: 'full_normal' })
  void r.engine.setSource('sim')
})

test('camera view: status line, quick controls, on-picture count and fill-the-window mode', async () => {
  const { app, win } = await launch({ env: { READYUP_E2E_TIME_SCALE: '600' } })
  try {
    await toSetup(win)
    // Setup: the status line names the camera, and M mirrors without touching the mouse.
    await expect(win.getByTestId('cam-status')).toContainText('fake_device_0', { timeout: 20_000 })
    await expect(win.locator('.cam-frame')).toHaveAttribute('data-ok', 'false')
    const mirror = win.getByRole('button', { name: 'Mirror preview' })
    await expect(mirror).toHaveAttribute('aria-pressed', 'true')
    await win.keyboard.press('m')
    await expect(mirror).toHaveAttribute('aria-pressed', 'false')
    await expect(win.getByRole('checkbox', { name: 'Mirror preview' })).not.toBeChecked()
    await win.keyboard.press('Escape')

    // Move: the count on the picture follows the real count.
    await expect(win.getByTestId('move-total')).toBeVisible()
    await simulate(win)
    await expect(win.locator('.hud-n')).toHaveText('2', { timeout: 30_000 })
    await expect(win.getByTestId('move-total')).toHaveText('2')
    await expect(win.locator('.camview')).toHaveAttribute('data-flash', 'counted')

    // F fills the window and adds the coaching line; Esc goes back without leaving Move.
    await win.keyboard.press('f')
    await expect(win.locator('.camview')).toHaveAttribute('data-expanded', 'true')
    await expect(win.locator('.hud-hint')).toBeVisible()
    const box = await win.locator('.camview').boundingBox()
    const size = await win.evaluate(() => ({ w: window.innerWidth, h: window.innerHeight }))
    expect(box).toMatchObject({ x: 0, y: 0, width: size.w, height: size.h })
    await win.keyboard.press('Escape')
    await expect(win.locator('.camview')).toHaveAttribute('data-expanded', 'false')
    await expect(win.getByTestId('move-total')).toBeVisible()
  } finally {
    await app.close()
  }
})

test('hands-free setup: holding a good position starts the set without a keypress', async () => {
  const { app, win } = await launch({ env: { READYUP_E2E_TIME_SCALE: '600' } })
  try {
    await toSetup(win)
    await expect(win.getByTestId('hands-free')).toBeVisible()
    await simulate(win)
    await expect(win.locator('.cam-countdown')).toBeVisible({ timeout: 20_000 })
    await expect(win.getByTestId('move-total')).toBeVisible({ timeout: 20_000 })
  } finally {
    await app.close()
  }
})
