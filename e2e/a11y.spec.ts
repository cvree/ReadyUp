import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { launch } from './app'

const AXE = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8')

/** Runs axe-core (WCAG 2.1 A/AA rules) on the current screen. Returns serious and critical issues. */
async function audit(win: Page, name: string): Promise<string[]> {
  await win.evaluate(AXE)
  const res = await win.evaluate(async () => {
    const axe = (window as unknown as { axe: { run(ctx: Document, o: object): Promise<{ violations: Array<{ id: string; impact: string; nodes: Array<{ target: string[] }> }> }> } }).axe
    const r = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } })
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.slice(0, 3).map((n) => n.target.join(' ')) }))
  })
  return res.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${name}: ${v.id} (${v.impact}) at ${v.nodes.join(', ')}`)
}

test('every screen passes automated WCAG 2.1 AA checks (serious and critical)', async () => {
  const { app, win } = await launch({ env: { READYUP_E2E_TIME_SCALE: '3000' } })
  const issues: string[] = []
  try {
    await win.getByRole('button', { name: /Get started/ }).waitFor()
    issues.push(...(await audit(win, 'onboarding')))
    await win.getByRole('button', { name: 'Skip setup' }).click()
    await win.locator('.lobby').waitFor()
    issues.push(...(await audit(win, 'lobby')))
    await win.keyboard.press('Enter')
    await win.locator('.timer').waitFor()
    issues.push(...(await audit(win, 'focus')))
    await win.locator('.review .question').waitFor({ timeout: 20_000 })
    issues.push(...(await audit(win, 'review')))
    await win.keyboard.press('1')
    await win.getByText("Let's set up your camera").waitFor()
    issues.push(...(await audit(win, 'camera setup')))
    await win.getByRole('button', { name: 'Continue anyway' }).click()
    await win.getByTestId('move-total').waitFor()
    issues.push(...(await audit(win, 'move')))
    await win.keyboard.press('o')
    await win.getByRole('heading', { name: 'Use an override' }).waitFor()
    issues.push(...(await audit(win, 'override dialog')))
    await win.getByLabel('Accessibility needs').check()
    await win.getByRole('button', { name: 'Use override' }).click()
    await win.locator('.readyword').waitFor()
    await win.waitForTimeout(1500) // let the lock-in finish so contrast is measured at rest
    issues.push(...(await audit(win, 'ready')))
    await win.getByRole('button', { name: 'History', exact: true }).click()
    await win.locator('.history').waitFor()
    issues.push(...(await audit(win, 'history')))
    await win.getByRole('button', { name: 'Settings', exact: true }).click()
    await win.locator('.settings').waitFor()
    issues.push(...(await audit(win, 'settings')))
    await win.keyboard.press('Control+Shift+D')
    await win.getByRole('heading', { name: 'Diagnostics' }).waitFor()
    issues.push(...(await audit(win, 'diagnostics')))
  } finally {
    await app.close()
  }
  expect(issues).toEqual([])
})
