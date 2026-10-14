import type { PoseFrame, Side } from '@readyup/pose-types'

export type Phase = 'waiting' | 'top' | 'descending' | 'bottom' | 'ascending'

export type RepOutcome = 'counted' | 'rejected' | 'voided'

export type ReasonCode =
  | 'counted'
  | 'not_deep_enough'
  | 'no_lockout'
  | 'too_fast'
  | 'too_slow'
  | 'not_in_position'
  | 'other_exercise'
  | 'hips_sagging'
  | 'hips_piking'
  | 'tracking_lost'
  | 'camera_interrupted'

export interface RepMetrics {
  /** Lowest primary angle reached during the attempt (degrees). */
  minAngle: number
  /** Highest primary angle reached during the attempt (degrees). */
  maxAngle: number
  durationMs: number
  side: Side | null
  /** Mean visibility of the required joints over the attempt. */
  meanVisibility: number
}

export interface RepEvent {
  outcome: RepOutcome
  reason: ReasonCode
  /** Plain-language explanation shown to the person. */
  message: string
  t: number
  /** Camera-counted total after this event. */
  count: number
  metrics: RepMetrics
  /** Joint names involved, for tracking-loss and framing reasons. */
  joints?: string[]
  /** For 'other_exercise': the exercise this movement looked like. */
  suggest?: string
}

export interface GateResult {
  id: string
  label: string
  pass: boolean
  /** Measured value, for display. */
  value: number
  /** Threshold the value is compared with, for display. */
  threshold: number
  unit: '°' | ''
  /** Reason reported when this gate fails. */
  reason: ReasonCode
  /** For 'other_exercise': the exercise id this looks like. */
  suggest?: string
}

/** All counting thresholds. Provisional; adjustable in Diagnostics. */
export interface Thresholds {
  /** Primary angle at or above which the body is at the top (degrees). */
  top: number
  /** Primary angle at or below which the rep reached the bottom (degrees). */
  bottom: number
  /** Minimum visibility of each required joint. */
  minVisibility: number
  /** Minimum shoulder–hip–ankle angle for a straight body (degrees). */
  bodyLineMin: number
  /** Maximum shoulder→ankle inclination from horizontal (degrees). */
  inclineMaxDeg: number
  /** Minimum hip–knee–ankle angle for straight legs (degrees). */
  kneeStraightMin: number
  minRepMs: number
  maxRepMs: number
  /** Short dropouts and gate blips up to this long are tolerated (ms). */
  toleranceMs: number
  /** Dips smaller than this below the top are treated as noise, not attempts (degrees). */
  noiseDipDeg: number
  /** Distance past a threshold needed to leave a phase (degrees). */
  hysteresisDeg: number
}

export interface Signals {
  /** Smoothed primary angle (elbow for push-ups). */
  primary: number | null
  /** Unsmoothed primary angle. */
  primaryRaw: number | null
  /** Additional measured values for display, keyed by name. */
  extra: Record<string, number>
}

export interface CounterSnapshot {
  t: number
  phase: Phase
  side: Side | null
  tracking: 'ok' | 'holding' | 'lost' | 'no_person'
  /** Required joints currently below the visibility threshold. */
  missingJoints: string[]
  signals: Signals
  gates: GateResult[]
  count: number
  /** Events emitted while processing this frame. */
  events: RepEvent[]
}

/** The words an exercise uses for feedback. Plain, encouraging, says what to do next. */
export interface ExerciseCopy {
  /** Plural noun for the count, e.g. "push-ups". */
  unit: string
  /** What the primary angle measures, e.g. "Elbow". */
  primaryLabel: string
  notDeepEnough(minAngle: number, bottom: number): string
  noLockout: string
  notInPosition: string
  hipsSagging?: string
  hipsPiking?: string
  phase: Record<Phase, string>
}

/** Everything specific to one exercise. The counter itself is exercise-agnostic. */
export interface ExerciseDefinition {
  id: string
  name: string
  /** Detection not yet validated on real cameras. Shown as a Beta label. */
  beta: boolean
  /** Camera placement the exercise needs. */
  view: 'side' | 'side_or_angle'
  copy: ExerciseCopy
  defaultThresholds: Thresholds
  /** Joints (indices) that must be visible on the chosen side. */
  requiredJoints(side: Side): readonly number[]
  /** Primary angle that goes high (top) → low (bottom) → high during a rep. */
  primary(frame: PoseFrame, side: Side): number
  /** Position gates. All must pass for a rep to count. */
  gates(frame: PoseFrame, side: Side, th: Thresholds): GateResult[]
  /** Extra signals to display in Diagnostics. */
  extraSignals(frame: PoseFrame, side: Side): Record<string, number>
}
