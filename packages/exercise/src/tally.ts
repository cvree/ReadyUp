/** Manual corrections are stored separately and never change the camera-counted total. */
export interface Correction {
  t: number
  delta: 1 | -1
  /** Camera-counted total when the correction was made. */
  cameraCountAtTime: number
}

export class RepTally {
  private camera = 0
  private readonly list: Correction[] = []

  get cameraCounted(): number {
    return this.camera
  }

  get corrections(): readonly Correction[] {
    return this.list
  }

  get netCorrection(): number {
    return this.list.reduce((sum, c) => sum + c.delta, 0)
  }

  /** Camera count plus net corrections. Used for "4 / 10", never for camera-counted totals. */
  get total(): number {
    return this.camera + this.netCorrection
  }

  setCameraCounted(n: number): void {
    this.camera = n
  }

  /** Returns false (and records nothing) if the correction would take the total below zero. */
  correct(delta: 1 | -1, t: number): boolean {
    if (this.total + delta < 0) return false
    this.list.push({ t, delta, cameraCountAtTime: this.camera })
    return true
  }

  reset(): void {
    this.camera = 0
    this.list.length = 0
  }
}
