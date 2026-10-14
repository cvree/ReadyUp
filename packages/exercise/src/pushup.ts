import { SIDE_JOINTS } from '@readyup/pose-types'
import { angleDeg, inclinationDeg, offsetBelowLine } from './geometry'
import { sidePoints } from './points'
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

export const pushUp: ExerciseDefinition = {
  id: 'push_up',
  name: 'Push-ups',
  beta: false,
  view: 'side',
  defaultThresholds: PUSH_UP_THRESHOLDS,
  copy: {
    unit: 'push-ups',
    primaryLabel: 'Elbow',
    notDeepEnough: (min, bottom) => `Go a little lower. Your elbows reached ${Math.round(min)}°; aim for ${Math.round(bottom)}° or less.`,
    noLockout: 'Push all the way up to finish the rep.',
    notInPosition: 'Get into a push-up position to start: hands under shoulders, body facing the floor.',
    phase: {
      waiting: 'Get into a push-up position with your arms straight to start.',
      top: 'Ready. Lower yourself until your elbows reach about 100°.',
      descending: 'Keep going down…',
      bottom: 'Good depth. Now push all the way up.',
      ascending: 'Push all the way up to finish the rep.'
    }
  },

  requiredJoints(side) {
    const j = SIDE_JOINTS[side]
    return [j.shoulder, j.elbow, j.wrist, j.hip, j.knee, j.ankle]
  },

  primary(frame, side) {
    const p = sidePoints(frame, side)
    return angleDeg(p.shoulder, p.elbow, p.wrist)
  },

  extraSignals(frame, side) {
    const p = sidePoints(frame, side)
    return {
      bodyIncline: inclinationDeg(p.shoulder, p.ankle),
      bodyLine: angleDeg(p.shoulder, p.hip, p.ankle),
      knee: angleDeg(p.hip, p.knee, p.ankle)
    }
  },

  gates(frame, side, th): GateResult[] {
    const p = sidePoints(frame, side)
    // Whole-body inclination (shoulder→ankle) is unaffected by sagging or piked hips.
    const body = inclinationDeg(p.shoulder, p.ankle)
    const horizontal = body <= th.inclineMaxDeg
    const wristDrop = p.wrist.y - p.shoulder.y
    const knee = angleDeg(p.hip, p.knee, p.ankle)
    const bodyLine = angleDeg(p.shoulder, p.hip, p.ankle)
    const hipOffset = offsetBelowLine(p.shoulder, p.ankle, p.hip)
    return [
      { id: 'body_horizontal', label: 'Body near horizontal', pass: horizontal, value: body, threshold: th.inclineMaxDeg, unit: '°', reason: 'not_in_position' },
      { id: 'hands_below_shoulders', label: 'Hands below shoulders', pass: wristDrop > 0, value: wristDrop, threshold: 0, unit: '', reason: 'not_in_position' },
      {
        id: 'legs_straight', label: 'Legs straight', pass: knee >= th.kneeStraightMin, value: knee, threshold: th.kneeStraightMin, unit: '°',
        reason: horizontal ? 'other_exercise' : 'not_in_position', ...(horizontal ? { suggest: 'knee_push_up' } : {})
      },
      {
        id: 'body_line', label: 'Body in a straight line', pass: bodyLine >= th.bodyLineMin, value: bodyLine, threshold: th.bodyLineMin, unit: '°',
        reason: !horizontal ? 'not_in_position' : hipOffset > 0 ? 'hips_sagging' : 'hips_piking'
      }
    ]
  }
}
