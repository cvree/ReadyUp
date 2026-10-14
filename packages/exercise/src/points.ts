import { SIDE_JOINTS, type PoseFrame, type Side } from '@readyup/pose-types'
import { toPx, type Point } from './geometry'

export interface SidePoints {
  shoulder: Point
  elbow: Point
  wrist: Point
  hip: Point
  knee: Point
  ankle: Point
}

/** Pixel-space joints for one side of the body. */
export function sidePoints(frame: PoseFrame, side: Side): SidePoints {
  const j = SIDE_JOINTS[side]
  const lms = frame.landmarks
  if (!lms) throw new Error('sidePoints() requires landmarks')
  const p = (i: number): Point => {
    const l = lms[i]
    if (!l) throw new Error(`missing landmark ${i}`)
    return toPx(frame, l)
  }
  return { shoulder: p(j.shoulder), elbow: p(j.elbow), wrist: p(j.wrist), hip: p(j.hip), knee: p(j.knee), ankle: p(j.ankle) }
}
