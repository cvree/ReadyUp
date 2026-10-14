import { SIDE_JOINTS } from '@readyup/pose-types'
import { angleDeg, inclinationDeg } from './geometry'
import { sidePoints } from './points'
import type { ExerciseDefinition, GateResult, Thresholds } from './types'

export const SIT_UP_THRESHOLDS: Thresholds = {
  /** Hip angle (shoulder–hip–knee) when lying back with knees bent. */
  top: 120,
  /** Hip angle when sitting all the way up. */
  bottom: 75,
  minVisibility: 0.6,
  bodyLineMin: 0,
  inclineMaxDeg: 0,
  /** Here: maximum knee angle, so the knees stay bent. */
  kneeStraightMin: 135,
  minRepMs: 500,
  maxRepMs: 10_000,
  toleranceMs: 300,
  noiseDipDeg: 12,
  hysteresisDeg: 10
}

/**
 * Full sit-ups: from lying back to sitting up (torso about 70° or more from the floor) and back.
 * Beta until real-camera testing supports it, because pose models track lying-down bodies less
 * reliably. Crunches are a different movement and are not counted here.
 */
export const sitUp: ExerciseDefinition = {
  id: 'sit_up',
  name: 'Sit-ups',
  beta: true,
  view: 'side',
  defaultThresholds: SIT_UP_THRESHOLDS,
  copy: {
    unit: 'sit-ups',
    primaryLabel: 'Hip',
    notDeepEnough: () => 'Sit all the way up. A crunch doesn\'t count as a full sit-up.',
    noLockout: 'Lie all the way back to finish the rep.',
    notInPosition: 'Lie on your back with your knees bent and your side to the camera.',
    phase: {
      waiting: 'Lie back with your knees bent and your side to the camera to start.',
      top: 'Ready. Sit all the way up.',
      descending: 'Keep coming up…',
      bottom: 'Good. Now lie all the way back.',
      ascending: 'Lie all the way back to finish the rep.'
    }
  },

  requiredJoints(side) {
    const j = SIDE_JOINTS[side]
    return [j.shoulder, j.hip, j.knee, j.ankle]
  },

  primary(frame, side) {
    const p = sidePoints(frame, side)
    return angleDeg(p.shoulder, p.hip, p.knee)
  },

  extraSignals(frame, side) {
    const p = sidePoints(frame, side)
    return { torsoIncline: inclinationDeg(p.hip, p.shoulder), knee: angleDeg(p.hip, p.knee, p.ankle) }
  },

  gates(frame, side, th): GateResult[] {
    const p = sidePoints(frame, side)
    const knee = angleDeg(p.hip, p.knee, p.ankle)
    return [
      { id: 'knees_bent', label: 'Knees bent', pass: knee <= th.kneeStraightMin, value: knee, threshold: th.kneeStraightMin, unit: '°', reason: 'not_in_position' },
      { id: 'on_the_floor', label: 'Hips on the floor', pass: p.hip.y >= p.knee.y, value: p.hip.y - p.knee.y, threshold: 0, unit: '', reason: 'not_in_position' }
    ]
  }
}
