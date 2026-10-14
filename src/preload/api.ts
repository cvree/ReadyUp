import type { ActiveSession, SessionRecord } from '@readyup/session'
import type {
  ExportPayload, ExportResult, Game, LaunchResult, PickedShortcut, PowerEvent, RuntimeConfig, Settings, SettingsPatch, StartupMetrics, SystemInfo
} from '../shared/ipc'

export interface ReadyUpApi {
  getSystemInfo(): Promise<SystemInfo>
  getStartupMetrics(): Promise<StartupMetrics>
  getRuntimeConfig(): Promise<RuntimeConfig>
  getSettings(): Promise<Settings>
  updateSettings(patch: SettingsPatch): Promise<Settings>
  log(type: string, data?: Record<string, unknown>): void
  exportLog(payload: ExportPayload): Promise<ExportResult>
  /** Opens the operating system's camera privacy settings. Returns false where unsupported. */
  openCameraSettings(): Promise<boolean>
  notify(title: string, body: string): Promise<boolean>
  /** Subscribes to system sleep and wake. Returns an unsubscribe function. */
  onPower(cb: (e: PowerEvent) => void): () => void

  listHistory(): Promise<SessionRecord[]>
  saveRecord(record: SessionRecord): Promise<SessionRecord[]>
  addMatch(sessionId: string, match: { at: number; result: 'win' | 'loss' | 'draw' | null; note?: string }): Promise<SessionRecord[]>
  exportHistory(): Promise<ExportResult>
  /** Deletes history, the active session and settings. Requires the literal string "DELETE". */
  deleteAllData(confirm: 'DELETE'): Promise<Settings>

  loadActiveSession(): Promise<ActiveSession | null>
  saveActiveSession(session: ActiveSession): Promise<void>
  clearActiveSession(): Promise<void>

  pickShortcut(): Promise<PickedShortcut | null>
  validateGame(game: Game): Promise<LaunchResult>
  launchGame(gameId: string, sessionId: string | null): Promise<LaunchResult>
}
