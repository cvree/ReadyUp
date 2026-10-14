import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { launch, toLobby } from './app'

async function toMove(win: Page): Promise<void> {
  await toLobby(win)
  await win.keyboard.press('Enter')
  await expect(win.locator('.review .question')).toBeVisible({ timeout: 20_000 })
  await win.keyboard.press('2')
  await win.getByRole('button', { name: 'Continue anyway' }).click()
  await expect(win.getByTestId('move-total')).toBeVisible()
}

test('override unlocks Launch and is recorded honestly, never as camera-counted reps', async () => {
  const { app, win, userData } = await launch({ env: { READYUP_E2E_TIME_SCALE: '3000' } })
  try {
    await toMove(win)
    await win.getByRole('button', { name: /Correct the count: plus one/ }).click()
    await expect(win.getByTestId('move-breakdown')).toHaveText('0 camera-counted · +1 by hand')
    await win.keyboard.press('o')
    await expect(win.getByRole('heading', { name: 'Use an override' })).toBeVisible()
    await expect(win.getByRole('button', { name: 'Use override' })).toBeDisabled()
    await win.getByLabel('Injury').check()
    await win.getByRole('button', { name: 'Use override' }).click()
    await expect(win.locator('.readyword')).toBeVisible()
    await expect(win.locator('.ready')).toContainText('Override (injury), 10 push-ups self-reported')
  } finally {
    await app.close()
  }
  const s = JSON.parse(readFileSync(join(userData, 'history.json'), 'utf8')).sessions[0]
  expect(s.move.cameraCounted).toBe(0)
  expect(s.move.override).toMatchObject({ reason: 'injury', choice: 'self_report', selfReported: 10 })
  expect(s.move.corrections).toHaveLength(1)
})

test('system sleep pauses the focus timer and says so', async () => {
  const { app, win } = await launch()
  try {
    await toLobby(win)
    await win.keyboard.press('Enter')
    await expect(win.getByText('Focusing on')).toBeVisible()
    await sendPower(app, 'suspend')
    await expect(win.getByText('Paused while your PC was asleep. Resume when you\'re back.')).toBeVisible()
    await expect(win.getByRole('button', { name: /Resume/ })).toBeVisible()
  } finally {
    await app.close()
  }
})

async function sendPower(app: ElectronApplication, ev: 'suspend' | 'resume'): Promise<void> {
  await app.evaluate(({ BrowserWindow }, e) => BrowserWindow.getAllWindows()[0]!.webContents.send('platform:power', e), ev)
}

test('game links: web links are refused with a clear reason, launcher links are accepted', async () => {
  const { app, win } = await launch()
  try {
    await toLobby(win)
    await win.getByRole('button', { name: 'Settings', exact: true }).click()
    await win.getByRole('button', { name: 'Paste a launcher link' }).click()
    await win.getByLabel('Name').fill('Marvel Rivals')
    await win.getByLabel('Launcher link').fill('https://example.com/game')
    await win.getByRole('button', { name: 'Save game' }).click()
    await expect(win.getByRole('alert')).toContainText('Ready Up only opens links for known game launchers')
    await win.getByLabel('Launcher link').fill('steam://rungameid/2767030')
    await win.getByRole('button', { name: 'Save game' }).click()
    await expect(win.getByText('Added Marvel Rivals.')).toBeVisible()
    await win.getByRole('button', { name: 'Test launch' }).click()
    await expect(win.getByText(/Opened Marvel Rivals/)).toBeVisible()
  } finally {
    await app.close()
  }
})

test('Delete everything clears history and settings and returns to first-run setup', async () => {
  const { app, win, userData } = await launch()
  try {
    await toLobby(win)
    await win.getByRole('button', { name: 'Settings', exact: true }).click()
    await win.getByRole('button', { name: 'Delete everything…' }).click()
    await win.getByRole('dialog').getByRole('button', { name: 'Delete everything' }).click()
    await expect(win.getByRole('button', { name: 'Skip setup' })).toBeVisible()
  } finally {
    await app.close()
  }
  // Deleting removes the settings file; if it exists again it must be a fresh, un-onboarded one.
  const path = join(userData, 'settings.json')
  if (existsSync(path)) expect(JSON.parse(readFileSync(path, 'utf8')).onboarded).toBe(false)
  expect(existsSync(join(userData, 'history.json'))).toBe(false)
})

test('completion moment: full motion animates; reduced motion uses the calm version', async () => {
  for (const motion of ['full', 'reduced'] as const) {
    const { app, win } = await launch({ env: { READYUP_E2E_TIME_SCALE: '3000' } })
    try {
      await toLobby(win)
      await win.getByRole('button', { name: 'Settings', exact: true }).click()
      await win.getByLabel(motion === 'full' ? 'Full motion' : 'Reduce motion').check()
      await win.getByRole('button', { name: 'Home', exact: true }).click()
      await toMove(win)
      await win.keyboard.press('o')
      await win.getByLabel('Camera isn\'t working').check()
      await win.getByLabel('Skip moving today').check()
      await win.getByRole('button', { name: 'Use override' }).click()
      await expect(win.locator('.ready')).toHaveClass(motion === 'full' ? /animate/ : /calm/)
      // Enter works immediately, while the animation would still be running.
      await expect(win.getByRole('button', { name: /Add a game to launch/ })).toBeFocused()
    } finally {
      await app.close()
    }
  }
})
