import { SIDE_JOINTS } from '@readyup/pose-types'
import { angleDeg, inclinationDeg } from './geometry'
import { sidePoints } from './points'
import type { ExerciseDefinition, GateResult, Thresholds } from './types'

export const SQUAT_THRESHOLDS: Thresholds = {
  top: 160,
  bottom: 100,
  minVisibility: 0.6,
  bodyLineMin: 0,
  /** Here: minimum torso inclination from horizontal, so bending over to pick something up doesn't count. */
  inclineMaxDeg: 40,
  kneeStraightMin: 0,
  minRepMs: 400,
  maxRepMs: 10_000,
  toleranceMs: 300,
  noiseDipDeg: 20,
  hysteresisDeg: 10
}

export const squat: ExerciseDefinition = {
  id: 'squat',
  name: 'Squats',
  beta: false,
  view: 'side_or_angle',
  defaultThresholds: SQUAT_THRESHOLDS,
  copy: {
    unit: 'squats',
    primaryLabel: 'Knee',
    notDeepEnough: (min, bottom) => `Sit a little deeper. Your knees reached ${Math.round(min)}°; aim for ${Math.round(bottom)}° or less.`,
    noLockout: 'Stand all the way up to finish the rep.',
    notInPosition: 'Stand tall, side-on or at an angle to the camera, to start.',
    phase: {
      waiting: 'Stand tall with your whole body in view to start.',
      top: 'Ready. Sit back and down until your knees reach about 100°.',
      descending: 'Keep sitting back…',
      bottom: 'Good depth. Now stand all the way up.',
      ascending: 'Stand all the way up to finish the rep.'
    }
  },

  requiredJoints(side) {
    const j = SIDE_JOINTS[side]
    return [j.shoulder, j.hip, j.knee, j.ankle]
  },

  primary(frame, side) {
    const p = sidePoints(frame, side)
    return angleDeg(p.hip, p.knee, p.ankle)
  },

  extraSignals(frame, side) {
    const p = sidePoints(frame, side)
    return { torsoIncline: inclinationDeg(p.hip, p.shoulder), hip: angleDeg(p.shoulder, p.hip, p.knee) }
  },

  gates(frame, side, th): GateResult[] {
    const p = sidePoints(frame, side)
    const torso = inclinationDeg(p.hip, p.shoulder)
    return [
      { id: 'torso_upright', label: 'Chest up', pass: torso >= th.inclineMaxDeg && p.shoulder.y < p.hip.y, value: torso, threshold: th.inclineMaxDeg, unit: '°', reason: 'not_in_position' },
      { id: 'feet_down', label: 'Feet below knees', pass: p.ankle.y > p.knee.y, value: p.ankle.y - p.knee.y, threshold: 0, unit: '', reason: 'not_in_position' }
    ]
  }
}
