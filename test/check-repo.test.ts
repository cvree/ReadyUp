import { describe, expect, it } from 'vitest'
// @ts-expect-error plain ESM script without types
import { findViolations } from '../scripts/check-repo.mjs'

describe('repository media check', () => {
  it('rejects video, test images and pose data outside synthetic fixtures', () => {
    const v: string[] = findViolations([
      'e2e/clip.mp4',
      'footage-cache/a.webm',
      'test/frame.png',
      'recordings/me.pose.json',
      'packages/exercise/test/real.pose.jsonl'
    ])
    expect(v).toHaveLength(5)
  })
  it('allows source, docs and synthetic fixtures', () => {
    expect(findViolations([
      'src/main/index.ts',
      'docs/PLAN.md',
      'build/icon.png',
      'packages/sim/fixtures/half-reps.pose.json'
    ])).toEqual([])
  })
})
