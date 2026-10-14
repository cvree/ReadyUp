export * from './types'
export * from './geometry'
export * from './one-euro'
export * from './side'
export * from './messages'
export * from './counter'
export * from './tally'
export * from './names'
export * from './setup-checks'
export { pushUp, PUSH_UP_THRESHOLDS } from './pushup'
export { kneePushUp } from './knee-pushup'
export { squat, SQUAT_THRESHOLDS } from './squat'
export { sitUp, SIT_UP_THRESHOLDS } from './situp'

import { kneePushUp } from './knee-pushup'
import { pushUp } from './pushup'
import { sitUp } from './situp'
import { squat } from './squat'
import type { ExerciseDefinition } from './types'

/** Registry of available exercises, in display order. New exercises plug in here. */
export const EXERCISE_LIST: readonly ExerciseDefinition[] = [pushUp, kneePushUp, squat, sitUp]
export const EXERCISES: Readonly<Record<string, ExerciseDefinition>> = Object.fromEntries(EXERCISE_LIST.map((e) => [e.id, e]))

export function exerciseById(id: string): ExerciseDefinition {
  return EXERCISES[id] ?? pushUp
}
