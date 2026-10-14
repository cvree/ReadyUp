import { repPeriodMs, type PoseKind, type ScenarioOptions, type Segment } from './scenario'

export interface Preset {
  id: string
  label: string
  description: string
  segments: Segment[]
  options?: Partial<ScenarioOptions>
  /** The exercise this preset demonstrates (running it under another exercise tests rejection). */
  exercise: string
}

type Reps = Extract<Segment, { kind: 'reps' }>

const LEAD_MS = 1000
const hold = (pose: PoseKind, deg: number, durationMs: number, sag = 0): Segment => ({ kind: 'hold', pose, deg, durationMs, sag })
const lead: Segment = hold('plank', 170, LEAD_MS)
const tail: Segment = hold('plank', 170, 600)

export function normalReps(over: Partial<Reps> = {}): Reps {
  return {
    kind: 'reps', pose: 'plank', reps: 10, topDeg: 170, bottomDeg: 85,
    descendMs: 700, ascendMs: 700, holdTopMs: 300, holdBottomMs: 100, ...over
  }
}

/** Time (ms) of a point inside rep `index` (0-based) of a preset that starts with the standard lead-in. */
export function timeInRep(r: Reps, index: number, part: 'mid_descent' | 'bottom' | 'mid_ascent'): number {
  const start = LEAD_MS + index * repPeriodMs(r) + r.holdTopMs
  if (part === 'mid_descent') return start + r.descendMs / 2
  if (part === 'bottom') return start + r.descendMs + r.holdBottomMs / 2
  return start + r.descendMs + r.holdBottomMs + r.ascendMs / 2
}

const normal = normalReps()
const slow = normalReps({ descendMs: 1900, ascendMs: 1900, holdBottomMs: 200, holdTopMs: 400 })
const fast = normalReps({ descendMs: 330, ascendMs: 330, holdBottomMs: 40, holdTopMs: 0 })
const squats = (over: Partial<Reps> = {}): Reps => normalReps({ pose: 'squat', topDeg: 175, bottomDeg: 80, descendMs: 900, ascendMs: 800, holdTopMs: 300, holdBottomMs: 150, ...over })
const situps = (over: Partial<Reps> = {}): Reps => normalReps({ pose: 'situp', topDeg: 0, bottomDeg: 75, descendMs: 1000, ascendMs: 900, holdTopMs: 300, holdBottomMs: 150, ...over })

export const PRESETS: readonly Preset[] = [
  // Push-ups
  { exercise: 'push_up', id: 'full_normal', label: 'Full reps', description: '10 full push-ups at a normal pace.', segments: [lead, normal, tail] },
  { exercise: 'push_up', id: 'full_slow', label: 'Slow reps', description: '10 full push-ups, about 4 s each.', segments: [lead, slow, tail] },
  { exercise: 'push_up', id: 'full_fast', label: 'Fast reps', description: '10 full push-ups, about 0.7 s each.', segments: [lead, fast, tail] },
  { exercise: 'push_up', id: 'pause_bottom', label: 'Pause at bottom', description: 'Full reps with a 3 s pause at the bottom.', segments: [lead, normalReps({ reps: 5, holdBottomMs: 3000 }), tail] },
  { exercise: 'push_up', id: 'pause_top', label: 'Pause at top', description: 'Full reps with a 3 s pause at the top.', segments: [lead, normalReps({ reps: 5, holdTopMs: 3000 }), tail] },
  { exercise: 'push_up', id: 'half_reps', label: 'Half reps', description: 'Only going halfway down (about 120°).', segments: [lead, normalReps({ bottomDeg: 120 }), tail] },
  {
    exercise: 'push_up', id: 'down_and_stay', label: 'Down and stay', description: 'Goes down, stays 5 s, then stands up without pushing.',
    segments: [lead, { kind: 'move', pose: 'plank', fromDeg: 170, toDeg: 85, durationMs: 700 }, hold('plank', 85, 5000), { kind: 'hold', pose: 'stand', deg: 170, durationMs: 2000 }]
  },
  {
    exercise: 'push_up', id: 'no_lockout', label: 'No lockout', description: 'Never pushes all the way up (tops out around 135°).',
    segments: [lead, { kind: 'move', pose: 'plank', fromDeg: 170, toDeg: 135, durationMs: 300 }, normalReps({ topDeg: 135, bottomDeg: 85, holdTopMs: 100 }), hold('plank', 135, 600)]
  },
  {
    exercise: 'push_up', id: 'threshold_jitter', label: 'Jitter at thresholds', description: 'Holds right at the top and bottom thresholds with ±6° jitter.',
    segments: [lead, normalReps({ topDeg: 156, bottomDeg: 94, holdTopMs: 600, holdBottomMs: 600, jitterDeg: 6 }), tail]
  },
  { exercise: 'push_up', id: 'arm_curls', label: 'Standing arm curls', description: 'Standing side-on, curling the arm. Should never count.', segments: [{ kind: 'curls', reps: 5, repMs: 1500 }] },
  { exercise: 'push_up', id: 'hips_sagging', label: 'Hips sagging', description: 'Full-depth reps with the hips dropped well below the body line.', segments: [hold('plank', 170, LEAD_MS, 0.25), normalReps({ sag: 0.25 }), tail] },
  {
    exercise: 'push_up', id: 'tracking_lost', label: 'Tracking lost mid-rep', description: 'Person disappears for 500 ms during rep 4.',
    segments: [lead, normal, tail], options: { dropouts: [{ startMs: timeInRep(normal, 3, 'mid_descent'), durationMs: 500 }] }
  },
  { exercise: 'push_up', id: 'far_arm_garbage', label: 'Hidden far arm', description: 'The far side is hidden and its landmarks are guesses.', segments: [lead, normal, tail], options: { farGarbage: true, farVisibility: 0.2 } },
  { exercise: 'push_up', id: 'side_flip', label: 'Side flip mid-set', description: 'Left/right labels swap during rep 5.', segments: [lead, normal, tail], options: { sideFlipAtMs: timeInRep(normal, 4, 'bottom') } },
  { exercise: 'push_up', id: 'walk_away', label: 'Walk out of frame', description: '3 reps, leaves for 3 s, returns and does 3 more.', segments: [lead, normalReps({ reps: 3 }), { kind: 'absent', durationMs: 3000 }, lead, normalReps({ reps: 3 }), tail] },
  // Knee push-ups
  {
    exercise: 'knee_push_up', id: 'knee_push_ups', label: 'Knee push-ups', description: '10 push-ups from the knees.',
    segments: [hold('knee_plank', 170, LEAD_MS), normalReps({ pose: 'knee_plank' }), hold('knee_plank', 170, 600)]
  },
  {
    exercise: 'knee_push_up', id: 'knee_half', label: 'Knee push-ups, half depth', description: 'Knee push-ups only going halfway down.',
    segments: [hold('knee_plank', 170, LEAD_MS), normalReps({ pose: 'knee_plank', bottomDeg: 122 }), hold('knee_plank', 170, 600)]
  },
  // Squats
  { exercise: 'squat', id: 'squat_full', label: 'Squats', description: '10 full squats, side-on.', segments: [hold('squat', 175, LEAD_MS), squats(), hold('squat', 175, 600)] },
  { exercise: 'squat', id: 'squat_half', label: 'Half squats', description: 'Squats only going about halfway down.', segments: [hold('squat', 175, LEAD_MS), squats({ bottomDeg: 128 }), hold('squat', 175, 600)] },
  {
    exercise: 'squat', id: 'bend_pickup', label: 'Bending over', description: 'Bending forward from the hips, as if picking something up. Should not count.',
    segments: [hold('squat', 175, LEAD_MS), normalReps({ pose: 'bend', reps: 5, topDeg: 0, bottomDeg: 85, descendMs: 900, ascendMs: 900 }), hold('squat', 175, 600)]
  },
  // Sit-ups
  { exercise: 'sit_up', id: 'situp_full', label: 'Sit-ups', description: '10 full sit-ups, side-on.', segments: [hold('situp', 0, LEAD_MS), situps(), hold('situp', 0, 600)] },
  { exercise: 'sit_up', id: 'situp_crunch', label: 'Crunches', description: 'Crunches (torso lifts about 35°). Not counted as sit-ups.', segments: [hold('situp', 0, LEAD_MS), situps({ bottomDeg: 35 }), hold('situp', 0, 600)] }
]

export function presetById(id: string): Preset | undefined {
  return PRESETS.find((p) => p.id === id)
}

export function presetsFor(exerciseId: string): Preset[] {
  return PRESETS.filter((p) => p.exercise === exerciseId)
}
