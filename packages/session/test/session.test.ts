import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ROUTINE, ActiveSessionSchema, answerTask, applyOverride, elapsedMs, endFocus, finishTimer, formatClock, isDone, markReady,
  moveComplete, moveTotal, newSession, pauseTimer, recoverSession, remainingMs, resumeTimer, startTimer, toRecord, weekStrip, weekTotals,
  type SessionRecord
} from '@readyup/session'

const MIN = 60_000
const T0 = Date.UTC(2026, 9, 14, 9, 0, 0)

describe('focus timer (measured time)', () => {
  it('counts running time and stops at the target', () => {
    const s = startTimer(25 * MIN, T0)
    expect(elapsedMs(s, T0 + 10 * MIN)).toBe(10 * MIN)
    expect(remainingMs(s, T0 + 10 * MIN)).toBe(15 * MIN)
    expect(elapsedMs(s, T0 + 40 * MIN)).toBe(25 * MIN)
    expect(isDone(s, T0 + 25 * MIN)).toBe(true)
  })
  it('excludes paused time and records each pause', () => {
    let s = startTimer(25 * MIN, T0)
    s = pauseTimer(s, T0 + 5 * MIN)
    expect(elapsedMs(s, T0 + 20 * MIN)).toBe(5 * MIN)
    s = resumeTimer(s, T0 + 20 * MIN)
    expect(elapsedMs(s, T0 + 30 * MIN)).toBe(15 * MIN)
    expect(s.pauses).toEqual([{ at: T0 + 5 * MIN, resumedAt: T0 + 20 * MIN, reason: 'user' }])
  })
  it('treats system sleep as a pause', () => {
    let s = startTimer(25 * MIN, T0)
    s = pauseTimer(s, T0 + 3 * MIN, 'sleep')
    expect(elapsedMs(s, T0 + 9 * 60 * MIN)).toBe(3 * MIN)
    expect(s.pauses[0]?.reason).toBe('sleep')
  })
  it('pause and resume are idempotent', () => {
    const s = pauseTimer(pauseTimer(startTimer(MIN, T0), T0 + 1000), T0 + 2000)
    expect(s.pauses).toHaveLength(1)
    expect(resumeTimer(resumeTimer(s, T0 + 3000), T0 + 4000).pauses[0]?.resumedAt).toBe(T0 + 3000)
  })
  it('ending early records only the measured time', () => {
    const s = finishTimer(startTimer(25 * MIN, T0), T0 + 12 * MIN, true)
    expect(s.accumulatedMs).toBe(12 * MIN)
    expect(s.endedEarly).toBe(true)
    expect(elapsedMs(s, T0 + 60 * MIN)).toBe(12 * MIN)
  })
  it('formats the clock', () => {
    expect(formatClock(25 * MIN)).toBe('25:00')
    expect(formatClock(61_001)).toBe('01:02')
    expect(formatClock(0)).toBe('00:00')
    expect(formatClock(95 * MIN)).toBe('1:35:00')
  })
})

describe('session flow', () => {
  const routine = { ...DEFAULT_ROUTINE, gameId: 'g1' }
  it('runs focus → review → move → ready and keeps corrections separate', () => {
    let s = newSession(routine, '  Chapter 4  ', T0, 'id1')
    expect(s.task).toBe('Chapter 4')
    s = endFocus(s, T0 + 25 * MIN, false)
    expect(s.phase).toBe('review')
    s = answerTask(s, 'partly')
    expect(s.phase).toBe('move')
    s = { ...s, move: { ...s.move, cameraCounted: 9, corrections: [{ t: 1, delta: 1, cameraCountAtTime: 9 }] } }
    expect(moveTotal(s.move)).toBe(10)
    expect(moveComplete(s.move)).toBe(true)
    s = markReady(s, T0 + 30 * MIN)
    const rec = toRecord(s, 'ready', T0 + 30 * MIN)
    expect(rec.move.cameraCounted).toBe(9)
    expect(rec.move.corrections).toHaveLength(1)
    expect(rec.focus.measuredMs).toBe(25 * MIN)
    expect(rec.taskResult).toBe('partly')
    expect(ActiveSessionSchema.safeParse(s).success).toBe(true)
  })
  it('an override completes Move without adding to the camera count', () => {
    let s = answerTask(endFocus(newSession(routine, 'x', T0, 'id2'), T0 + MIN, false), 'done')
    s = applyOverride(s, { at: T0 + 2 * MIN, reason: 'injury', choice: 'self_report', selfReported: 10 })
    expect(moveComplete(s.move)).toBe(true)
    expect(s.move.cameraCounted).toBe(0)
    expect(toRecord(markReady(s, T0 + 3 * MIN), 'ready', T0 + 3 * MIN).move.override?.selfReported).toBe(10)
  })
  it('after a crash, only time up to the last snapshot is measured, and the timer is paused', () => {
    const s = { ...newSession(routine, 'x', T0, 'id3'), savedAt: T0 + 7 * MIN }
    const r = recoverSession(s)
    expect(r.focus.runningSince).toBeNull()
    expect(elapsedMs(r.focus, T0 + 60 * MIN)).toBe(7 * MIN)
    expect(r.focus.pauses.at(-1)?.reason).toBe('crash')
  })
})

describe('weekly stats', () => {
  const rec = (daysAgo: number, over: Partial<SessionRecord> = {}): SessionRecord => ({
    ...toRecord(markReady(answerTask(endFocus(newSession(DEFAULT_ROUTINE, 't', T0, `r${daysAgo}`), T0 + 25 * MIN, false), 'done'), T0), 'ready', T0 - daysAgo * 86_400_000),
    ...over
  })
  it('builds a 7-day strip ending today', () => {
    const w = weekStrip([rec(0), rec(0), rec(2), rec(9)], T0)
    expect(w).toHaveLength(7)
    expect(w[6]!.isToday).toBe(true)
    expect(w[6]!.readyChecks).toBe(2)
    expect(w[4]!.readyChecks).toBe(1)
  })
  it('totals only camera-counted reps, and counts corrections and overrides separately', () => {
    const a = rec(1)
    a.move = { ...a.move, cameraCounted: 8, corrections: [{ t: 1, delta: 1, cameraCountAtTime: 8 }, { t: 2, delta: 1, cameraCountAtTime: 8 }] }
    const b = rec(2)
    b.move = { ...b.move, cameraCounted: 0, override: { at: 1, reason: 'camera', choice: 'self_report', selfReported: 10 } }
    b.launches = [{ at: 1, gameId: 'g', gameName: 'Overwatch 2', ok: true }]
    b.matches = [{ at: 2, result: 'win' }]
    const t = weekTotals([a, b, rec(12)], T0)
    expect(t.cameraReps).toEqual({ push_up: 8 })
    expect(t.corrections).toBe(2)
    expect(t.overrides).toBe(1)
    expect(t.gameSessions).toBe(1)
    expect(t.matchesLogged).toBe(1)
    expect(t.readyChecks).toBe(2)
  })
})
