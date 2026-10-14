import { SIDE_JOINTS } from '@readyup/pose-types'
import { angleDeg, inclinationDeg, offsetBelowLine } from './geometry'
import { sidePoints } from './points'
import { PUSH_UP_THRESHOLDS } from './pushup'
import type { ExerciseDefinition, GateResult } from './types'

/**
 * Push-ups from the knees: a separate exercise with its own standard, never a "failed" push-up.
 * The body line runs shoulder → hip → knee, and the knees must be bent and down.
 */
export const kneePushUp: ExerciseDefinition = {
  id: 'knee_push_up',
  name: 'Knee push-ups',
  beta: false,
  view: 'side',
  defaultThresholds: { ...PUSH_UP_THRESHOLDS, inclineMaxDeg: 40 },
  copy: {
    unit: 'knee push-ups',
    primaryLabel: 'Elbow',
    notDeepEnough: (min, bottom) => `Go a little lower. Your elbows reached ${Math.round(min)}°; aim for ${Math.round(bottom)}° or less.`,
    noLockout: 'Push all the way up to finish the rep.',
    notInPosition: 'Get into a knee push-up position: knees down, hands under shoulders.',
    hipsSagging: 'Lift your hips a little so your shoulders, hips and knees line up.',
    hipsPiking: 'Lower your hips a little so your shoulders, hips and knees line up.',
    phase: {
      waiting: 'Knees down, arms straight, and you\'re ready to start.',
      top: 'Ready. Lower yourself until your elbows reach about 100°.',
      descending: 'Keep going down…',
      bottom: 'Good depth. Now push all the way up.',
      ascending: 'Push all the way up to finish the rep.'
    }
  },

  requiredJoints(side) {
    const j = SIDE_JOINTS[side]
    return [j.shoulder, j.elbow, j.wrist, j.hip, j.knee]
  },

  primary(frame, side) {
    const p = sidePoints(frame, side)
    return angleDeg(p.shoulder, p.elbow, p.wrist)
  },

  extraSignals(frame, side) {
    const p = sidePoints(frame, side)
    return { bodyIncline: inclinationDeg(p.shoulder, p.knee), bodyLine: angleDeg(p.shoulder, p.hip, p.knee), knee: angleDeg(p.hip, p.knee, p.ankle) }
  },

  gates(frame, side, th): GateResult[] {
    const p = sidePoints(frame, side)
    const body = inclinationDeg(p.shoulder, p.knee)
    const horizontal = body <= th.inclineMaxDeg
    const knee = angleDeg(p.hip, p.knee, p.ankle)
    const bodyLine = angleDeg(p.shoulder, p.hip, p.knee)
    const hipOffset = offsetBelowLine(p.shoulder, p.knee, p.hip)
    return [
      { id: 'body_horizontal', label: 'Body near horizontal', pass: horizontal, value: body, threshold: th.inclineMaxDeg, unit: '°', reason: 'not_in_position' },
      { id: 'hands_below_shoulders', label: 'Hands below shoulders', pass: p.wrist.y > p.shoulder.y, value: p.wrist.y - p.shoulder.y, threshold: 0, unit: '', reason: 'not_in_position' },
      {
        id: 'knees_down', label: 'Knees bent and down', pass: knee < th.kneeStraightMin, value: knee, threshold: th.kneeStraightMin, unit: '°',
        reason: horizontal ? 'other_exercise' : 'not_in_position', ...(horizontal ? { suggest: 'push_up' } : {})
      },
      {
        id: 'body_line', label: 'Shoulders, hips and knees in line', pass: bodyLine >= th.bodyLineMin, value: bodyLine, threshold: th.bodyLineMin, unit: '°',
        reason: !horizontal ? 'not_in_position' : hipOffset > 0 ? 'hips_sagging' : 'hips_piking'
      }
    ]
  }
}
