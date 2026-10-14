import { finishTimer, recoverTimer, startTimer } from './timer'
import type { ActiveSession, MoveOverride, MoveRecord, Routine, SessionRecord, TaskResult } from './schemas'

export function newSession(routine: Routine, task: string, now: number, id: string): ActiveSession {
  return {
    version: 1,
    id,
    createdAt: now,
    savedAt: now,
    routine,
    task: task.trim().slice(0, 200),
    phase: 'focus',
    focus: startTimer(routine.focusMinutes * 60_000, now),
    taskResult: null,
    move: { exerciseId: routine.exerciseId, target: routine.reps, cameraCounted: 0, corrections: [], override: null, completedAt: null },
    readyAt: null
  }
}

/** Camera count plus net manual corrections. The camera-counted total itself is never changed. */
export function moveTotal(m: MoveRecord): number {
  return m.cameraCounted + m.corrections.reduce((s, c) => s + c.delta, 0)
}

export function moveComplete(m: MoveRecord): boolean {
  return m.override !== null || moveTotal(m) >= m.target
}

export function endFocus(s: ActiveSession, now: number, early: boolean): ActiveSession {
  return { ...s, focus: finishTimer(s.focus, now, early), phase: 'review' }
}

export function answerTask(s: ActiveSession, result: Exclude<TaskResult, null>): ActiveSession {
  return { ...s, taskResult: result, phase: 'move' }
}

export function applyOverride(s: ActiveSession, o: MoveOverride): ActiveSession {
  return { ...s, move: { ...s.move, override: o, completedAt: o.at } }
}

export function markReady(s: ActiveSession, now: number): ActiveSession {
  return { ...s, phase: 'ready', readyAt: now, move: { ...s.move, completedAt: s.move.completedAt ?? now } }
}

/** Restores a session from a snapshot after the app restarted (cleanly or not). */
export function recoverSession(s: ActiveSession): ActiveSession {
  return { ...s, focus: recoverTimer(s.focus, s.savedAt) }
}

export function toRecord(s: ActiveSession, status: SessionRecord['status'], now: number): SessionRecord {
  return {
    id: s.id,
    startedAt: s.createdAt,
    completedAt: now,
    status,
    routine: s.routine,
    task: s.task,
    focus: {
      measuredMs: Math.round(s.focus.endedAt !== null ? s.focus.accumulatedMs : s.focus.accumulatedMs),
      targetMs: s.focus.targetMs,
      pauseCount: s.focus.pauses.length,
      endedEarly: s.focus.endedEarly
    },
    taskResult: s.taskResult,
    move: s.move,
    launches: [],
    matches: []
  }
}
