import { repPeriodMs, type ScenarioOptions, type Segment } from './scenario'

export interface Preset {
  id: string
  label: string
  description: string
  segments: Segment[]
  options?: Partial<ScenarioOptions>
}

type Reps = Extract<Segment, { kind: 'reps' }>

const LEAD_MS = 1000
const lead: Segment = { kind: 'hold', pose: 'plank', elbowDeg: 170, durationMs: LEAD_MS }
const tail: Segment = { kind: 'hold', pose: 'plank', elbowDeg: 170, durationMs: 600 }

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

export const PRESETS: readonly Preset[] = [
  { id: 'full_normal', label: 'Full reps', description: '10 full push-ups at a normal pace.', segments: [lead, normal, tail] },
  { id: 'full_slow', label: 'Slow reps', description: '10 full push-ups, about 4 s each.', segments: [lead, slow, tail] },
  { id: 'full_fast', label: 'Fast reps', description: '10 full push-ups, about 0.7 s each.', segments: [lead, fast, tail] },
  { id: 'pause_bottom', label: 'Pause at bottom', description: 'Full reps with a 3 s pause at the bottom.', segments: [lead, normalReps({ reps: 5, holdBottomMs: 3000 }), tail] },
  { id: 'pause_top', label: 'Pause at top', description: 'Full reps with a 3 s pause at the top.', segments: [lead, normalReps({ reps: 5, holdTopMs: 3000 }), tail] },
  { id: 'half_reps', label: 'Half reps', description: 'Only going halfway down (about 120°).', segments: [lead, normalReps({ bottomDeg: 120 }), tail] },
  {
    id: 'down_and_stay', label: 'Down and stay', description: 'Goes down, stays 5 s, then stands up without pushing.',
    segments: [lead, { kind: 'move', pose: 'plank', fromDeg: 170, toDeg: 85, durationMs: 700 }, { kind: 'hold', pose: 'plank', elbowDeg: 85, durationMs: 5000 }, { kind: 'hold', pose: 'stand', elbowDeg: 170, durationMs: 2000 }]
  },
  {
    id: 'no_lockout', label: 'No lockout', description: 'Never pushes all the way up (tops out around 135°).',
    segments: [lead, { kind: 'move', pose: 'plank', fromDeg: 170, toDeg: 135, durationMs: 300 }, normalReps({ topDeg: 135, bottomDeg: 85, holdTopMs: 100 }), { kind: 'hold', pose: 'plank', elbowDeg: 135, durationMs: 600 }]
  },
  {
    id: 'threshold_jitter', label: 'Jitter at thresholds', description: 'Holds right at the top and bottom thresholds with ±6° jitter.',
    segments: [lead, normalReps({ topDeg: 156, bottomDeg: 94, holdTopMs: 600, holdBottomMs: 600, jitterDeg: 6 }), tail]
  },
  { id: 'arm_curls', label: 'Standing arm curls', description: 'Standing side-on, curling the arm. Should never count.', segments: [{ kind: 'curls', reps: 5, repMs: 1500 }] },
  { id: 'hips_sagging', label: 'Hips sagging', description: 'Full-depth reps with the hips dropped well below the body line.', segments: [{ ...lead, sag: 0.25 } as Segment, normalReps({ sag: 0.25 }), tail] },
  {
    id: 'tracking_lost', label: 'Tracking lost mid-rep', description: 'Person disappears for 500 ms during rep 4.',
    segments: [lead, normal, tail], options: { dropouts: [{ startMs: timeInRep(normal, 3, 'mid_descent'), durationMs: 500 }] }
  },
  { id: 'far_arm_garbage', label: 'Hidden far arm', description: 'The far side is hidden and its landmarks are guesses.', segments: [lead, normal, tail], options: { farGarbage: true, farVisibility: 0.2 } },
  { id: 'side_flip', label: 'Side flip mid-set', description: 'Left/right labels swap during rep 5.', segments: [lead, normal, tail], options: { sideFlipAtMs: timeInRep(normal, 4, 'bottom') } },
  {
    id: 'knee_push_ups', label: 'Knee push-ups', description: 'Push-ups from the knees. Belongs to the separate Knee push-ups exercise.',
    segments: [{ kind: 'hold', pose: 'knee_plank', elbowDeg: 170, durationMs: LEAD_MS }, normalReps({ pose: 'knee_plank' }), { kind: 'hold', pose: 'knee_plank', elbowDeg: 170, durationMs: 600 }]
  },
  { id: 'walk_away', label: 'Walk out of frame', description: '3 reps, leaves for 3 s, returns and does 3 more.', segments: [lead, normalReps({ reps: 3 }), { kind: 'absent', durationMs: 3000 }, lead, normalReps({ reps: 3 }), tail] }
]

export function presetById(id: string): Preset | undefined {
  return PRESETS.find((p) => p.id === id)
}
