import type { ExportPayload, ExportResult, Settings, SettingsPatch, StartupMetrics, SystemInfo } from '../shared/ipc'

export interface ReadyUpApi {
  getSystemInfo(): Promise<SystemInfo>
  getStartupMetrics(): Promise<StartupMetrics>
  getSettings(): Promise<Settings>
  updateSettings(patch: SettingsPatch): Promise<Settings>
  log(type: string, data?: Record<string, unknown>): void
  exportLog(payload: ExportPayload): Promise<ExportResult>
  /** Opens the operating system's camera privacy settings. Returns false where unsupported. */
  openCameraSettings(): Promise<boolean>
}
