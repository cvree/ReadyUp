import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { DEFAULT_SETTINGS, SettingsPatchSchema, SettingsSchema, type Settings, type SettingsPatch } from '../shared/ipc'

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

  private load(): Settings {
    if (!existsSync(this.path)) return structuredClone(DEFAULT_SETTINGS)
    try {
      return SettingsSchema.parse(JSON.parse(readFileSync(this.path, 'utf8')))
    } catch (e) {
      // Keep the unreadable file for inspection, then start from defaults.
      const backup = `${this.path}.corrupt-${Date.now()}`
      try { renameSync(this.path, backup) } catch { /* ignore */ }
      this.onWarning(`Settings file was unreadable and was reset (kept a copy at ${backup}): ${(e as Error).message}`)
      return structuredClone(DEFAULT_SETTINGS)
    }
  }
}
