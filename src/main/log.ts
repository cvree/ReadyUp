import type { ExportPayload, LogEvent, Settings, StartupMetrics, SystemInfo } from '../shared/ipc'

export interface StoredEvent {
  /** ISO timestamp */
  at: string
  type: string
  data: Record<string, unknown>
}

/** In-memory ring buffer of structured diagnostics events. */
export class EventLog {
  private readonly events: StoredEvent[] = []

  constructor(private readonly capacity = 5000) {}

  add(e: LogEvent): void {
    this.events.push({ at: new Date().toISOString(), type: e.type, data: sanitize(e.data) as Record<string, unknown> })
    if (this.events.length > this.capacity) this.events.splice(0, this.events.length - this.capacity)
  }

  all(): StoredEvent[] {
    return [...this.events]
  }
}

const MAX_STRING = 2000

/**
 * Removes anything that could carry image or video data: data/blob URLs and long strings
 * (base64 payloads). Exports are structured numbers and short text only.
 */
export function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 8) return '[depth limit]'
  if (typeof value === 'string') {
    if (/^\s*(data|blob):/i.test(value)) return '[removed: data URL]'
    if (value.length > MAX_STRING) return '[removed: long string]'
    return value
  }
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) return value
  if (Array.isArray(value)) return value.slice(0, 10_000).map((v) => sanitize(v, depth + 1))
  if (typeof value === 'object' && value !== undefined) {
    if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) return '[removed: binary]'
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = sanitize(v, depth + 1)
    return out
  }
  return undefined
}

export interface ExportDocument {
  format: 'ready-up-diagnostics'
  formatVersion: 1
  exportedAt: string
  note: string
  system: SystemInfo
  startup: StartupMetrics
  settings: Settings
  thresholds: Record<string, number>
  metrics: Record<string, number | string | null>
  repEvents: unknown[]
  corrections: unknown[]
  events: StoredEvent[]
  pose?: unknown
}

export function buildExport(args: {
  payload: ExportPayload
  system: SystemInfo
  startup: StartupMetrics
  settings: Settings
  events: StoredEvent[]
}): ExportDocument {
  const { payload } = args
  const doc: ExportDocument = {
    format: 'ready-up-diagnostics',
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    note: 'Contains no video or images. ' + (payload.includePose ? 'Includes recent pose landmarks (numbers only), by your choice.' : 'Pose landmarks not included.'),
    system: args.system,
    startup: args.startup,
    settings: args.settings,
    thresholds: payload.thresholds,
    metrics: payload.metrics,
    repEvents: sanitize(payload.repEvents) as unknown[],
    corrections: sanitize(payload.corrections) as unknown[],
    events: args.events
  }
  if (payload.includePose && payload.pose) doc.pose = payload.pose
  return doc
}
