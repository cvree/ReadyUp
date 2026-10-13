import type { PoseFrame, Side } from '@readyup/pose-types'

/** Mean visibility of the given joints, or 0 when there are no landmarks. */
export function meanVisibility(frame: PoseFrame, joints: readonly number[]): number {
  const lms = frame.landmarks
  if (!lms || joints.length === 0) return 0
  let sum = 0
  for (const j of joints) sum += lms[j]?.visibility ?? 0
  return sum / joints.length
}

export interface SideSelectorOptions {
  /** How much better the other side must be before switching. */
  margin: number
  /** How long the other side must stay better before switching (ms). */
  holdMs: number
}

/**
 * Chooses the side of the body facing the camera, by landmark visibility, with hysteresis.
 * The far side is usually hidden and MediaPipe guesses it, so mixing both sides corrupts angles.
 */
export class SideSelector {
  private current: Side | null = null
  private betterSince: number | null = null

  constructor(
    private readonly jointsFor: (side: Side) => readonly number[],
    private readonly opts: SideSelectorOptions = { margin: 0.15, holdMs: 300 }
  ) {}

  get side(): Side | null {
    return this.current
  }

  reset(): void {
    this.current = null
    this.betterSince = null
  }

  /** @param canSwitch false while a rep is in progress, so the side never flips mid-rep */
  update(frame: PoseFrame, canSwitch: boolean): Side | null {
    if (!frame.landmarks) return this.current
    const left = meanVisibility(frame, this.jointsFor('left'))
    const right = meanVisibility(frame, this.jointsFor('right'))
    if (this.current === null) {
      this.current = left >= right ? 'left' : 'right'
      return this.current
    }
    const mine = this.current === 'left' ? left : right
    const other = this.current === 'left' ? right : left
    if (other - mine > this.opts.margin) {
      this.betterSince ??= frame.t
      if (canSwitch && frame.t - this.betterSince >= this.opts.holdMs) {
        this.current = this.current === 'left' ? 'right' : 'left'
        this.betterSince = null
        return this.current
      }
    } else {
      this.betterSince = null
    }
    return this.current
  }
}
