import type { ExerciseDefinition, ReasonCode, RepMetrics, Thresholds } from './types'

export interface MessageContext {
  def: ExerciseDefinition
  th: Thresholds
  joints?: string[]
  /** Display name of the exercise this movement looked like (for 'other_exercise'). */
  suggestName?: string
}

/** Plain-language, encouraging explanations. Says what to do next, never scolds. */
export function messageFor(reason: ReasonCode, m: RepMetrics, ctx: MessageContext): string {
  const c = ctx.def.copy
  switch (reason) {
    case 'counted':
      return 'Nice rep.'
    case 'not_deep_enough':
      return c.notDeepEnough(m.minAngle, ctx.th.bottom)
    case 'no_lockout':
      return c.noLockout
    case 'too_fast':
      return `That was quicker than a real rep (${(m.durationMs / 1000).toFixed(1)} s). Probably camera jitter, so I skipped it.`
    case 'too_slow':
      return `That took longer than ${Math.round(ctx.th.maxRepMs / 1000)} seconds, so I didn't count it. Start again from the top.`
    case 'not_in_position':
      return c.notInPosition
    case 'other_exercise':
      return ctx.suggestName
        ? `That looks like ${article(ctx.suggestName)} ${ctx.suggestName.toLowerCase().replace(/s$/, '')}. Choose ${ctx.suggestName} if that's what you're doing.`
        : `That looks like a different exercise from ${c.unit}.`
    case 'hips_sagging':
      return c.hipsSagging ?? 'Lift your hips a little so your body makes a straight line.'
    case 'hips_piking':
      return c.hipsPiking ?? 'Lower your hips a little so your body makes a straight line.'
    case 'camera_interrupted':
      return 'The camera stopped mid-rep, so that one didn\'t count. Your count is saved.'
    case 'tracking_lost': {
      const what = ctx.joints && ctx.joints.length ? `your ${joinNames(ctx.joints)}` : 'you'
      return `I lost sight of ${what} mid-rep, so that one didn't count. ${ctx.def.view === 'side' ? 'Try turning more side-on to the camera.' : 'Check that your whole body is in view.'}`
    }
  }
}

function article(name: string): string {
  return /^[aeiou]/i.test(name) ? 'an' : 'a'
}

function joinNames(names: string[]): string {
  const unique = [...new Set(names)]
  if (unique.length <= 1) return unique[0] ?? ''
  return `${unique.slice(0, -1).join(', ')} and ${unique[unique.length - 1]}`
}
