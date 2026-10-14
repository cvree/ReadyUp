import {
  answerTask, applyOverride, elapsedMs, endFocus, isDone, markReady, moveComplete, newSession, pauseTimer, resumeTimer, toRecord,
  type ActiveSession, type MoveOverride, type TaskResult
} from '@readyup/session'
import { EXERCISE_NAMES, exerciseById } from '@readyup/exercise'
import type { Settings, SettingsPatch } from '@shared/ipc'
import { engine, type TallyView } from '../engine/engine'
import { useApp } from '../engine/store'
import { playReadyChord } from './sound'
import { useStore, type Screen } from './store'

const SETUP_VALID_MS = 7 * 24 * 3600_000
const SAVE_EVERY_MS = 5000

let clockBase = Date.now()
let scale = 1
/** Epoch ms. Accelerated only in end-to-end tests. */
export function now(): number {
  return scale === 1 ? Date.now() : Math.round(clockBase + (Date.now() - clockBase) * scale)
}

const api = (): typeof window.readyup => window.readyup
const get = useStore.getState
const set = useStore.setState

function uid(): string {
  return crypto.randomUUID()
}

// ---------------------------------------------------------------- boot

export async function boot(): Promise<void> {
  const [settings, runtime, history, active] = await Promise.all([
    api().getSettings(), api().getRuntimeConfig(), api().listHistory(), api().loadActiveSession()
  ])
  scale = runtime.timeScale
  clockBase = Date.now()
  set({ settings, runtime, history, active, recovered: active !== null })
  applyMotion(settings)
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', () => applyMotion(get().settings))
  api().onPower(onPower)
  engine.onTally(onTally)
  if (active && active.phase === 'move') engine.setExercise(active.move.exerciseId, { cameraCounted: active.move.cameraCounted, corrections: active.move.corrections })
  set({ screen: settings.onboarded ? 'lobby' : 'onboarding' })
  // Warm the tracker quietly so Move starts instantly. The camera stays off.
  const idle = (cb: () => void): void => void ('requestIdleCallback' in window ? requestIdleCallback(cb, { timeout: 3000 }) : setTimeout(cb, 1500))
  idle(() => engine.warmModel())
  if (runtime.e2e) Object.assign(window, { __readyup: { engine, store: useStore, engineStore: useApp, controller: exported } })
}

function applyMotion(s: Settings): void {
  const system = matchMedia('(prefers-reduced-motion: reduce)').matches
  const reduced = s.motion === 'reduced' || (s.motion === 'system' && system)
  document.documentElement.dataset.motion = reduced ? 'reduced' : 'full'
  set({ reducedMotion: reduced })
}

// ---------------------------------------------------------------- navigation and settings

export function go(screen: Screen, returnTo: Screen | null = null): void {
  set({ screen, returnTo, toast: null })
}

export function toast(text: string, tone: 'info' | 'error' = 'info'): void {
  set({ toast: { text, tone } })
}

export async function updateSettings(patch: SettingsPatch): Promise<Settings> {
  const settings = await api().updateSettings(patch)
  set({ settings })
  applyMotion(settings)
  return settings
}

export async function finishOnboarding(): Promise<void> {
  await updateSettings({ onboarded: true })
  go('lobby')
  engine.warmModel()
}

// ---------------------------------------------------------------- persistence

let lastSave = 0
async function persist(a: ActiveSession | null): Promise<void> {
  set({ active: a })
  if (!a) {
    await api().clearActiveSession()
    return
  }
  const stamped = { ...a, savedAt: now() }
  lastSave = Date.now()
  set({ active: stamped })
  await api().saveActiveSession(stamped)
}

// ---------------------------------------------------------------- focus

export async function startFocus(task: string): Promise<void> {
  const { settings, active } = get()
  if (active && active.phase === 'ready') await api().clearActiveSession()
  const s = newSession(settings.routine, task, now(), uid())
  set({ recovered: false, sleptDuringFocus: false })
  await persist(s)
  api().log('session.focus_started', { focusMinutes: settings.routine.focusMinutes })
  go('focus')
}

export function togglePause(): void {
  const a = get().active
  if (!a || a.phase !== 'focus') return
  const f = a.focus.runningSince === null ? resumeTimer(a.focus, now()) : pauseTimer(a.focus, now(), 'user')
  set({ sleptDuringFocus: false, recovered: false })
  void persist({ ...a, focus: f })
}

/** Called a few times a second by the Focus screen. */
export function focusTick(): void {
  const a = get().active
  if (!a || a.phase !== 'focus') return
  if (isDone(a.focus, now())) {
    void completeFocus(false)
    return
  }
  if (a.focus.runningSince !== null && Date.now() - lastSave > SAVE_EVERY_MS) void persist(a)
}

export async function completeFocus(early: boolean): Promise<void> {
  const a = get().active
  if (!a || a.phase !== 'focus') return
  const next = endFocus(a, now(), early)
  await persist(next)
  if (!early) {
    const mins = Math.round(next.focus.accumulatedMs / 60000)
    void api().notify('Focus done', `${mins} minute${mins === 1 ? '' : 's'} focused. Time to move.`)
  }
  go('review')
}

function onPower(e: 'suspend' | 'resume'): void {
  const a = get().active
  if (e === 'suspend' && a && a.phase === 'focus' && a.focus.runningSince !== null) {
    set({ sleptDuringFocus: true })
    void persist({ ...a, focus: pauseTimer(a.focus, now(), 'sleep') })
  }
}

// ---------------------------------------------------------------- review → move

export async function answer(result: Exclude<TaskResult, null>): Promise<void> {
  const a = get().active
  if (!a || a.phase !== 'review') return
  const next = answerTask(a, result)
  await persist(next)
  engine.setExercise(next.move.exerciseId)
  const last = get().settings.lastSetupOkAt
  if (last === null || now() - last > SETUP_VALID_MS) go('setup', 'move')
  else go('move')
}

export async function setupPassed(): Promise<void> {
  await updateSettings({ lastSetupOkAt: now() })
  const back = get().returnTo ?? 'lobby'
  go(back)
}

let readyTimer: number | null = null

function onTally(t: TallyView): void {
  const a = get().active
  if (!a || a.phase !== 'move' || get().screen !== 'move') return
  const move = { ...a.move, cameraCounted: t.cameraCounted, corrections: [...t.corrections] }
  const next = { ...a, move }
  void persist(next)
  if (moveComplete(move) && readyTimer === null) {
    // A short beat so the final count registers before the lock-in.
    readyTimer = window.setTimeout(() => {
      readyTimer = null
      void goReady()
    }, 700)
  }
}

export async function switchExercise(id: string): Promise<void> {
  const a = get().active
  if (!a || a.phase !== 'move') return
  const next: ActiveSession = { ...a, move: { ...a.move, exerciseId: id, cameraCounted: 0, corrections: [] } }
  engine.setExercise(id)
  await persist(next)
}

export async function override(o: Omit<MoveOverride, 'at'>): Promise<void> {
  const a = get().active
  if (!a || a.phase !== 'move') return
  await persist(applyOverride(a, { ...o, at: now() }))
  api().log('session.override', { reason: o.reason, choice: o.choice })
  await goReady()
}

async function goReady(): Promise<void> {
  const a = get().active
  if (!a || a.phase !== 'move') return
  const ready = markReady(a, now())
  await persist(ready)
  const history = await api().saveRecord(toRecord(ready, 'ready', now()))
  set({ history })
  api().log('session.ready', { cameraCounted: ready.move.cameraCounted, corrections: ready.move.corrections.length, override: ready.move.override?.reason ?? null })
  go('ready')
  if (get().settings.sound) playReadyChord()
}

// ---------------------------------------------------------------- ready → play

export function chosenGame(s: Settings = get().settings): Settings['games'][number] | null {
  return s.games.find((g) => g.id === s.routine.gameId) ?? s.games[0] ?? null
}

export async function launch(): Promise<void> {
  const a = get().active
  const game = chosenGame()
  if (!game) {
    go('settings')
    return
  }
  const res = await api().launchGame(game.id, a?.id ?? null)
  if (!res.ok) {
    toast(res.error, 'error')
    return
  }
  set({ history: await api().listHistory() })
  await persist(null)
  go('lobby')
  toast(`Opened ${game.name}. Have a good session.`)
}

export function notNow(): void {
  go('lobby')
}

// ---------------------------------------------------------------- recovery

export function continueActive(): void {
  const a = get().active
  if (!a) return
  set({ recovered: false })
  if (a.phase === 'move') engine.setExercise(a.move.exerciseId, { cameraCounted: a.move.cameraCounted, corrections: a.move.corrections })
  go(a.phase === 'focus' ? 'focus' : a.phase)
}

export async function discardActive(): Promise<void> {
  const a = get().active
  if (!a) return
  if (a.phase !== 'ready' && elapsedMs(a.focus, now()) > 0) {
    const ended = a.focus.endedAt === null ? { ...a, focus: { ...a.focus, ...endFocus(a, now(), true).focus } } : a
    set({ history: await api().saveRecord(toRecord(ended, 'ended_early', now())) })
  }
  set({ recovered: false })
  await persist(null)
}

// ---------------------------------------------------------------- history

export async function logMatch(sessionId: string, result: 'win' | 'loss' | 'draw' | null): Promise<void> {
  set({ history: await api().addMatch(sessionId, { at: now(), result }) })
}

export async function deleteEverything(): Promise<void> {
  const settings = await api().deleteAllData('DELETE')
  set({ settings, history: [], active: null, recovered: false })
  applyMotion(settings)
  go('onboarding')
}

export function exerciseLabel(id: string): string {
  return EXERCISE_NAMES[id] ?? exerciseById(id).name
}

const exported = {
  startFocus, togglePause, completeFocus, answer, setupPassed, switchExercise, override, launch, notNow, continueActive, discardActive,
  logMatch, updateSettings, finishOnboarding, go, now
}
