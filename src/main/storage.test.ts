import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { SettingsStore } from './storage'

const dir = (): string => mkdtempSync(join(tmpdir(), 'readyup-settings-'))

describe('settings storage', () => {
  it('starts from defaults and persists updates across instances', () => {
    const d = dir()
    const a = new SettingsStore(d)
    expect(a.get().camera).toBeNull()
    a.update({ camera: { deviceId: 'abc', label: 'USB Camera' }, mirror: false })
    const b = new SettingsStore(d)
    expect(b.get()).toEqual({ version: 1, camera: { deviceId: 'abc', label: 'USB Camera' }, mirror: false })
    expect(readdirSync(d).filter((f) => f.endsWith('.tmp'))).toEqual([])
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
  it('rejects unknown or invalid fields', () => {
    const s = new SettingsStore(dir())
    expect(() => s.update({ mirror: 'yes' } as never)).toThrow()
    expect(() => s.update({ evil: true } as never)).toThrow()
  })
  it('writes valid JSON', () => {
    const d = dir()
    new SettingsStore(d).update({ mirror: false })
    expect(existsSync(join(d, 'settings.json'))).toBe(true)
    expect(JSON.parse(readFileSync(join(d, 'settings.json'), 'utf8')).mirror).toBe(false)
  })
})
