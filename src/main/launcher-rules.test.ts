import { describe, expect, it } from 'vitest'
import { checkFileTarget, checkUrlTarget, nameFromPath } from './launcher-rules'

describe('game shortcut rules', () => {
  it('accepts known launcher links (Steam, Battle.net, Epic)', () => {
    expect(checkUrlTarget('steam://rungameid/2767030')).toEqual({ ok: true, kind: 'url', label: 'Steam' })
    expect(checkUrlTarget('battlenet://Pro')).toEqual({ ok: true, kind: 'url', label: 'Battle.net' })
    expect(checkUrlTarget('com.epicgames.launcher://apps/abc?action=launch&silent=true')).toMatchObject({ ok: true, label: 'Epic Games' })
  })
  it('refuses web links, script schemes and malformed input', () => {
    for (const bad of ['https://example.com', 'file:///C:/evil.bat', 'javascript:alert(1)', 'ms-settings:privacy', 'steam://run game', 'not a url']) {
      expect(checkUrlTarget(bad).ok, bad).toBe(false)
    }
  })
  it('accepts shortcuts and programs, refuses scripts and documents', () => {
    expect(checkFileTarget('C:\\Users\\me\\Desktop\\Overwatch 2.lnk')).toMatchObject({ ok: true, label: 'Shortcut' })
    expect(checkFileTarget('C:\\Games\\Marvel Rivals.url')).toMatchObject({ ok: true })
    expect(checkFileTarget('C:\\Games\\game.EXE')).toMatchObject({ ok: true, label: 'Program' })
    for (const bad of ['C:\\x.bat', 'C:\\x.ps1', 'C:\\x.cmd', 'C:\\notes.txt', 'C:\\x.vbs']) expect(checkFileTarget(bad).ok, bad).toBe(false)
  })
  it('suggests a readable name from the file', () => {
    expect(nameFromPath('C:\\Users\\me\\Desktop\\Overwatch 2.lnk')).toBe('Overwatch 2')
    expect(nameFromPath('/x/Marvel Rivals.url')).toBe('Marvel Rivals')
  })
})
