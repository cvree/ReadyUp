import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { launch, toLobby } from './app'

const activeFile = (userData: string): { focus: { accumulatedMs: number; runningSince: number | null; pauses: Array<{ reason: string }> } } =>
  JSON.parse(readFileSync(join(userData, 'active-session.json'), 'utf8'))

test('a crash mid-focus resumes paused, counting only time up to the last save', async () => {
  const first = await launch()
  await toLobby(first.win)
  await first.win.locator('#task').fill('Essay outline')
  await first.win.keyboard.press('Enter')
  await expect(first.win.locator('.timer')).toBeVisible()
  await first.win.waitForTimeout(6500) // at least one periodic save
  const proc = first.app.process()
  const exited = new Promise((resolve) => proc.once('exit', resolve))
  proc.kill('SIGKILL')
  await exited

  // On Windows the killed app's helper processes take a moment to exit and release the profile;
  // until then a new instance yields to the single-instance lock. Retry briefly.
  let second: Awaited<ReturnType<typeof launch>> | null = null
  for (let attempt = 0; attempt < 5 && !second; attempt++) {
    await new Promise((r) => setTimeout(r, 1500))
    second = await launch({ userData: first.userData }).catch(() => null)
  }
  if (!second) throw new Error('Ready Up did not restart after the crash')
  try {
    await expect(second.win.getByRole('heading', { name: 'Pick up where you left off.' })).toBeVisible()
    await expect(second.win.getByText(/closed unexpectedly, so only time up to its last save was counted/)).toBeVisible()
    const a = activeFile(first.userData)
    expect(a.focus.runningSince).toBeNull()
    expect(a.focus.accumulatedMs).toBeGreaterThanOrEqual(4000)
    expect(a.focus.accumulatedMs).toBeLessThan(8000)
    await second.win.getByRole('button', { name: /Resume focus/ }).click()
    await expect(second.win.getByText('Paused')).toBeVisible()
    await second.win.keyboard.press('Space')
    await expect(second.win.getByText('Focusing on')).toBeVisible()
  } finally {
    await second.app.close()
  }
})

test('a clean quit pauses the timer; Discard records the session as ended early', async () => {
  const first = await launch()
  await toLobby(first.win)
  await first.win.keyboard.press('Enter')
  await expect(first.win.locator('.timer')).toBeVisible()
  await first.win.waitForTimeout(2000)
  await first.app.close()
  const a = activeFile(first.userData)
  expect(a.focus.runningSince).toBeNull()
  expect(a.focus.pauses.at(-1)?.reason).toBe('quit')
  expect(a.focus.accumulatedMs).toBeGreaterThanOrEqual(1500)

  const second = await launch({ userData: first.userData })
  try {
    await second.win.getByRole('button', { name: 'Discard' }).click()
    await expect(second.win.getByRole('heading', { name: 'Next up: focus.' })).toBeVisible()
  } finally {
    await second.app.close()
  }
  const h = JSON.parse(readFileSync(join(first.userData, 'history.json'), 'utf8'))
  expect(h.sessions.map((s: { status: string }) => s.status)).toEqual(['ended_early'])
})
