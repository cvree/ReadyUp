import { expect, test } from '@playwright/test'
import { launch } from './app'

// E2, E4, D5 in the running app: the simulated skeleton drives the same counter as the camera.
test('simulated full reps count, half reps do not, corrections stay separate, reset clears', async () => {
  const { app, win } = await launch()
  try {
    await win.getByRole('radio', { name: 'Simulated' }).click()
    await expect(win.getByTestId('camera-count')).toHaveText('3', { timeout: 20_000 })

    await win.getByRole('button', { name: 'Correct count: plus one' }).click()
    const camera = Number(await win.getByTestId('camera-count').textContent())
    await expect(win.getByTestId('corrections')).toHaveText('+1 (1)')
    expect(camera).toBeGreaterThanOrEqual(3)

    await win.getByRole('button', { name: 'Reset session' }).click()
    await expect(win.getByTestId('camera-count')).toHaveText('0')
    await expect(win.getByTestId('corrections')).toHaveText('none')

    await win.locator('[data-panel="input"] select').selectOption('half_reps')
    await expect(win.locator('[data-panel="replog"] .replog li').first()).toContainText('Go a little lower', { timeout: 15_000 })
    await expect(win.getByTestId('camera-count')).toHaveText('0')

    await win.locator('[data-panel="input"] select').selectOption('arm_curls')
    await expect(win.locator('[data-panel="replog"] .replog li').first()).toContainText('push-up position', { timeout: 15_000 })
    await expect(win.getByTestId('camera-count')).toHaveText('0')
    await win.screenshot({ path: 'test-results/diagnostics-simulated.png' })
  } finally {
    await app.close()
  }
})
