import { messageFor, type CounterSnapshot, type Thresholds } from '@readyup/exercise'

/** One plain-language line: what to do next. */
export function liveHint(s: CounterSnapshot | null, th: Thresholds): string {
  if (!s) return 'Getting ready…'
  if (s.tracking === 'no_person') return 'Step into view, side-on to the camera, with your whole body in the frame.'
  if (s.tracking === 'lost') return s.missingJoints.length ? `I can't see your ${[...new Set(s.missingJoints)].join(' or ')}. Adjust the camera so your whole side is in view.` : 'I lost sight of you.'
  if (s.tracking === 'holding') return 'Hold on, finding you again…'
  const failing = s.gates.find((g) => !g.pass)
  if (failing && (s.phase === 'waiting' || s.phase === 'top')) {
    return messageFor(failing.reason, { minAngle: NaN, maxAngle: NaN, durationMs: 0, side: s.side, meanVisibility: 0 }, { bottom: th.bottom, top: th.top })
  }
  switch (s.phase) {
    case 'waiting': return `Get into a push-up position with your arms straight (${th.top}° or more) to start.`
    case 'top': return `Ready. Lower yourself until your elbows reach ${th.bottom}°.`
    case 'descending': return 'Keep going down…'
    case 'bottom': return 'Good depth. Now push all the way up.'
    case 'ascending': return 'Push all the way up to finish the rep.'
  }
}
