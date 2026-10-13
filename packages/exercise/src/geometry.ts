import type { Landmark, PoseFrame } from '@readyup/pose-types'

export interface Point {
  x: number
  y: number
}

/** Landmark in pixel space, so angles are not distorted by the image aspect ratio. */
export function toPx(frame: PoseFrame, l: Landmark): Point {
  return { x: l.x * frame.width, y: l.y * frame.height }
}

/** Interior angle ABC in degrees, in [0, 180]. */
export function angleDeg(a: Point, b: Point, c: Point): number {
  const v1x = a.x - b.x
  const v1y = a.y - b.y
  const v2x = c.x - b.x
  const v2y = c.y - b.y
  const n1 = Math.hypot(v1x, v1y)
  const n2 = Math.hypot(v2x, v2y)
  if (n1 === 0 || n2 === 0) return 180
  const cos = (v1x * v2x + v1y * v2y) / (n1 * n2)
  return (Math.acos(Math.min(1, Math.max(-1, cos))) * 180) / Math.PI
}

/** Inclination of segment a→b from horizontal, in [0, 90]. 0 = horizontal, 90 = vertical. */
export function inclinationDeg(a: Point, b: Point): number {
  const dx = Math.abs(b.x - a.x)
  const dy = Math.abs(b.y - a.y)
  if (dx === 0 && dy === 0) return 0
  return (Math.atan2(dy, dx) * 180) / Math.PI
}

/**
 * Signed perpendicular offset of p from the line a→b, in pixels.
 * Positive means p lies below the line in the image (larger y).
 */
export function offsetBelowLine(a: Point, b: Point, p: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy)
  if (len === 0) return 0
  // y on the line at p.x (when the line is not vertical), compared with p.y.
  if (Math.abs(dx) > 1e-6) {
    const lineY = a.y + ((p.x - a.x) / dx) * dy
    const sign = p.y > lineY ? 1 : -1
    const cross = Math.abs(dx * (a.y - p.y) - dy * (a.x - p.x)) / len
    return sign * cross
  }
  return 0
}
