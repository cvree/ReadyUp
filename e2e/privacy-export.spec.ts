import { expect, test } from '@playwright/test'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { launch, waitForTracking } from './app'

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })
}

const MEDIA_EXT = /\.(png|jpe?g|gif|bmp|webp|mp4|webm|mkv|avi|mov|y4m|mjpe?g)$/i
function looksLikeMedia(file: string): boolean {
  const head = readFileSync(file).subarray(0, 12)
  return (
    (head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47) || // PNG
    (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) || // JPEG
    (head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3) || // WebM/MKV
    head.subarray(4, 8).toString('latin1') === 'ftyp' // MP4/MOV
  )
}

// C4 + E3: no camera frames on disk; exports contain no images and, by default, no landmarks.
test('a live session writes no image or video files to app data', async () => {
  const { app, win, userData } = await launch()
  try {
    await waitForTracking(win)
    await win.waitForTimeout(4000)
  } finally {
    await app.close()
  }
  const files = walk(userData)
  const offenders = files.filter((f) => MEDIA_EXT.test(f) || looksLikeMedia(f))
  expect(offenders).toEqual([])
})

test('exported log has no image data and excludes landmarks unless asked', async () => {
  const { app, win, exportDir } = await launch()
  try {
    await waitForTracking(win)
    await win.getByRole('button', { name: 'Export log…' }).click()
    await expect(win.getByText(/Saved to /)).toBeVisible()
    await win.getByLabel(/Include the last 30 s of pose landmarks/).check()
    await win.getByRole('button', { name: 'Export log…' }).click()
    await win.waitForTimeout(500)
  } finally {
    await app.close()
  }
  const exports = readdirSync(exportDir).sort().map((f) => readFileSync(join(exportDir, f), 'utf8'))
  expect(exports).toHaveLength(2)
  for (const text of exports) {
    expect(text).not.toMatch(/data:(image|video)|base64,/i)
    const doc = JSON.parse(text)
    expect(doc.format).toBe('ready-up-diagnostics')
    expect(doc.system.appArch).toBeTruthy()
    expect(doc.thresholds.bottom).toBe(100)
  }
  const [first, second] = exports.map((t) => JSON.parse(t))
  expect(first.pose).toBeUndefined()
  expect(Array.isArray(second.pose)).toBe(true)
  for (const row of second.pose) {
    if (row.landmarks) expect(row.landmarks.flat().every((n: unknown) => typeof n === 'number')).toBe(true)
  }
})
