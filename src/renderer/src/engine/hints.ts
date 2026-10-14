import { EXERCISE_NAMES, messageFor, type CounterSnapshot, type ExerciseDefinition, type Thresholds } from '@readyup/exercise'

/** One plain-language line: what to do next. */
export function liveHint(s: CounterSnapshot | null, def: ExerciseDefinition, th: Thresholds): string {
  if (!s) return 'Getting ready…'
  if (s.tracking === 'no_person') return 'Step into view with your whole body in the picture.'
  if (s.tracking === 'lost') return s.missingJoints.length ? `I can't see your ${[...new Set(s.missingJoints)].join(' or ')}. Adjust the camera so your whole side is in view.` : 'I lost sight of you.'
  if (s.tracking === 'holding') return 'Hold on, finding you again…'
  const failing = s.gates.find((g) => !g.pass)
  if (failing && (s.phase === 'waiting' || s.phase === 'top')) {
    return messageFor(failing.reason, { minAngle: NaN, maxAngle: NaN, durationMs: 0, side: s.side, meanVisibility: 0 }, { def, th, ...(failing.suggest && EXERCISE_NAMES[failing.suggest] ? { suggestName: EXERCISE_NAMES[failing.suggest] } : {}) })
  }
  return def.copy.phase[s.phase]
}
