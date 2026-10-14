import type { PoseFrame, Side } from '@readyup/pose-types'
import { bendPose, plankPose, project, situpPose, squatPose, standingCurlPose, type BodyPose } from './body'
import { gaussian, mulberry32 } from './rng'

/** One stretch of movement. Each produces a pose for every moment of its duration. */
/**
 * Pose families. The numeric pose parameter means: elbow angle (plank, knee_plank), knee angle
 * (squat), torso angle from the floor (situp), forward pitch from vertical (bend).
 */
export type PoseKind = 'plank' | 'knee_plank' | 'squat' | 'situp' | 'bend'

export type Segment =
  | { kind: 'hold'; pose: PoseKind | 'stand'; deg: number; durationMs: number; sag?: number }
  | { kind: 'move'; pose: PoseKind; fromDeg: number; toDeg: number; durationMs: number; sag?: number }
  | {
      kind: 'reps'
      pose: PoseKind
      reps: number
      topDeg: number
      bottomDeg: number
      descendMs: number
      ascendMs: number
      holdTopMs: number
      holdBottomMs: number
      sag?: number
      /** Uniform per-frame jitter on the elbow angle, ± degrees. */
      jitterDeg?: number
    }
  | { kind: 'curls'; reps: number; repMs: number }
  | { kind: 'absent'; durationMs: number }

export interface ScenarioOptions {
  fps: number
  seed: number
  width: number
  height: number
  nearSide: Side
  nearVisibility: number
  farVisibility: number
  noisePx: number
  farGarbage: boolean
  /** Intervals with no landmarks at all (person not detected). */
  dropouts: Array<{ startMs: number; durationMs: number }>
  /** At this time the near and far sides swap (simulates a left/right label flip). */
  sideFlipAtMs: number | null
}

export const DEFAULT_SCENARIO_OPTIONS: ScenarioOptions = {
  fps: 30,
  seed: 7,
  width: 1280,
  height: 720,
  nearSide: 'left',
  nearVisibility: 0.95,
  farVisibility: 0.3,
  noisePx: 1.0,
  farGarbage: false,
  dropouts: [],
  sideFlipAtMs: null
}

type PoseAt = (tLocal: number, rand: () => number) => BodyPose | null

const ease = (k: number): number => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, k)))
const clampAngle = (d: number): number => Math.min(179, Math.max(20, d))

function plankAt(pose: PoseKind, deg: number, sag: number): BodyPose {
  switch (pose) {
    case 'squat': return squatPose(Math.min(179, Math.max(40, deg)))
    case 'situp': return situpPose(Math.min(90, Math.max(-5, deg)))
    case 'bend': return bendPose(deg)
    default: return plankPose({ elbowDeg: clampAngle(deg), sag, knees: pose === 'knee_plank' })
  }
}

/** Duration of one rep in a 'reps' segment. */
export function repPeriodMs(s: Extract<Segment, { kind: 'reps' }>): number {
  return s.holdTopMs + s.descendMs + s.holdBottomMs + s.ascendMs
}

export function segmentDuration(s: Segment): number {
  switch (s.kind) {
    case 'hold': case 'move': case 'absent': return s.durationMs
    case 'reps': return s.reps * repPeriodMs(s)
    case 'curls': return s.reps * s.repMs
  }
}

function poseFn(s: Segment): PoseAt {
  switch (s.kind) {
    case 'hold':
      return () => (s.pose === 'stand' ? standingCurlPose(170) : plankAt(s.pose, s.deg, s.sag ?? 0))
    case 'move':
      return (t) => plankAt(s.pose, s.fromDeg + (s.toDeg - s.fromDeg) * ease(t / s.durationMs), s.sag ?? 0)
    case 'absent':
      return () => null
    case 'curls':
      return (t) => {
        const k = (t % s.repMs) / s.repMs
        const flex = k < 0.5 ? ease(k * 2) : 1 - ease((k - 0.5) * 2)
        return standingCurlPose(170 - 130 * flex)
      }
    case 'reps':
      return (t, rand) => {
        const period = repPeriodMs(s)
        const local = t % period
        let deg: number
        if (local < s.holdTopMs) deg = s.topDeg
        else if (local < s.holdTopMs + s.descendMs) deg = s.topDeg + (s.bottomDeg - s.topDeg) * ease((local - s.holdTopMs) / s.descendMs)
        else if (local < s.holdTopMs + s.descendMs + s.holdBottomMs) deg = s.bottomDeg
        else deg = s.bottomDeg + (s.topDeg - s.bottomDeg) * ease((local - s.holdTopMs - s.descendMs - s.holdBottomMs) / s.ascendMs)
        if (s.jitterDeg) deg += (rand() * 2 - 1) * s.jitterDeg
        return plankAt(s.pose, deg, s.sag ?? 0)
      }
  }
}

/** Renders a list of segments into pose frames at a fixed frame rate. Deterministic for a seed. */
export function generate(segments: Segment[], options: Partial<ScenarioOptions> = {}): PoseFrame[] {
  const o = { ...DEFAULT_SCENARIO_OPTIONS, ...options }
  const rand = mulberry32(o.seed)
  const gauss = (): number => gaussian(rand)
  const frames: PoseFrame[] = []
  const dt = 1000 / o.fps
  let offset = 0
  for (const seg of segments) {
    const dur = segmentDuration(seg)
    const at = poseFn(seg)
    for (let local = 0; local < dur; local += dt) {
      const t = offset + local
      const body = at(local, rand)
      const dropped = o.dropouts.some((d) => t >= d.startMs && t < d.startMs + d.durationMs)
      const flipped = o.sideFlipAtMs !== null && t >= o.sideFlipAtMs
      const near: Side = flipped ? (o.nearSide === 'left' ? 'right' : 'left') : o.nearSide
      const landmarks = body && !dropped
        ? project(body, {
            width: o.width, height: o.height, scale: 340, originX: 120, floorY: o.height - 90,
            nearSide: near, nearVisibility: o.nearVisibility, farVisibility: o.farVisibility,
            noisePx: o.noisePx, farGarbage: o.farGarbage, rand, gauss
          })
        : null
      frames.push({ t: Math.round(t * 1000) / 1000, width: o.width, height: o.height, landmarks })
    }
    offset += dur
  }
  return frames
}
