import { z } from 'zod'
import { DEFAULT_ROUTINE, RoutineSchema } from '@readyup/session'

export { IPC } from './channels'


export const GameSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().trim().min(1).max(60),
  /** A shortcut or program on disk, or a launcher link such as steam://rungameid/… */
  kind: z.enum(['file', 'url']),
  target: z.string().min(1).max(1024)
})
export type Game = z.infer<typeof GameSchema>

const CameraChoice = z.object({ deviceId: z.string().max(512), label: z.string().max(512) }).nullable()

export const SettingsV1Schema = z.object({ version: z.literal(1), camera: CameraChoice, mirror: z.boolean() })

export const SettingsSchema = z.object({
  version: z.literal(2),
  camera: CameraChoice,
  mirror: z.boolean(),
  onboarded: z.boolean(),
  routine: RoutineSchema,
  games: z.array(GameSchema).max(20),
  /** Reduced motion: follow Windows, or force on/off. */
  motion: z.enum(['system', 'reduced', 'full']),
  /** Completion sound. Off by default. */
  sound: z.boolean(),
  /** When the camera setup checks last all passed (epoch ms). */
  lastSetupOkAt: z.number().nullable()
})
export type Settings = z.infer<typeof SettingsSchema>

export const DEFAULT_SETTINGS: Settings = {
  version: 2, camera: null, mirror: true, onboarded: false, routine: { ...DEFAULT_ROUTINE }, games: [], motion: 'system', sound: false, lastSetupOkAt: null
}

/** Upgrades older settings files without losing choices. */
export function migrateSettings(raw: unknown): Settings | null {
  const v2 = SettingsSchema.safeParse(raw)
  if (v2.success) return v2.data
  const v1 = SettingsV1Schema.safeParse(raw)
  if (v1.success) return { ...DEFAULT_SETTINGS, camera: v1.data.camera, mirror: v1.data.mirror }
  return null
}

export const SettingsPatchSchema = SettingsSchema.omit({ version: true }).partial().strict()
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

export interface RuntimeConfig {
  /** Test-only time acceleration for the focus timer. Always 1 in normal use. */
  timeScale: number
  e2e: boolean
}

export type PowerEvent = 'suspend' | 'resume'

export type LaunchResult = { ok: true } | { ok: false; error: string }

export interface PickedShortcut {
  path: string
  suggestedName: string
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
