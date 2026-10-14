import type { FocusTimerState } from './schemas'

/**
 * Focus timer as *measured* time. All functions are pure and take `now` (epoch ms), so they are
 * testable with a fake clock and survive restarts as plain data.
 */
export function startTimer(targetMs: number, now: number): FocusTimerState {
  return { targetMs, accumulatedMs: 0, runningSince: now, startedAt: now, endedAt: null, endedEarly: false, pauses: [] }
}

export function elapsedMs(s: FocusTimerState, now: number): number {
  const running = s.runningSince !== null ? Math.max(0, now - s.runningSince) : 0
  return Math.min(s.targetMs, s.accumulatedMs + running)
}

export function remainingMs(s: FocusTimerState, now: number): number {
  return Math.max(0, s.targetMs - elapsedMs(s, now))
}

export function isRunning(s: FocusTimerState): boolean {
  return s.runningSince !== null && s.endedAt === null
}

export function isDone(s: FocusTimerState, now: number): boolean {
  return s.endedAt !== null || elapsedMs(s, now) >= s.targetMs
}

export function pauseTimer(s: FocusTimerState, now: number, reason: 'user' | 'sleep' | 'quit' = 'user'): FocusTimerState {
  if (s.runningSince === null || s.endedAt !== null) return s
  return {
    ...s,
    accumulatedMs: Math.min(s.targetMs, s.accumulatedMs + Math.max(0, now - s.runningSince)),
    runningSince: null,
    pauses: [...s.pauses, { at: now, resumedAt: null, reason }]
  }
}

export function resumeTimer(s: FocusTimerState, now: number): FocusTimerState {
  if (s.runningSince !== null || s.endedAt !== null) return s
  const pauses = s.pauses.slice()
  const last = pauses[pauses.length - 1]
  if (last && last.resumedAt === null) pauses[pauses.length - 1] = { ...last, resumedAt: now }
  return { ...s, runningSince: now, pauses }
}

/** Ends the timer: naturally when the target is reached, or early when the person chooses. */
export function finishTimer(s: FocusTimerState, now: number, early = false): FocusTimerState {
  if (s.endedAt !== null) return s
  const measured = elapsedMs(s, now)
  return { ...s, accumulatedMs: measured, runningSince: null, endedAt: now, endedEarly: early && measured < s.targetMs }
}

/**
 * After a crash, the last snapshot may say "running". We can only vouch for time up to that
 * snapshot, so measured time stops at `savedAt` and the timer is paused.
 */
export function recoverTimer(s: FocusTimerState, savedAt: number): FocusTimerState {
  if (s.runningSince === null || s.endedAt !== null) return s
  return {
    ...s,
    accumulatedMs: Math.min(s.targetMs, s.accumulatedMs + Math.max(0, savedAt - s.runningSince)),
    runningSince: null,
    pauses: [...s.pauses, { at: savedAt, resumedAt: null, reason: 'crash' }]
  }
}

/** mm:ss (or h:mm:ss) for display. Rounds up so the timer reaches 0:00 exactly at the end. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const sec = total % 60
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m).padStart(2, '0')
  return `${h > 0 ? `${h}:` : ''}${mm}:${String(sec).padStart(2, '0')}`
}
