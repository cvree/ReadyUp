import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '../shared/ipc'
import { EventLog, buildExport, sanitize } from './log'

const system = {
  platform: 'win32', osName: 'Windows 11 Home', osVersion: '24H2', osBuild: '26100.1', kernel: '10.0.26100', appArch: 'x64',
  osArch: 'x64', emulated: false, electron: '44', chrome: '1', node: '22', appVersion: '0.1.0', cameraAccess: 'granted', gpu: null, source: 'test'
}

describe('diagnostics export', () => {
  it('strips data URLs, long strings and binary', () => {
    expect(sanitize({ a: 'data:image/png;base64,AAAA', b: 'x'.repeat(5000), c: new Uint8Array(4), d: 'ok', e: 3 })).toEqual({
      a: '[removed: data URL]', b: '[removed: long string]', c: '[removed: binary]', d: 'ok', e: 3
    })
  })
  it('caps the ring buffer', () => {
    const log = new EventLog(3)
    for (let i = 0; i < 5; i++) log.add({ type: 'tick', data: { i } })
    expect(log.all().map((e) => e.data.i)).toEqual([2, 3, 4])
  })
  it('excludes pose landmarks unless asked, and never contains image data', () => {
    const pose = [{ t: 1, landmarks: Array.from({ length: 33 }, () => [0.5, 0.5, 0, 0.9]) }]
    const base = { thresholds: { top: 150 }, metrics: { fps: 30 }, repEvents: [{ message: 'data:image/jpeg;base64,/9j/' }], corrections: [], pose }
    const without = buildExport({ payload: { ...base, includePose: false }, system, startup: { windowReadyMs: 900 }, settings: DEFAULT_SETTINGS, events: [] })
    expect(without.pose).toBeUndefined()
    const text = JSON.stringify(without)
    expect(text).not.toMatch(/data:image|base64,/)
    const withPose = buildExport({ payload: { ...base, includePose: true }, system, startup: { windowReadyMs: 900 }, settings: DEFAULT_SETTINGS, events: [] })
    expect(withPose.pose).toEqual(pose)
  })
})
