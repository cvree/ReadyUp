import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  ActiveSessionSchema, HistorySchema, LaunchSchema, MatchSchema, SessionRecordSchema, recoverSession, pauseTimer,
  type ActiveSession, type History, type SessionRecord
} from '@readyup/session'
import { DEFAULT_SETTINGS, SettingsPatchSchema, SettingsSchema, migrateSettings, type Settings, type SettingsPatch } from '../shared/ipc'

/**
 * Writes via a temp file and rename, so a crash mid-write never leaves a half-written file.
 * Windows can briefly lock files (antivirus, indexer), so the rename is retried.
 */
export function writeFileAtomic(path: string, data: string): void {
  const tmp = `${path}.${process.pid}.tmp`
  writeFileSync(tmp, data, 'utf8')
  let lastError: unknown
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      renameSync(tmp, path)
      return
    } catch (e) {
      lastError = e
      const end = Date.now() + 20 * (attempt + 1)
      while (Date.now() < end) { /* brief synchronous back-off */ }
    }
  }
  throw lastError
}

/** Reads JSON; an unreadable file is kept aside (never deleted) and reported. */
function readJson(path: string, onWarning: (m: string) => void): unknown {
  if (!existsSync(path)) return undefined
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (e) {
    quarantine(path, onWarning, (e as Error).message)
    return undefined
  }
}

function quarantine(path: string, onWarning: (m: string) => void, why: string): void {
  const backup = `${path}.corrupt-${Date.now()}`
  try { renameSync(path, backup) } catch { /* ignore */ }
  onWarning(`${path.split(/[\\/]/).pop()} was unreadable and was set aside as ${backup.split(/[\\/]/).pop()}: ${why}`)
}

export class SettingsStore {
  private readonly path: string
  private current: Settings

  constructor(dir: string, private readonly onWarning: (message: string) => void = () => {}) {
    mkdirSync(dir, { recursive: true })
    this.path = join(dir, 'settings.json')
    this.current = this.load()
  }

  get(): Settings {
    return structuredClone(this.current)
  }

  update(patch: SettingsPatch): Settings {
    const valid = SettingsPatchSchema.parse(patch)
    this.current = SettingsSchema.parse({ ...this.current, ...valid })
    writeFileAtomic(this.path, JSON.stringify(this.current, null, 2))
    return this.get()
  }

  reset(): Settings {
    this.current = structuredClone(DEFAULT_SETTINGS)
    if (existsSync(this.path)) rmSync(this.path)
    return this.get()
  }

  private load(): Settings {
    const raw = readJson(this.path, this.onWarning)
    if (raw === undefined) return structuredClone(DEFAULT_SETTINGS)
    const migrated = migrateSettings(raw)
    if (!migrated) {
      quarantine(this.path, this.onWarning, 'unrecognised format')
      return structuredClone(DEFAULT_SETTINGS)
    }
    if ((raw as { version?: number }).version !== migrated.version) writeFileAtomic(this.path, JSON.stringify(migrated, null, 2))
    return migrated
  }
}

const MAX_SESSIONS = 5000

/** Completed sessions. Small JSON file; behind this interface so it can move to SQLite later. */
export class HistoryStore {
  private readonly path: string
  private data: History

  constructor(dir: string, private readonly onWarning: (message: string) => void = () => {}) {
    mkdirSync(dir, { recursive: true })
    this.path = join(dir, 'history.json')
    const raw = readJson(this.path, onWarning)
    const parsed = raw === undefined ? null : HistorySchema.safeParse(raw)
    if (parsed && !parsed.success) quarantine(this.path, onWarning, 'unrecognised format')
    this.data = parsed && parsed.success ? parsed.data : { version: 1, sessions: [] }
  }

  list(): SessionRecord[] {
    return structuredClone(this.data.sessions)
  }

  /** Adds or replaces (by id), so retries after a restart never create duplicates. */
  add(record: SessionRecord): SessionRecord[] {
    const r = SessionRecordSchema.parse(record)
    const i = this.data.sessions.findIndex((s) => s.id === r.id)
    if (i >= 0) this.data.sessions[i] = { ...r, launches: this.data.sessions[i]!.launches, matches: this.data.sessions[i]!.matches }
    else this.data.sessions.push(r)
    if (this.data.sessions.length > MAX_SESSIONS) this.data.sessions.splice(0, this.data.sessions.length - MAX_SESSIONS)
    this.save()
    return this.list()
  }

  addLaunch(id: string, launch: unknown): void {
    const l = LaunchSchema.parse(launch)
    const s = this.data.sessions.find((x) => x.id === id)
    if (!s) return
    s.launches.push(l)
    this.save()
  }

  addMatch(id: string, match: unknown): SessionRecord[] {
    const m = MatchSchema.parse(match)
    const s = this.data.sessions.find((x) => x.id === id)
    if (s) {
      s.matches.push(m)
      this.save()
    }
    return this.list()
  }

  exportJson(): string {
    return JSON.stringify(this.data, null, 2)
  }

  clear(): void {
    this.data = { version: 1, sessions: [] }
    if (existsSync(this.path)) rmSync(this.path)
  }

  private save(): void {
    writeFileAtomic(this.path, JSON.stringify(this.data, null, 2))
  }
}

/** The session in progress, saved often so a restart or crash can resume it honestly. */
export class ActiveSessionStore {
  private readonly path: string

  constructor(dir: string, private readonly onWarning: (message: string) => void = () => {}) {
    mkdirSync(dir, { recursive: true })
    this.path = join(dir, 'active-session.json')
  }

  /** Loads the snapshot. A timer that was still running (crash) only counts time up to its last save. */
  load(): ActiveSession | null {
    const raw = readJson(this.path, this.onWarning)
    if (raw === undefined) return null
    const parsed = ActiveSessionSchema.safeParse(raw)
    if (!parsed.success) {
      quarantine(this.path, this.onWarning, 'unrecognised format')
      return null
    }
    const recovered = recoverSession(parsed.data)
    // Persist the recovery so a second crash can't count the same stretch twice.
    if (recovered !== parsed.data && recovered.focus.runningSince !== parsed.data.focus.runningSince) {
      writeFileAtomic(this.path, JSON.stringify(recovered))
    }
    return recovered
  }

  save(active: unknown): void {
    const a = ActiveSessionSchema.parse(active)
    writeFileAtomic(this.path, JSON.stringify(a))
  }

  /** On a clean quit, pause a running focus timer at the moment of quitting. */
  pauseForQuit(now: number): void {
    const raw = readJson(this.path, this.onWarning)
    const parsed = raw === undefined ? null : ActiveSessionSchema.safeParse(raw)
    if (!parsed || !parsed.success) return
    const a = parsed.data
    if (a.phase === 'focus' && a.focus.runningSince !== null) {
      writeFileAtomic(this.path, JSON.stringify({ ...a, focus: pauseTimer(a.focus, now, 'quit'), savedAt: now }))
    }
  }

  clear(): void {
    if (existsSync(this.path)) rmSync(this.path)
  }
}
