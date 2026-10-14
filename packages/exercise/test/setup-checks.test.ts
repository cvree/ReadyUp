import { describe, expect, it } from 'vitest'
import { exerciseById, setupChecks, type SetupCheck } from '@readyup/exercise'
import { presetFrames } from '@readyup/sim'
import type { PoseFrame } from '@readyup/pose-types'

const byId = (c: SetupCheck[]): Record<string, SetupCheck> => Object.fromEntries(c.map((x) => [x.id, x]))
const pushUp = exerciseById('push_up')
const frame = presetFrames('full_normal')[5]!

describe('camera setup checks', () => {
  it('passes for a well-framed side-on push-up position in good light', () => {
    const c = byId(setupChecks({ frame, def: pushUp, luma: 120, minVisibility: 0.6 }))
    expect(Object.values(c).every((x) => x.pass)).toBe(true)
  })
  it('asks the person to step into view when nobody is detected', () => {
    const c = byId(setupChecks({ frame: { ...frame, landmarks: null }, def: pushUp, luma: 120, minVisibility: 0.6 }))
    expect(c.in_frame!.pass).toBe(false)
    expect(c.in_frame!.hint).toMatch(/Step into view/)
  })
  it('names missing body parts (feet out of frame)', () => {
    const lms = frame.landmarks!.map((l, i) => ([27, 28, 29, 30, 31, 32].includes(i) ? { ...l, y: 1.04 } : l))
    const c = byId(setupChecks({ frame: { ...frame, landmarks: lms }, def: pushUp, luma: 120, minVisibility: 0.6 }))
    expect(c.in_frame!.pass).toBe(false)
    expect(c.in_frame!.hint).toMatch(/I can't see your feet\. Move the camera back/)
  })
  it('flags darkness', () => {
    const c = byId(setupChecks({ frame, def: pushUp, luma: 20, minVisibility: 0.6 }))
    expect(c.lighting!.pass).toBe(false)
    expect(c.lighting!.hint).toMatch(/Turn on a light in front of you/)
  })
  it('flags a body that is too small (too far away) or too large (too close)', () => {
    const shrink = (k: number): PoseFrame => ({ ...frame, landmarks: frame.landmarks!.map((l) => ({ ...l, x: 0.5 + (l.x - 0.5) * k, y: 0.5 + (l.y - 0.5) * k })) })
    expect(byId(setupChecks({ frame: shrink(0.4), def: pushUp, luma: 120, minVisibility: 0.6 })).distance!.hint).toMatch(/Move a little closer/)
    expect(byId(setupChecks({ frame: shrink(2.6), def: pushUp, luma: 120, minVisibility: 0.6 })).distance!.pass).toBe(false)
  })
  it('asks for a side-on view when the shoulders are far apart (facing the camera)', () => {
    const lms = frame.landmarks!.map((l, i) => (i === 12 ? { ...l, x: l.x + 0.25 } : l))
    const c = byId(setupChecks({ frame: { ...frame, landmarks: lms }, def: pushUp, luma: 120, minVisibility: 0.6 }))
    expect(c.angle!.pass).toBe(false)
    expect(c.angle!.hint).toBe('Turn so your side faces the camera.')
  })
  it('asks for the head to be in view', () => {
    const lms = frame.landmarks!.map((l, i) => (i <= 10 ? { ...l, visibility: 0.1 } : l))
    expect(byId(setupChecks({ frame: { ...frame, landmarks: lms }, def: pushUp, luma: 120, minVisibility: 0.6 })).head!.pass).toBe(false)
  })
})
