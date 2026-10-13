import { describe, expect, it } from 'vitest'
import { describeWindows, normalizeArch, parseRegQuery } from './windows-info'

const WIN11 = `
HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion
    SystemRoot    REG_SZ    C:\\WINDOWS
    CurrentBuild    REG_SZ    26100
    CurrentBuildNumber    REG_SZ    26100
    DisplayVersion    REG_SZ    24H2
    EditionID    REG_SZ    Core
    ProductName    REG_SZ    Windows 10 Home
    UBR    REG_DWORD    0x90e
`

describe('Windows version detection', () => {
  it('parses reg query output, including DWORD values', () => {
    const cv = parseRegQuery(WIN11)
    expect(cv.DisplayVersion).toBe('24H2')
    expect(cv.UBR).toBe('2318')
  })
  it('reports Windows 11 from the build number even though the registry says Windows 10', () => {
    expect(describeWindows(parseRegQuery(WIN11))).toEqual({ osName: 'Windows 11 Home', osVersion: '24H2', osBuild: '26100.2318' })
  })
  it('keeps Windows 10 for builds below 22000', () => {
    const cv = parseRegQuery(WIN11.replace(/26100/g, '19045').replace('24H2', '22H2'))
    expect(describeWindows(cv)).toEqual({ osName: 'Windows 10 Home', osVersion: '22H2', osBuild: '19045.2318' })
  })
  it('normalizes processor architecture names', () => {
    expect(normalizeArch('AMD64')).toBe('x64')
    expect(normalizeArch('ARM64')).toBe('arm64')
    expect(normalizeArch(undefined)).toBe('unknown')
  })
})
