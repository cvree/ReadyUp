/** Parses `reg query` output. Kept free of Electron imports so it can be unit-tested anywhere. */
export function parseRegQuery(output: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of output.split(/\r?\n/)) {
    const m = /^\s{2,}(\S+)\s+(REG_\w+)\s+(.*)$/.exec(line)
    if (!m) continue
    const [, name, type, raw] = m
    if (!name || !type || raw === undefined) continue
    out[name] = type === 'REG_DWORD' ? String(parseInt(raw.trim(), 16)) : raw.trim()
  }
  return out
}

export interface WindowsVersion {
  osName: string
  osVersion: string | null
  osBuild: string | null
}

/**
 * Windows 11 still reports ProductName "Windows 10 …" in the registry; the build number is the
 * reliable signal (22000 and later is Windows 11).
 */
export function describeWindows(cv: Record<string, string>): WindowsVersion {
  const build = cv.CurrentBuild ?? cv.CurrentBuildNumber ?? null
  const buildNum = build ? parseInt(build, 10) : NaN
  let name = cv.ProductName ?? 'Windows'
  if (!Number.isNaN(buildNum) && buildNum >= 22000) name = name.replace(/^Windows 10\b/, 'Windows 11')
  const osVersion = cv.DisplayVersion ?? cv.ReleaseId ?? null
  const osBuild = build ? (cv.UBR ? `${build}.${cv.UBR}` : build) : null
  return { osName: name, osVersion, osBuild }
}

/** Maps PROCESSOR_ARCHITECTURE values to Node-style names. */
export function normalizeArch(value: string | undefined): string {
  switch ((value ?? '').toUpperCase()) {
    case 'AMD64': return 'x64'
    case 'ARM64': return 'arm64'
    case 'X86': return 'ia32'
    default: return value ? value.toLowerCase() : 'unknown'
  }
}
