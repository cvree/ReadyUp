import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { launch } from './app'

// The whole ready check, keyboard only, with the focus timer accelerated 600× and simulated reps.
test('first run → focus → task → move → ready → launch → history, using only the keyboard', async () => {
  const { app, win, userData } = await launch({ env: { READYUP_E2E_TIME_SCALE: '600', READYUP_E2E_PICK: '/tmp/Overwatch 2.lnk' } })
  try {
    // Onboarding: Enter moves through every step; the game is added with its own buttons.
    await expect(win.getByRole('heading', { name: /Study, move,/ })).toBeVisible()
    await win.keyboard.press('Enter')
    await expect(win.getByText('This is a good place to start.')).toBeVisible()
    await win.keyboard.press('Enter')
    await win.getByRole('button', { name: 'Choose a shortcut…' }).focus()
    await win.keyboard.press('Enter')
    await win.getByRole('button', { name: 'Save game' }).focus()
    await win.keyboard.press('Enter')
    await expect(win.getByText('Added Overwatch 2.')).toBeVisible()
    await win.locator('body').click({ position: { x: 5, y: 300 } })
    await win.keyboard.press('Enter')
    await expect(win.getByText('Your webcam counts your reps.')).toBeVisible()
    await win.keyboard.press('Enter')

    // Lobby: the cursor waits in the task field; Enter starts focus.
    await expect(win.getByRole('heading', { name: 'Next up: focus.' })).toBeVisible()
    await expect(win.locator('#task')).toBeFocused()
    await win.keyboard.type('Chapter 4 problems')
    await win.keyboard.press('Enter')

    // Focus: Space pauses and resumes; the timer reaches the end (accelerated).
    await expect(win.locator('.timer')).toBeVisible()
    await win.keyboard.press('Space')
    await expect(win.getByRole('button', { name: /Resume/ })).toBeVisible()
    await win.keyboard.press('Space')
    await expect(win.getByText('Did you finish')).toBeVisible({ timeout: 20_000 })

    // Review: 1 = Yes. First Move goes through camera setup.
    await win.keyboard.press('1')
    await expect(win.getByText("Let's set up your camera")).toBeVisible()
    await win.keyboard.press('Escape')
    await expect(win.getByTestId('move-total')).toBeVisible()

    // Move: simulated push-ups drive the real counter until the target.
    await win.evaluate(() => {
      const r = (window as unknown as { __readyup: { engine: { updateSim(p: object): void; setSource(s: string): Promise<void> } } }).__readyup
      r.engine.updateSim({ presetId: 'full_normal' })
      void r.engine.setSource('sim')
    })
    await expect(win.locator('.readyword')).toBeVisible({ timeout: 40_000 })
    await expect(win.locator('.summary')).toContainText('you marked it done')
    await expect(win.locator('.summary')).toContainText('camera-counted')

    // Ready: Enter launches the chosen game (recorded, not opened, in tests).
    await win.keyboard.press('Enter')
    await expect(win.getByText('Opened Overwatch 2. Have a good session.')).toBeVisible()
    const launches = await app.evaluate(() => (globalThis as unknown as { __readyupTest: { launches(): Array<{ target: string }> } }).__readyupTest.launches())
    expect(launches.map((l) => l.target)).toEqual(['/tmp/Overwatch 2.lnk'])

    // The cursor is back in the task field (so typing works); reach History by keyboard.
    await win.getByRole('button', { name: 'History', exact: true }).focus()
    await win.keyboard.press('Enter')
    await expect(win.getByRole('heading', { name: '1 ready check this week' })).toBeVisible()
  } finally {
    await app.close()
  }
  const history = JSON.parse(readFileSync(join(userData, 'history.json'), 'utf8'))
  expect(history.sessions).toHaveLength(1)
  const s = history.sessions[0]
  expect(s.status).toBe('ready')
  expect(s.task).toBe('Chapter 4 problems')
  expect(s.focus.measuredMs).toBe(25 * 60_000)
  expect(s.focus.pauseCount).toBe(1)
  expect(s.taskResult).toBe('done')
  expect(s.move.cameraCounted).toBe(10)
  expect(s.move.corrections).toEqual([])
  expect(s.launches).toHaveLength(1)
})
