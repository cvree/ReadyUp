import { describe, expect, it } from 'vitest'
import { EXERCISE_LIST, RepCounter, exerciseById, type ExerciseDefinition, type RepEvent } from '@readyup/exercise'
import { generate, presetById } from '@readyup/sim'

// Synthetic logic tests for every exercise. They do NOT measure accuracy on real people.

function run(def: ExerciseDefinition, presetId: string, seed = 7, noisePx = 1): { count: number; events: RepEvent[] } {
  const p = presetById(presetId)!
  const c = new RepCounter(def)
  const events: RepEvent[] = []
  let count = 0
  for (const f of generate(p.segments, { ...p.options, seed, noisePx })) {
    const s = c.update(f)
    count = s.count
    events.push(...s.events)
  }
  return { count, events }
}
const reasons = (e: RepEvent[]): Set<string> => new Set(e.filter((x) => x.outcome !== 'counted').map((x) => x.reason))

describe('registry', () => {
  it('lists four exercises with copy, and marks only sit-ups as beta', () => {
    expect(EXERCISE_LIST.map((e) => e.id)).toEqual(['push_up', 'knee_push_up', 'squat', 'sit_up'])
    expect(EXERCISE_LIST.filter((e) => e.beta).map((e) => e.id)).toEqual(['sit_up'])
    for (const e of EXERCISE_LIST) {
      expect(e.copy.unit.length).toBeGreaterThan(0)
      expect(Object.keys(e.copy.phase).sort()).toEqual(['ascending', 'bottom', 'descending', 'top', 'waiting'])
    }
  })
  it('falls back to push-ups for unknown ids', () => {
    expect(exerciseById('nope').id).toBe('push_up')
  })
})

describe('knee push-ups', () => {
  const def = exerciseById('knee_push_up')
  it('counts 10 knee push-ups', () => expect(run(def, 'knee_push_ups').count).toBe(10))
  it('rejects half-depth knee push-ups with a reason', () => {
    const r = run(def, 'knee_half')
    expect(r.count).toBe(0)
    expect(reasons(r.events)).toEqual(new Set(['not_deep_enough']))
  })
  it('does not count full push-ups, and points to the Push-ups exercise', () => {
    const r = run(def, 'full_normal')
    expect(r.count).toBe(0)
    expect(r.events[0]?.reason).toBe('other_exercise')
    expect(r.events[0]?.suggest).toBe('push_up')
    expect(r.events[0]?.message).toBe("That looks like a push-up. Choose Push-ups if that's what you're doing.")
  })
  it('standard push-ups do not count knee push-ups, and point to Knee push-ups', () => {
    const r = run(exerciseById('push_up'), 'knee_push_ups')
    expect(r.count).toBe(0)
    expect(r.events[0]?.message).toBe("That looks like a knee push-up. Choose Knee push-ups if that's what you're doing.")
  })
  it.each([1, 2, 3, 4])('stays exact under heavier landmark noise (seed %i)', (seed) => {
    expect(run(def, 'knee_push_ups', seed, 3).count).toBe(10)
  })
})

describe('squats', () => {
  const def = exerciseById('squat')
  it('counts 10 full squats', () => {
    const r = run(def, 'squat_full')
    expect(r.count).toBe(10)
    expect(reasons(r.events)).toEqual(new Set())
  })
  it('rejects half squats with "sit a little deeper"', () => {
    const r = run(def, 'squat_half')
    expect(r.count).toBe(0)
    expect(r.events[0]?.message).toMatch(/^Sit a little deeper\. Your knees reached 1\d\d°; aim for 100° or less\.$/)
  })
  it('never counts bending over to pick something up', () => expect(run(def, 'bend_pickup').count).toBe(0))
  it('never counts push-ups, arm curls or sit-ups', () => {
    for (const id of ['full_normal', 'arm_curls', 'situp_full', 'knee_push_ups']) expect(run(def, id).count, id).toBe(0)
  })
  it.each([1, 2, 3, 4])('stays exact under heavier landmark noise (seed %i)', (seed) => {
    expect(run(def, 'squat_full', seed, 3).count).toBe(10)
  })
})

describe('sit-ups (beta)', () => {
  const def = exerciseById('sit_up')
  it('counts 10 full sit-ups', () => expect(run(def, 'situp_full').count).toBe(10))
  it('does not count crunches as sit-ups, and says why', () => {
    const r = run(def, 'situp_crunch')
    expect(r.count).toBe(0)
    expect(r.events[0]?.message).toBe("Sit all the way up. A crunch doesn't count as a full sit-up.")
  })
  it('never counts push-ups, squats or arm curls', () => {
    for (const id of ['full_normal', 'squat_full', 'arm_curls', 'down_and_stay']) expect(run(def, id).count, id).toBe(0)
  })
  it.each([1, 2, 3, 4])('stays exact under heavier landmark noise (seed %i)', (seed) => {
    expect(run(def, 'situp_full', seed, 3).count).toBe(10)
  })
})

describe('push-ups are not fooled by other exercises', () => {
  it.each(['squat_full', 'situp_full', 'bend_pickup', 'situp_crunch'])('%s counts 0 push-ups', (id) => {
    expect(run(exerciseById('push_up'), id).count).toBe(0)
  })
})
