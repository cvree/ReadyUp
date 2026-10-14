import { exerciseById } from '@readyup/exercise'
import { elapsedMs, formatClock, moveTotal, remainingMs, type ActiveSession, type SessionRecord } from '@readyup/session'
import type { Settings } from '@shared/ipc'
import * as C from '../state/controller'
import type { Slot } from '../ui/kit'

export function routineMove(s: Settings): string {
  return `${s.routine.reps} ${exerciseById(s.routine.exerciseId).copy.unit}`
}

/** Ready-check slots for the current state. */
export function slotsFor(settings: Settings, a: ActiveSession | null, t: number): { focus: Slot; move: Slot; play: Slot } {
  const game = C.chosenGame(settings)
  const play: Slot = { state: 'locked', value: game ? game.name : 'Add a game' }
  if (!a) {
    return { focus: { state: 'active', value: formatClock(settings.routine.focusMinutes * 60_000), progress: 0 }, move: { state: 'idle', value: routineMove(settings) }, play }
  }
  const unit = exerciseById(a.move.exerciseId).copy.unit
  const focusDone = a.phase !== 'focus'
  const focus: Slot = focusDone
    ? { state: 'done', value: formatClock(a.focus.accumulatedMs) }
    : { state: 'active', value: formatClock(remainingMs(a.focus, t)), progress: elapsedMs(a.focus, t) / a.focus.targetMs }
  let move: Slot = { state: 'idle', value: `${a.move.target} ${unit}` }
  if (a.phase === 'move') move = { state: 'active', value: `${Math.min(moveTotal(a.move), a.move.target)} / ${a.move.target}`, progress: Math.min(1, moveTotal(a.move) / a.move.target) }
  if (a.phase === 'ready') move = { state: 'done', value: a.move.override ? 'Override' : `${a.move.target} ${unit}` }
  return { focus, move, play: a.phase === 'ready' ? { state: 'ready', value: game ? game.name : 'Unlocked' } : play }
}

export function taskWord(r: SessionRecord['taskResult']): string {
  return r === 'done' ? 'you marked it done' : r === 'partly' ? 'you marked it partly done' : r === 'not_yet' ? 'not finished this time' : 'no answer'
}

const OVERRIDE_REASON: Record<string, string> = { injury: 'injury', accessibility: 'accessibility', camera: 'camera not working', other: 'other reason' }

/** Honest one-line summary of the Move part of a session. */
export function moveSummary(m: SessionRecord['move']): string {
  const unit = exerciseById(m.exerciseId).copy.unit
  if (m.override) {
    const why = OVERRIDE_REASON[m.override.reason] ?? m.override.reason
    const self = m.override.choice === 'self_report' && m.override.selfReported !== null ? `, ${m.override.selfReported} ${unit} self-reported` : ', skipped today'
    return `Override (${why})${self}${m.cameraCounted ? ` · ${m.cameraCounted} camera-counted` : ''}`
  }
  const net = m.corrections.reduce((s, c) => s + c.delta, 0)
  return `${m.cameraCounted} ${unit}, camera-counted${m.corrections.length ? ` · ${net >= 0 ? '+' : ''}${net} by hand (${m.corrections.length} correction${m.corrections.length === 1 ? '' : 's'})` : ''}`
}

export function partOfDay(t: number): string {
  const d = new Date(t)
  const day = d.toLocaleDateString(undefined, { weekday: 'long' })
  const h = d.getHours()
  return `${day} ${h < 5 ? 'night' : h < 12 ? 'morning' : h < 17 ? 'afternoon' : h < 22 ? 'evening' : 'night'}`
}
