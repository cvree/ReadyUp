/** Sounds are synthesized so no audio file ships. Off by default. */
let ctx: AudioContext | null = null

/**
 * A short tick for each counted rep, so you can keep your eyes off the screen. The last rep of the
 * set is a higher note.
 */
export function playRepTick(last = false): void {
  try {
    ctx ??= new AudioContext()
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.value = last ? 1046.5 : 659.25
    g.gain.setValueAtTime(0, now)
    g.gain.linearRampToValueAtTime(0.16, now + 0.008)
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.16)
    osc.connect(g).connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.18)
  } catch {
    /* sound is optional */
  }
}

/** A soft three-note chord for the ready moment. */
export function playReadyChord(): void {
  try {
    ctx ??= new AudioContext()
    const now = ctx.currentTime
    const master = ctx.createGain()
    master.gain.value = 0.18
    master.connect(ctx.destination)
    ;[523.25, 659.25, 783.99].forEach((freq, i) => {
      const osc = ctx!.createOscillator()
      const g = ctx!.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      const start = now + i * 0.06
      g.gain.setValueAtTime(0, start)
      g.gain.linearRampToValueAtTime(0.5, start + 0.03)
      g.gain.exponentialRampToValueAtTime(0.001, start + 0.9)
      osc.connect(g).connect(master)
      osc.start(start)
      osc.stop(start + 1)
    })
  } catch {
    /* sound is optional */
  }
}
