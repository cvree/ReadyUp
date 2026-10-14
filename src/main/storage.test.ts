import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DEFAULT_ROUTINE, answerTask, endFocus, markReady, newSession, toRecord } from '@readyup/session'
import { ActiveSessionStore, HistoryStore, SettingsStore } from './storage'

const dir = (): string => mkdtempSync(join(tmpdir(), 'readyup-store-'))
const T0 = Date.UTC(2026, 9, 14, 9)

describe('settings storage', () => {
  it('starts from defaults and persists updates across instances', () => {
    const d = dir()
    const a = new SettingsStore(d)
    expect(a.get().onboarded).toBe(false)
    expect(a.get().routine).toEqual({ focusMinutes: 25, exerciseId: 'push_up', reps: 10, gameId: null })
    a.update({ camera: { deviceId: 'abc', label: 'USB Camera' }, mirror: false, onboarded: true })
    const b = new SettingsStore(d).get()
    expect(b.camera).toEqual({ deviceId: 'abc', label: 'USB Camera' })
    expect(b.onboarded).toBe(true)
    expect(readdirSync(d).filter((f) => f.endsWith('.tmp'))).toEqual([])
  })
  it('migrates milestone 1 settings without losing the camera choice', () => {
    const d = dir()
    writeFileSync(join(d, 'settings.json'), JSON.stringify({ version: 1, camera: { deviceId: 'x', label: 'Cam' }, mirror: false }))
    const s = new SettingsStore(d).get()
    expect(s.version).toBe(2)
    expect(s.camera?.label).toBe('Cam')
    expect(s.mirror).toBe(false)
    expect(JSON.parse(readFileSync(join(d, 'settings.json'), 'utf8')).version).toBe(2)
  })
  it('recovers from a corrupted file, keeping a copy and warning', () => {
    const d = dir()
    writeFileSync(join(d, 'settings.json'), '{ not json')
    const warnings: string[] = []
    const s = new SettingsStore(d, (w) => warnings.push(w))
    expect(s.get().camera).toBeNull()
    expect(warnings).toHaveLength(1)
    expect(readdirSync(d).some((f) => f.startsWith('settings.json.corrupt-'))).toBe(true)
  })
  it('rejects unknown or invalid fields and bad games', () => {
    const s = new SettingsStore(dir())
    expect(() => s.update({ mirror: 'yes' } as never)).toThrow()
    expect(() => s.update({ evil: true } as never)).toThrow()
    expect(() => s.update({ games: [{ id: 'g', name: '', kind: 'url', target: 'x' }] })).toThrow()
  })
})

describe('history storage', () => {
  const record = (id: string) => toRecord(markReady(answerTask(endFocus(newSession(DEFAULT_ROUTINE, 'Study', T0, id), T0 + 1000, false), 'done'), T0 + 2000), 'ready', T0 + 2000)
  it('adds sessions without duplicates and survives restarts', () => {
    const d = dir()
    const h = new HistoryStore(d)
    h.add(record('a'))
    h.add(record('a'))
    h.add(record('b'))
    expect(new HistoryStore(d).list().map((s) => s.id)).toEqual(['a', 'b'])
  })
  it('records launches and manually logged matches separately', () => {
    const d = dir()
    const h = new HistoryStore(d)
    h.add(record('a'))
    h.addLaunch('a', { at: 1, gameId: 'g', gameName: 'Overwatch 2', ok: true })
    h.addMatch('a', { at: 2, result: 'win' })
    const s = new HistoryStore(d).list()[0]!
    expect(s.launches).toHaveLength(1)
    expect(s.matches).toEqual([{ at: 2, result: 'win' }])
    // Re-saving the session (e.g. after a restart) keeps its launches and matches.
    h.add(record('a'))
    expect(new HistoryStore(d).list()[0]!.matches).toHaveLength(1)
  })
  it('sets aside an unreadable history file instead of deleting it', () => {
    const d = dir()
    writeFileSync(join(d, 'history.json'), '{"version":1,"sessions":[{"bad":true}]}')
    const warnings: string[] = []
    expect(new HistoryStore(d, (w) => warnings.push(w)).list()).toEqual([])
    expect(warnings).toHaveLength(1)
    expect(readdirSync(d).some((f) => f.startsWith('history.json.corrupt-'))).toBe(true)
  })
})

describe('active session storage', () => {
  it('saves, loads and clears', () => {
    const d = dir()
    const s = new ActiveSessionStore(d)
    expect(s.load()).toBeNull()
    s.save({ ...newSession(DEFAULT_ROUTINE, 'x', T0, 'id'), savedAt: T0 })
    expect(s.load()?.id).toBe('id')
    s.clear()
    expect(existsSync(join(d, 'active-session.json'))).toBe(false)
  })
  it('after a crash, a running timer is recovered paused at its last save', () => {
    const d = dir()
    const s = new ActiveSessionStore(d)
    s.save({ ...newSession(DEFAULT_ROUTINE, 'x', T0, 'id'), savedAt: T0 + 5 * 60_000 })
    const loaded = s.load()!
    expect(loaded.focus.runningSince).toBeNull()
    expect(loaded.focus.accumulatedMs).toBe(5 * 60_000)
  })
  it('a clean quit pauses the timer at the moment of quitting', () => {
    const d = dir()
    const s = new ActiveSessionStore(d)
    s.save({ ...newSession(DEFAULT_ROUTINE, 'x', T0, 'id'), savedAt: T0 + 60_000 })
    s.pauseForQuit(T0 + 90_000)
    const loaded = s.load()!
    expect(loaded.focus.accumulatedMs).toBe(90_000)
    expect(loaded.focus.pauses.at(-1)?.reason).toBe('quit')
  })
})
