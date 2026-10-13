export * from './types'
export * from './geometry'
export * from './one-euro'
export * from './side'
export * from './messages'
export * from './counter'
export * from './tally'
export { pushUp, PUSH_UP_THRESHOLDS } from './pushup'

import { pushUp } from './pushup'
import type { ExerciseDefinition } from './types'

/** Registry of available exercises. Knee push-ups, squats and sit-ups arrive in milestone 5. */
export const EXERCISES: Readonly<Record<string, ExerciseDefinition>> = { [pushUp.id]: pushUp }
