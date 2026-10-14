import { describe, expect, it } from 'vitest'
import { RepCounter, RepTally, pushUp } from '@readyup/exercise'
import { presetFrames } from '@readyup/sim'
import { nonCounts, runPreset } from './helpers'

// Logic tests on synthetic movement. These show the state machine behaves as specified.
// They do NOT measure accuracy on real people; that needs real-camera testing.

describe('push-up counter: reps that should count', () => {
  it.each([
    ['full_normal', 10],
    ['full_slow', 10],
    ['full_fast', 10],
    ['pause_bottom', 5],
    ['pause_top', 5]
  ])('%s counts %i', (id, expected) => {
    const r = runPreset(id)
    expect(r.count).toBe(expected)
    expect(nonCounts(r)).toEqual([])
  })
})

describe('push-up counter: movements that must not count', () => {
  it('half reps: 0, each explained as not deep enough', () => {
    const r = runPreset('half_reps')
    expect(r.count).toBe(0)
    expect(r.byReason['rejected:not_deep_enough']).toBe(10)
    expect(r.events[0]?.message).toMatch(/Go a little lower\. Your elbows reached 1\d\d°; aim for 100° or less\./)
  })

  it('down and stay, then stand up: 0', () => {
    const r = runPreset('down_and_stay')
    expect(r.count).toBe(0)
    expect(nonCounts(r).length).toBeGreaterThanOrEqual(1)
  })

  it('no lockout at top (~135°): 0, explained as no lockout', () => {
    const r = runPreset('no_lockout')
    expect(r.count).toBe(0)
    expect(r.byReason['rejected:no_lockout']).toBeGreaterThanOrEqual(9)
    expect(Object.keys(r.byReason)).toEqual(['rejected:no_lockout'])
  })

  it('standing arm curls: 0, explained as not in push-up position', () => {
    const r = runPreset('arm_curls')
    expect(r.count).toBe(0)
    expect(r.events.length).toBeGreaterThanOrEqual(4)
    expect(new Set(r.events.map((e) => e.reason))).toEqual(new Set(['not_in_position']))
  })

  it('hips sagging through every rep: 0, explained as hips sagging', () => {
    const r = runPreset('hips_sagging')
    expect(r.count).toBe(0)
    expect(r.byReason['rejected:hips_sagging']).toBe(10)
  })

  it('knee push-ups: 0, with a message pointing to the Knee push-ups exercise', () => {
    const r = runPreset('knee_push_ups')
    expect(r.count).toBe(0)
    expect(r.byReason['rejected:other_exercise']).toBe(10)
    expect(r.events[0]?.message).toContain('Knee push-ups')
  })
})

describe('push-up counter: double counts and tracking', () => {
  it('±6° jitter held at both thresholds: exactly one count per rep', () => {
    expect(runPreset('threshold_jitter').count).toBe(10)
  })

  it('tracking lost for 500 ms mid-rep: that rep is voided, the rest count', () => {
    const r = runPreset('tracking_lost')
    expect(r.count).toBe(9)
    expect(r.byReason['voided:tracking_lost']).toBe(1)
    expect(r.events.find((e) => e.outcome === 'voided')?.message).toMatch(/lost sight of you/)
  })

  it('a dropout shorter than the tolerance is ignored', () => {
    const r = runPreset('full_normal', { dropouts: [{ startMs: 2100, durationMs: 200 }] })
    expect(r.count).toBe(10)
    expect(nonCounts(r)).toEqual([])
  })

  it('hidden far arm with guessed landmarks: uses the near side and counts correctly', () => {
    const r = runPreset('far_arm_garbage')
    expect(r.count).toBe(10)
    expect(r.events.every((e) => e.metrics.side === 'left')).toBe(true)
  })

  it('left/right flip mid-rep: no spurious count, only the interrupted rep is lost', () => {
    const r = runPreset('side_flip')
    expect(r.count).toBe(9)
    expect(r.byReason['voided:tracking_lost']).toBe(1)
    expect(r.events.at(-1)?.metrics.side).toBe('right')
  })

  it('a camera interruption mid-rep voids that rep; it cannot be completed across the gap', () => {
    const c = new RepCounter(pushUp)
    const frames = presetFrames('full_normal')
    // Feed until the bottom of rep 1 (lead-in 1000 ms + hold 300 + descend 700 ≈ frame 60).
    let i = 0
    for (; i < 62; i++) c.update(frames[i]!)
    const ev = c.interrupt(frames[i]!.t)
    expect(ev?.outcome).toBe('voided')
    expect(ev?.reason).toBe('camera_interrupted')
    // Resuming during the ascent of the same rep must not count it.
    let count = 0
    for (; i < 80; i++) count = c.update(frames[i]!).count
    expect(count).toBe(0)
    for (; i < frames.length; i++) count = c.update(frames[i]!).count
    expect(count).toBe(9)
  })

  it('walking out of frame between sets causes no surprise count', () => {
    const r = runPreset('walk_away')
    expect(r.count).toBe(6)
    expect(nonCounts(r)).toEqual([])
  })

  it('works when the right side faces the camera', () => {
    expect(runPreset('full_normal', { nearSide: 'right' }).count).toBe(10)
  })

  it.each([1, 2, 3, 4, 5, 6, 7, 8])('full reps with heavier landmark noise (seed %i): exactly 10', (seed) => {
    expect(runPreset('full_normal', { seed, noisePx: 3 }).count).toBe(10)
  })

  it.each([1, 2, 3])('half reps with heavier noise never count (seed %i)', (seed) => {
    expect(runPreset('half_reps', { seed, noisePx: 3 }).count).toBe(0)
  })
})

describe('push-up counter: thresholds, events and reset', () => {
  it('thresholds are live-adjustable: a stricter bottom rejects reps that reached only 95°', () => {
    const c = new RepCounter(pushUp)
    c.setThresholds({ bottom: 80 })
    let count = 0
    let rejected = 0
    for (const f of presetFrames('full_normal')) {
      const s = c.update(f)
      count = s.count
      rejected += s.events.filter((e) => e.reason === 'not_deep_enough').length
    }
    expect(count).toBe(0)
    expect(rejected).toBe(10)
    c.resetThresholds()
    expect(c.thresholds.bottom).toBe(100)
  })

  it('every counted rep carries metrics', () => {
    const r = runPreset('full_normal')
    for (const e of r.events) {
      expect(e.metrics.minAngle).toBeLessThanOrEqual(100)
      expect(e.metrics.maxAngle).toBeGreaterThanOrEqual(150)
      expect(e.metrics.durationMs).toBeGreaterThan(300)
      expect(e.metrics.meanVisibility).toBeGreaterThan(0.6)
    }
  })

  it('snapshots expose phase, side, signals and gates', () => {
    const c = new RepCounter(pushUp)
    const frames = presetFrames('full_normal')
    const phases = new Set<string>()
    for (const f of frames) phases.add(c.update(f).phase)
    expect(phases).toEqual(new Set(['top', 'descending', 'bottom', 'ascending']))
    const s = c.update(frames[40]!)
    expect(s.side).toBe('left')
    expect(s.signals.primary).not.toBeNull()
    expect(s.gates.map((g) => g.id)).toEqual(['body_horizontal', 'hands_below_shoulders', 'legs_straight', 'body_line'])
  })

  it('reset clears count and phase but keeps thresholds', () => {
    const c = new RepCounter(pushUp, { bottom: 95 })
    for (const f of presetFrames('full_normal')) c.update(f)
    c.reset()
    const s = c.update(presetFrames('full_normal')[0]!)
    expect(s.count).toBe(0)
    expect(c.thresholds.bottom).toBe(95)
  })
})

describe('manual corrections (D5)', () => {
  it('are recorded separately and never change the camera-counted total', () => {
    const tally = new RepTally()
    tally.setCameraCounted(4)
    expect(tally.correct(1, 1000)).toBe(true)
    expect(tally.correct(-1, 2000)).toBe(true)
    expect(tally.correct(1, 3000)).toBe(true)
    expect(tally.cameraCounted).toBe(4)
    expect(tally.netCorrection).toBe(1)
    expect(tally.total).toBe(5)
    expect(tally.corrections).toEqual([
      { t: 1000, delta: 1, cameraCountAtTime: 4 },
      { t: 2000, delta: -1, cameraCountAtTime: 4 },
      { t: 3000, delta: 1, cameraCountAtTime: 4 }
    ])
  })
  it('cannot take the total below zero', () => {
    const tally = new RepTally()
    expect(tally.correct(-1, 0)).toBe(false)
    expect(tally.corrections).toHaveLength(0)
  })
})
