import { LANDMARK_NAMES, type PoseFrame } from '@readyup/pose-types'
import { messageFor } from './messages'
import { EXERCISE_NAMES } from './names'
import { OneEuroFilter } from './one-euro'
import { SideSelector, meanVisibility } from './side'
import type {
  CounterSnapshot, ExerciseDefinition, GateResult, Phase, ReasonCode, RepEvent, RepMetrics, Signals, Thresholds
} from './types'

interface Attempt {
  start: number
  min: number
  max: number
  visSum: number
  visN: number
}

/** Tracks movement while not in a countable state, so we can explain why it didn't count. */
interface Shadow {
  sawTop: boolean
  sawBottom: boolean
  start: number
  min: number
  max: number
  /** Highest angle since the last bottom (for partial-lockout detection). */
  peakAfterBottom: number
}

const MID_REP: ReadonlySet<Phase> = new Set(['descending', 'bottom', 'ascending'])

const FRIENDLY_JOINT: Record<string, string> = {
  SHOULDER: 'shoulder', ELBOW: 'elbow', WRIST: 'wrist', HIP: 'hips', KNEE: 'knee', ANKLE: 'feet'
}

function friendlyJoint(index: number): string {
  const name = LANDMARK_NAMES[index] ?? ''
  const base = name.replace(/^[LR]_/, '')
  return FRIENDLY_JOINT[base] ?? base.toLowerCase()
}

function freshShadow(t: number): Shadow {
  return { sawTop: false, sawBottom: false, start: t, min: Infinity, max: -Infinity, peakAfterBottom: -Infinity }
}

/**
 * Exercise-agnostic rep counter. A rep counts only on a complete top → bottom → top cycle,
 * in a plausible position, with the required joints visible, within the allowed duration.
 * Every attempt that doesn't count produces an event with a reason.
 */
export class RepCounter {
  private th: Thresholds
  private phase: Phase = 'waiting'
  private count = 0
  private readonly sides: SideSelector
  private readonly filter = new OneEuroFilter()
  private lostSince: number | null = null
  private gateFailSince: number | null = null
  private lastTopT = 0
  private attempt: Attempt | null = null
  private ascendMax = -Infinity
  private shadow: Shadow = freshShadow(0)

  constructor(private readonly def: ExerciseDefinition, thresholds?: Partial<Thresholds>) {
    this.th = { ...def.defaultThresholds, ...thresholds }
    this.sides = new SideSelector((side) => def.requiredJoints(side))
  }

  get thresholds(): Thresholds {
    return { ...this.th }
  }

  get exercise(): ExerciseDefinition {
    return this.def
  }

  setThresholds(partial: Partial<Thresholds>): void {
    this.th = { ...this.th, ...partial }
  }

  resetThresholds(): void {
    this.th = { ...this.def.defaultThresholds }
  }

  /** Clears count, phase and history. Keeps thresholds. */
  reset(): void {
    this.phase = 'waiting'
    this.count = 0
    this.sides.reset()
    this.filter.reset()
    this.lostSince = null
    this.gateFailSince = null
    this.attempt = null
    this.ascendMax = -Infinity
    this.shadow = freshShadow(0)
  }

  /**
   * The input stopped (camera unplugged, source switched). A rep in progress is voided so it can't
   * be completed across the gap. Returns the event, if any.
   */
  interrupt(t: number): RepEvent | null {
    const events: RepEvent[] = []
    if (MID_REP.has(this.phase)) this.emit(events, 'voided', 'camera_interrupted', t, this.attemptMetrics(t, this.sides.side))
    if (this.phase !== 'waiting') this.toWaiting(t)
    this.filter.reset()
    this.lostSince = null
    this.gateFailSince = null
    return events[0] ?? null
  }

  update(frame: PoseFrame): CounterSnapshot {
    const events: RepEvent[] = []
    const t = frame.t

    if (!frame.landmarks) return this.loss(t, events, [], 'no_person')

    const side = this.sides.update(frame, this.phase === 'waiting' || this.phase === 'top')
    if (!side) return this.loss(t, events, [], 'no_person')

    const required = this.def.requiredJoints(side)
    const missing = required.filter((j) => (frame.landmarks?.[j]?.visibility ?? 0) < this.th.minVisibility)
    if (missing.length > 0) return this.loss(t, events, missing.map(friendlyJoint), 'lost')

    if (this.lostSince !== null) {
      this.lostSince = null
      if (this.phase === 'waiting') this.filter.reset()
    }

    const raw = this.def.primary(frame, side)
    const s = this.filter.filter(raw, t)
    const gates = this.def.gates(frame, side, this.th)
    const failing = gates.find((g) => !g.pass)
    const vis = meanVisibility(frame, required)

    let gatesOk = true
    if (failing) {
      this.gateFailSince ??= t
      gatesOk = t - this.gateFailSince < this.th.toleranceMs
    } else {
      this.gateFailSince = null
    }

    if (this.attempt) {
      this.attempt.min = Math.min(this.attempt.min, s)
      this.attempt.max = Math.max(this.attempt.max, s)
      this.attempt.visSum += vis
      this.attempt.visN += 1
    }

    if (!gatesOk && failing) {
      this.outOfPosition(s, t, failing, side, vis, events)
    } else {
      this.step(s, t, side, vis, events, failing !== undefined)
    }

    if (this.attempt && t - this.attempt.start > this.th.maxRepMs && MID_REP.has(this.phase)) {
      this.emit(events, 'rejected', 'too_slow', t, this.attemptMetrics(t, side))
      this.toWaiting(t)
    }

    const signals: Signals = { primary: s, primaryRaw: raw, extra: this.def.extraSignals(frame, side) }
    return this.snapshot(t, 'ok', [], signals, gates, events)
  }

  /**
   * @param failingNow a gate is failing on this frame but still within tolerance. A rep may
   *   neither start from nor finish at the top until every gate passes again.
   */
  private step(s: number, t: number, side: CounterSnapshot['side'], vis: number, events: RepEvent[], failingNow: boolean): void {
    const th = this.th
    switch (this.phase) {
      case 'waiting':
        if (s >= th.top && !failingNow) {
          this.phase = 'top'
          this.lastTopT = t
          this.shadow = freshShadow(t)
        } else {
          this.trackPartialLockout(s, t, side, vis, events)
        }
        break
      case 'top':
        if (s < th.top - th.hysteresisDeg) {
          this.phase = 'descending'
          this.attempt = { start: this.lastTopT, min: s, max: th.top, visSum: vis, visN: 1 }
        } else {
          this.lastTopT = t
        }
        break
      case 'descending':
        if (s <= th.bottom) {
          this.phase = 'bottom'
        } else if (s >= th.top) {
          const a = this.attempt
          if (a && a.min < th.top - th.noiseDipDeg) {
            this.emit(events, 'rejected', 'not_deep_enough', t, this.attemptMetrics(t, side))
          }
          this.backToTop(t)
        }
        break
      case 'bottom':
        if (s > th.bottom + th.hysteresisDeg) {
          this.phase = 'ascending'
          this.ascendMax = s
        }
        break
      case 'ascending':
        this.ascendMax = Math.max(this.ascendMax, s)
        if (s >= th.top && failingNow) {
          // Hold here: either the gate recovers (and the rep completes) or it fails for good.
        } else if (s >= th.top) {
          const m = this.attemptMetrics(t, side)
          if (m.durationMs < th.minRepMs) {
            this.emit(events, 'rejected', 'too_fast', t, m)
          } else {
            this.count += 1
            this.emit(events, 'counted', 'counted', t, m)
          }
          this.backToTop(t)
        } else if (s <= th.bottom) {
          this.phase = 'bottom'
        } else if (this.ascendMax - s > th.noiseDipDeg) {
          this.emit(events, 'rejected', 'no_lockout', t, this.attemptMetrics(t, side))
          this.toWaiting(t)
        }
        break
    }
  }

  /** Gates failing beyond tolerance: abandon any rep, and explain cycles done out of position. */
  private outOfPosition(s: number, t: number, failing: GateResult, side: CounterSnapshot['side'], vis: number, events: RepEvent[]): void {
    if (MID_REP.has(this.phase)) {
      this.emit(events, 'rejected', failing.reason, t, this.attemptMetrics(t, side), undefined, failing.suggest)
      this.toWaiting(t)
    } else if (this.phase === 'top') {
      this.toWaiting(t)
    }
    const sh = this.shadow
    sh.min = Math.min(sh.min, s)
    sh.max = Math.max(sh.max, s)
    if (s >= this.th.top) {
      if (sh.sawBottom) {
        this.emit(events, 'rejected', failing.reason, t, {
          minAngle: sh.min, maxAngle: sh.max, durationMs: t - sh.start, side, meanVisibility: vis
        }, undefined, failing.suggest)
      }
      this.shadow = { ...freshShadow(t), sawTop: true, min: s, max: s }
    } else if (s <= this.th.bottom && sh.sawTop) {
      sh.sawBottom = true
    }
  }

  /** In position but never reached the top: explain repeated partial reps as missing lockout. */
  private trackPartialLockout(s: number, t: number, side: CounterSnapshot['side'], vis: number, events: RepEvent[]): void {
    const sh = this.shadow
    sh.min = Math.min(sh.min, s)
    sh.max = Math.max(sh.max, s)
    if (s <= this.th.bottom) {
      if (!sh.sawBottom) sh.start = t
      sh.sawBottom = true
      sh.peakAfterBottom = -Infinity
      return
    }
    if (!sh.sawBottom) return
    sh.peakAfterBottom = Math.max(sh.peakAfterBottom, s)
    if (sh.peakAfterBottom > this.th.bottom + this.th.hysteresisDeg && sh.peakAfterBottom - s > this.th.noiseDipDeg) {
      this.emit(events, 'rejected', 'no_lockout', t, {
        minAngle: sh.min, maxAngle: sh.peakAfterBottom, durationMs: t - sh.start, side, meanVisibility: vis
      })
      this.shadow = freshShadow(t)
    }
  }

  private loss(t: number, events: RepEvent[], missing: string[], kind: 'lost' | 'no_person'): CounterSnapshot {
    this.lostSince ??= t
    let tracking: CounterSnapshot['tracking'] = 'holding'
    if (t - this.lostSince >= this.th.toleranceMs) {
      tracking = kind
      if (MID_REP.has(this.phase)) {
        this.emit(events, 'voided', 'tracking_lost', t, this.attemptMetrics(t, this.sides.side), missing)
      }
      if (this.phase !== 'waiting') this.toWaiting(t)
      this.filter.reset()
      this.gateFailSince = null
    }
    return this.snapshot(t, tracking, missing, { primary: null, primaryRaw: null, extra: {} }, [], events)
  }

  private backToTop(t: number): void {
    this.phase = 'top'
    this.lastTopT = t
    this.attempt = null
    this.ascendMax = -Infinity
  }

  private toWaiting(t: number): void {
    this.phase = 'waiting'
    this.attempt = null
    this.ascendMax = -Infinity
    this.shadow = freshShadow(t)
  }

  private attemptMetrics(t: number, side: CounterSnapshot['side']): RepMetrics {
    const a = this.attempt
    return {
      minAngle: a ? a.min : NaN,
      maxAngle: a ? Math.max(a.max, this.ascendMax) : NaN,
      durationMs: a ? t - a.start : 0,
      side,
      meanVisibility: a && a.visN ? a.visSum / a.visN : 0
    }
  }

  private emit(
    events: RepEvent[], outcome: RepEvent['outcome'], reason: ReasonCode, t: number, metrics: RepMetrics, joints?: string[], suggest?: string
  ): void {
    const suggestName = suggest ? EXERCISE_NAMES[suggest] : undefined
    const message = messageFor(reason, metrics, {
      def: this.def, th: this.th, ...(joints ? { joints } : {}), ...(suggestName ? { suggestName } : {})
    })
    events.push({
      outcome, reason, message, t, count: this.count, metrics,
      ...(joints && joints.length ? { joints } : {}), ...(suggest ? { suggest } : {})
    })
  }

  private snapshot(
    t: number, tracking: CounterSnapshot['tracking'], missingJoints: string[], signals: Signals, gates: GateResult[], events: RepEvent[]
  ): CounterSnapshot {
    return { t, phase: this.phase, side: this.sides.side, tracking, missingJoints, signals, gates, count: this.count, events }
  }
}
