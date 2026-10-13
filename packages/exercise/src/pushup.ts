import { SIDE_JOINTS, type PoseFrame, type Side } from '@readyup/pose-types'
import { angleDeg, inclinationDeg, offsetBelowLine, toPx, type Point } from './geometry'
import type { ExerciseDefinition, GateResult, Thresholds } from './types'

export const PUSH_UP_THRESHOLDS: Thresholds = {
  top: 150,
  bottom: 100,
  minVisibility: 0.6,
  bodyLineMin: 150,
  inclineMaxDeg: 35,
  kneeStraightMin: 150,
  /** Minimum time spent below the top threshold. Rejects single-frame glitches. */
  minRepMs: 300,
  maxRepMs: 10_000,
  toleranceMs: 300,
  noiseDipDeg: 20,
  hysteresisDeg: 10
}

interface Pts {
  shoulder: Point
  elbow: Point
  wrist: Point
  hip: Point
  knee: Point
  ankle: Point
}

function points(frame: PoseFrame, side: Side): Pts {
  const j = SIDE_JOINTS[side]
  const lms = frame.landmarks
  if (!lms) throw new Error('points() requires landmarks')
  const p = (i: number): Point => {
    const l = lms[i]
    if (!l) throw new Error(`missing landmark ${i}`)
    return toPx(frame, l)
  }
  return { shoulder: p(j.shoulder), elbow: p(j.elbow), wrist: p(j.wrist), hip: p(j.hip), knee: p(j.knee), ankle: p(j.ankle) }
}

export const pushUp: ExerciseDefinition = {
  id: 'push_up',
  name: 'Push-ups',
  defaultThresholds: PUSH_UP_THRESHOLDS,

  requiredJoints(side) {
    const j = SIDE_JOINTS[side]
    return [j.shoulder, j.elbow, j.wrist, j.hip, j.knee, j.ankle]
  },

  primary(frame, side) {
    const p = points(frame, side)
    return angleDeg(p.shoulder, p.elbow, p.wrist)
  },

  extraSignals(frame, side) {
    const p = points(frame, side)
    return {
      bodyIncline: inclinationDeg(p.shoulder, p.ankle),
      bodyLine: angleDeg(p.shoulder, p.hip, p.ankle),
      knee: angleDeg(p.hip, p.knee, p.ankle)
    }
  },

  gates(frame, side, th): GateResult[] {
    const p = points(frame, side)
    // Whole-body inclination (shoulder→ankle) is unaffected by sagging or piked hips.
    const body = inclinationDeg(p.shoulder, p.ankle)
    const horizontal = body <= th.inclineMaxDeg
    const wristDrop = p.wrist.y - p.shoulder.y
    const knee = angleDeg(p.hip, p.knee, p.ankle)
    const bodyLine = angleDeg(p.shoulder, p.hip, p.ankle)
    const hipOffset = offsetBelowLine(p.shoulder, p.ankle, p.hip)
    return [
      {
        id: 'body_horizontal', label: 'Body near horizontal', pass: horizontal,
        value: body, threshold: th.inclineMaxDeg, unit: '°', reason: 'not_in_push_up_position'
      },
      {
        id: 'hands_below_shoulders', label: 'Hands below shoulders', pass: wristDrop > 0,
        value: wristDrop, threshold: 0, unit: '', reason: 'not_in_push_up_position'
      },
      {
        id: 'legs_straight', label: 'Legs straight', pass: knee >= th.kneeStraightMin,
        value: knee, threshold: th.kneeStraightMin, unit: '°',
        reason: horizontal ? 'knee_push_up_detected' : 'not_in_push_up_position'
      },
      {
        id: 'body_line', label: 'Body in a straight line', pass: bodyLine >= th.bodyLineMin,
        value: bodyLine, threshold: th.bodyLineMin, unit: '°',
        reason: !horizontal ? 'not_in_push_up_position' : hipOffset > 0 ? 'hips_sagging' : 'hips_piking'
      }
    ]
  }
}
