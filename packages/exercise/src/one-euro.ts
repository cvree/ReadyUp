/**
 * One-Euro filter (Casiez, Roussel & Vogel, CHI 2012) for a single scalar signal.
 * Low jitter when the signal is slow, low lag when it moves fast.
 */
export interface OneEuroParams {
  minCutoff: number
  beta: number
  dCutoff: number
}

export const DEFAULT_ONE_EURO: OneEuroParams = { minCutoff: 1.5, beta: 0.04, dCutoff: 1.0 }

function alpha(cutoff: number, dtSec: number): number {
  const tau = 1 / (2 * Math.PI * cutoff)
  return 1 / (1 + tau / dtSec)
}

export class OneEuroFilter {
  private x: number | null = null
  private dx = 0
  private lastT: number | null = null

  constructor(private readonly params: OneEuroParams = DEFAULT_ONE_EURO) {}

  reset(): void {
    this.x = null
    this.dx = 0
    this.lastT = null
  }

  /** @param tMs timestamp in milliseconds */
  filter(value: number, tMs: number): number {
    if (this.x === null || this.lastT === null || tMs <= this.lastT) {
      this.x = value
      this.lastT = tMs
      return value
    }
    const dt = (tMs - this.lastT) / 1000
    this.lastT = tMs
    const rawDx = (value - this.x) / dt
    const aD = alpha(this.params.dCutoff, dt)
    this.dx = aD * rawDx + (1 - aD) * this.dx
    const cutoff = this.params.minCutoff + this.params.beta * Math.abs(this.dx)
    const a = alpha(cutoff, dt)
    this.x = a * value + (1 - a) * this.x
    return this.x
  }
}
