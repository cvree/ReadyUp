import type { ReasonCode, RepMetrics } from './types'

const r = (n: number): number => Math.round(n)

/** Plain-language, encouraging explanations. Says what to do next, never scolds. */
export function messageFor(reason: ReasonCode, m: RepMetrics, extra: { bottom: number; top: number; joints?: string[] }): string {
  switch (reason) {
    case 'counted':
      return 'Nice rep.'
    case 'not_deep_enough':
      return `Go a little lower. Your elbows reached ${r(m.minAngle)}°; aim for ${r(extra.bottom)}° or less.`
    case 'no_lockout':
      return 'Push all the way up to finish the rep.'
    case 'too_fast':
      return `That was quicker than a real rep (${(m.durationMs / 1000).toFixed(1)} s). Probably camera jitter, so I skipped it.`
    case 'too_slow':
      return 'That took longer than 10 seconds, so I didn\'t count it. Start again from the top.'
    case 'not_in_push_up_position':
      return 'Get into a push-up position to start: hands under shoulders, body facing the floor.'
    case 'knee_push_up_detected':
      return 'That looks like a knee push-up. Choose Knee push-ups if that\'s what you\'re doing.'
    case 'hips_sagging':
      return 'Lift your hips a little so your body makes a straight line.'
    case 'hips_piking':
      return 'Lower your hips a little so your body makes a straight line.'
    case 'camera_interrupted':
      return 'The camera stopped mid-rep, so that one didn\'t count. Your count is saved.'
    case 'tracking_lost': {
      const what = extra.joints && extra.joints.length ? `your ${joinNames(extra.joints)}` : 'you'
      return `I lost sight of ${what} mid-rep, so that one didn't count. Try turning more side-on to the camera.`
    }
  }
}

function joinNames(names: string[]): string {
  const unique = [...new Set(names)]
  if (unique.length <= 1) return unique[0] ?? ''
  return `${unique.slice(0, -1).join(', ')} and ${unique[unique.length - 1]}`
}
