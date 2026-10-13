import { expect, test } from '@playwright/test'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { launch } from './app'

// C1–C3 with Chromium's synthetic camera. Real hardware unplugging is in your test script.
test('lists cameras, remembers the choice across restarts', async () => {
  const first = await launch()
  let label: string | null
  try {
    await expect(first.win.locator('[data-panel="camera"] h2 em')).toHaveText('live')
    const select = first.win.locator('[data-panel="camera"] select')
    expect(await select.locator('option').count()).toBeGreaterThanOrEqual(1)
    label = await select.locator('option:checked').textContent()
    await select.selectOption({ index: 0 })
    await expect(first.win.locator('[data-panel="camera"] h2 em')).toHaveText('live')
  } finally {
    await first.app.close()
  }
  const settingsPath = join(first.userData, 'settings.json')
  expect(existsSync(settingsPath)).toBe(true)
  const saved = JSON.parse(readFileSync(settingsPath, 'utf8'))
  expect(saved.camera.label).toBe(label)

  const second = await launch({ userData: first.userData })
  try {
    await expect(second.win.locator('[data-panel="camera"] h2 em')).toHaveText('live')
    await expect(second.win.locator('[data-panel="camera"] select option:checked')).toHaveText(label ?? '')
  } finally {
    await second.app.close()
  }
})

test('unplugging shows "Camera disconnected" within 2 s, keeps the count, and reconnects', async () => {
  const { app, win } = await launch()
  try {
    await expect(win.locator('[data-panel="camera"] h2 em')).toHaveText('live')
    await win.getByRole('button', { name: 'Correct count: plus one' }).click()
    const t0 = Date.now()
    await win.getByRole('button', { name: 'Simulate unplug' }).click()
    await expect(win.locator('[data-state="disconnected"]')).toBeVisible({ timeout: 2000 })
    expect(Date.now() - t0).toBeLessThan(2000)
    await expect(win.locator('[data-state="disconnected"] h3')).toHaveText('Paused at 1')
    await expect(win.getByTestId('corrections')).toHaveText('+1 (1)')
    await win.getByRole('button', { name: 'Reconnect' }).click()
    await expect(win.locator('[data-panel="camera"] h2 em')).toHaveText('live')
    await expect(win.getByTestId('corrections')).toHaveText('+1 (1)')
  } finally {
    await app.close()
  }
})

test('camera permission denied explains the Windows setting and offers a button to open it', async () => {
  const { app, win } = await launch({ env: { READYUP_E2E_DENY_CAMERA: '1' } })
  try {
    const card = win.locator('[data-state="permission-denied"]')
    await expect(card).toBeVisible()
    await expect(card).toContainText('Privacy & security → Camera')
    await expect(card.getByRole('button', { name: 'Open camera settings' })).toBeVisible()
  } finally {
    await app.close()
  }
})
