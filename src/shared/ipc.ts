import { z } from 'zod'

export { IPC } from './channels'

export const SettingsSchema = z.object({
  version: z.literal(1),
  camera: z.object({ deviceId: z.string().max(512), label: z.string().max(512) }).nullable(),
  mirror: z.boolean()
})
export type Settings = z.infer<typeof SettingsSchema>

export const DEFAULT_SETTINGS: Settings = { version: 1, camera: null, mirror: true }

export const SettingsPatchSchema = z.object({
  camera: SettingsSchema.shape.camera.optional(),
  mirror: z.boolean().optional()
}).strict()
export type SettingsPatch = z.infer<typeof SettingsPatchSchema>

/** One diagnostics log event. Small and structured; never image data. */
export const LogEventSchema = z.object({
  type: z.string().min(1).max(64),
  data: z.record(z.string(), z.unknown()).default({})
})
export type LogEvent = z.infer<typeof LogEventSchema>

export interface SystemInfo {
  platform: string
  /** e.g. "Windows 11 Home" */
  osName: string
  /** e.g. "24H2" */
  osVersion: string | null
  /** e.g. "26100.2314" */
  osBuild: string | null
  kernel: string
  /** Architecture the app was built for (x64 / arm64). */
  appArch: string
  /** Architecture of the operating system itself. */
  osArch: string
  /** True when an x64 build runs under ARM64 emulation. */
  emulated: boolean
  electron: string
  chrome: string
  node: string
  appVersion: string
  /** Windows' camera consent for desktop apps: granted / denied / restricted / unknown / not-applicable. */
  cameraAccess: string
  gpu: string | null
  /** Where detection came from, so the report never looks more certain than it is. */
  source: string
}

export interface StartupMetrics {
  /** Process start → window ready to show, ms. */
  windowReadyMs: number | null
}

/** What the renderer contributes to an exported log. */
export const ExportPayloadSchema = z.object({
  includePose: z.boolean(),
  thresholds: z.record(z.string(), z.number()),
  metrics: z.record(z.string(), z.union([z.number(), z.string(), z.null()])),
  repEvents: z.array(z.record(z.string(), z.unknown())).max(5000),
  corrections: z.array(z.record(z.string(), z.unknown())).max(5000),
  /** Only present when includePose is true: recent landmark frames, numbers only. */
  pose: z.array(z.object({ t: z.number(), landmarks: z.array(z.array(z.number()).length(4)).length(33).nullable() })).max(900).optional()
})
export type ExportPayload = z.infer<typeof ExportPayloadSchema>

export type ExportResult = { ok: true; path: string; bytes: number } | { ok: false; reason: 'cancelled' | 'error'; message?: string }
