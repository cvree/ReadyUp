import type { SessionRecord } from './schemas'

export interface DayCell {
  /** Local date key, YYYY-MM-DD */
  key: string
  /** Short weekday label, e.g. "Mon" */
  label: string
  isToday: boolean
  readyChecks: number
}

const DAY = 86_400_000
const LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function localDayKey(t: number): string {
  const d = new Date(t)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** The last 7 days ending today (local time), with completed ready checks per day. */
export function weekStrip(records: readonly SessionRecord[], now: number): DayCell[] {
  const counts = new Map<string, number>()
  for (const r of records) if (r.status === 'ready') counts.set(localDayKey(r.completedAt), (counts.get(localDayKey(r.completedAt)) ?? 0) + 1)
  const today = localDayKey(now)
  const cells: DayCell[] = []
  for (let i = 6; i >= 0; i--) {
    const t = now - i * DAY
    const key = localDayKey(t)
    cells.push({ key, label: LABELS[new Date(t).getDay()]!, isToday: key === today, readyChecks: counts.get(key) ?? 0 })
  }
  return cells
}

export interface WeekTotals {
  readyChecks: number
  focusMs: number
  /** Camera-counted reps only, by exercise id. Corrections and self-reported reps are excluded. */
  cameraReps: Record<string, number>
  corrections: number
  overrides: number
  gameSessions: number
  matchesLogged: number
}

export function weekTotals(records: readonly SessionRecord[], now: number): WeekTotals {
  const from = now - 7 * DAY
  const t: WeekTotals = { readyChecks: 0, focusMs: 0, cameraReps: {}, corrections: 0, overrides: 0, gameSessions: 0, matchesLogged: 0 }
  for (const r of records) {
    if (r.completedAt < from) continue
    if (r.status === 'ready') t.readyChecks++
    t.focusMs += r.focus.measuredMs
    t.cameraReps[r.move.exerciseId] = (t.cameraReps[r.move.exerciseId] ?? 0) + r.move.cameraCounted
    t.corrections += r.move.corrections.length
    if (r.move.override) t.overrides++
    t.gameSessions += r.launches.filter((l) => l.ok).length
    t.matchesLogged += r.matches.length
  }
  return t
}
