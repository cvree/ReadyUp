import { describe, expect, it } from 'vitest'
import { PRESETS, generate, presetFrames } from '@readyup/sim'

describe('synthetic pose generator', () => {
  it('is deterministic for a seed', () => {
    expect(presetFrames('full_normal', 3)).toEqual(presetFrames('full_normal', 3))
  })
  it('produces 33 landmarks inside the frame at 30 fps for every preset', () => {
    for (const p of PRESETS) {
      const frames = generate(p.segments, p.options)
      expect(frames.length).toBeGreaterThan(30)
      let min = Infinity
      let max = -Infinity
      for (const f of frames) {
        if (!f.landmarks) continue
        expect(f.landmarks.length).toBe(33)
        for (const l of f.landmarks) {
          min = Math.min(min, l.x, l.y)
          max = Math.max(max, l.x, l.y)
        }
      }
      expect(min, p.id).toBeGreaterThan(-0.05)
      expect(max, p.id).toBeLessThan(1.05)
      const dts = frames.slice(1).map((f, i) => f.t - frames[i]!.t)
      expect(Math.max(...dts)).toBeLessThan(34)
    }
  })
})
