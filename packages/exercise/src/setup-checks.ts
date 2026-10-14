import { LM, SIDE_JOINTS, type PoseFrame, type Side } from '@readyup/pose-types'
import { meanVisibility } from './side'
import type { ExerciseDefinition } from './types'

export type SetupCheckId = 'in_frame' | 'head' | 'distance' | 'angle' | 'lighting'

export interface SetupCheck {
  id: SetupCheckId
  label: string
  pass: boolean
  /** One specific change to make, or a short confirmation when passing. */
  hint: string
}

export interface SetupInput {
  frame: PoseFrame
  def: ExerciseDefinition
  /** Mean frame brightness 0–255, measured from a small downscaled copy of the frame (never stored). */
  luma: number | null
  minVisibility: number
}

const FRIENDLY: Record<string, string> = { shoulder: 'shoulders', elbow: 'elbows', wrist: 'hands', hip: 'hips', knee: 'knees', ankle: 'feet' }
const MARGIN = 0.03
const DARK_LUMA = 45

function bestSide(frame: PoseFrame, def: ExerciseDefinition): Side {
  return meanVisibility(frame, def.requiredJoints('left')) >= meanVisibility(frame, def.requiredJoints('right')) ? 'left' : 'right'
}

/**
 * Camera placement checks for an exercise, from one frame. Pure and cheap, so it can run every
 * frame. The pose model card puts people farther than ~4 m and frames without the head out of
 * scope, so both are checked.
 */
export function setupChecks(input: SetupInput): SetupCheck[] {
  const { frame, def, luma, minVisibility } = input
  const lighting: SetupCheck = luma === null
    ? { id: 'lighting', label: 'Lighting', pass: true, hint: 'Not measured' }
    : luma < DARK_LUMA
      ? { id: 'lighting', label: 'Lighting', pass: false, hint: "It's a bit dark for tracking. Turn on a light in front of you." }
      : { id: 'lighting', label: 'Lighting', pass: true, hint: 'Bright enough' }

  const lms = frame.landmarks
  if (!lms) {
    return [
      { id: 'in_frame', label: 'In frame', pass: false, hint: 'Step into view so your whole body is in the picture.' },
      { id: 'head', label: 'Head visible', pass: false, hint: 'Waiting to see you.' },
      { id: 'distance', label: 'Distance', pass: false, hint: 'Waiting to see you.' },
      { id: 'angle', label: 'Angle', pass: false, hint: 'Waiting to see you.' },
      lighting
    ]
  }

  const side = bestSide(frame, def)
  const names = Object.entries(SIDE_JOINTS[side]) as Array<[string, number]>
  const required = new Set(def.requiredJoints(side))
  const missing: string[] = []
  for (const [name, idx] of names) {
    if (!required.has(idx)) continue
    const l = lms[idx]
    if (!l || l.visibility < minVisibility || l.x < MARGIN || l.x > 1 - MARGIN || l.y < MARGIN || l.y > 1 - MARGIN) missing.push(FRIENDLY[name] ?? name)
  }
  const inFrame: SetupCheck = missing.length === 0
    ? { id: 'in_frame', label: 'In frame', pass: true, hint: 'Everything I need is in view' }
    : { id: 'in_frame', label: 'In frame', pass: false, hint: `I can't see your ${missing.join(' or ')}. ${missing.includes('feet') ? 'Move the camera back or tilt it down a little.' : 'Adjust the camera so your whole body is in view.'}` }

  const headVis = Math.max(lms[LM.NOSE]?.visibility ?? 0, lms[LM.LEFT_EAR]?.visibility ?? 0, lms[LM.RIGHT_EAR]?.visibility ?? 0)
  const head: SetupCheck = headVis >= 0.5
    ? { id: 'head', label: 'Head visible', pass: true, hint: 'Your head is in view' }
    : { id: 'head', label: 'Head visible', pass: false, hint: 'Make sure your head is in the picture too. Tracking needs it.' }

  // Body extent across the frame, from the visible body landmarks. With a typical webcam field of
  // view, a body in a plank ~4 m away (the model's stated limit) spans roughly 30% of the width.
  let minX = 1, maxX = 0, minY = 1, maxY = 0, seen = 0
  for (let i = 11; i < 33; i++) {
    const l = lms[i]
    if (!l || l.visibility < 0.5) continue
    seen++
    minX = Math.min(minX, l.x); maxX = Math.max(maxX, l.x); minY = Math.min(minY, l.y); maxY = Math.max(maxY, l.y)
  }
  const span = seen ? Math.max(maxX - minX, maxY - minY) : 0
  const distance: SetupCheck = span > 0.92
    ? { id: 'distance', label: 'Distance', pass: false, hint: 'You fill the whole picture. Move the camera back about a step.' }
    : span < 0.3
      ? { id: 'distance', label: 'Distance', pass: false, hint: 'You look far away. Move a little closer (within about 4 m).' }
      : { id: 'distance', label: 'Distance', pass: true, hint: `You fill about ${Math.round(span * 100)}% of the picture` }

  // Side-on check: in a side view both shoulders overlap horizontally.
  const ls = lms[LM.LEFT_SHOULDER]
  const rs = lms[LM.RIGHT_SHOULDER]
  const j = SIDE_JOINTS[side]
  const sh = lms[j.shoulder]
  const hp = lms[j.hip]
  let angle: SetupCheck = { id: 'angle', label: 'Angle', pass: true, hint: 'Good angle' }
  if (ls && rs && sh && hp) {
    const shoulderSep = Math.abs(ls.x - rs.x) * frame.width
    const torso = Math.hypot((sh.x - hp.x) * frame.width, (sh.y - hp.y) * frame.height)
    const ratio = torso > 0 ? shoulderSep / torso : 0
    const limit = def.view === 'side' ? 0.45 : 0.9
    if (ratio > limit) {
      angle = { id: 'angle', label: 'Angle', pass: false, hint: def.view === 'side' ? 'Turn so your side faces the camera.' : 'Turn a little so the camera sees you from the side or at an angle.' }
    } else {
      angle = { id: 'angle', label: 'Angle', pass: true, hint: def.view === 'side' ? 'Side-on, good' : 'Good angle' }
    }
  }
  return [inFrame, head, distance, angle, lighting]
}
