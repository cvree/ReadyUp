import { create } from 'zustand'
import type { Correction, CounterSnapshot, RepEvent, Thresholds } from '@readyup/exercise'
import { pushUp } from '@readyup/exercise'
import type { ExportResult, StartupMetrics, SystemInfo } from '@shared/ipc'
import type { CameraDevice, CameraState } from '../camera/CameraService'
import type { PoseStatus } from '../pose/PoseClient'

export type SourceKind = 'live' | 'sim'

export interface SimSettings {
  presetId: string
  /** Speed multiplier for the custom movement. */
  tempo: number
  /** Bottom elbow angle for the custom movement, degrees. */
  depth: number
  /** Landmark noise, pixels. */
  noise: number
  /** Dropouts per minute. */
  dropout: number
}

export interface AppState {
  system: SystemInfo | null
  startup: StartupMetrics | null
  source: SourceKind
  camera: CameraState
  devices: CameraDevice[]
  mirror: boolean
  model: PoseStatus
  perf: { fps: number | null; inferenceMs: number | null; latencyMs: number | null; dropped: number }
  snapshot: CounterSnapshot | null
  visibility: number[] | null
  thresholds: Thresholds
  repLog: RepEvent[]
  cameraCounted: number
  corrections: Correction[]
  total: number
  hint: string
  sim: SimSettings
  includePose: boolean
  exportResult: ExportResult | null
  announce: string
}

export const useApp = create<AppState>(() => ({
  system: null,
  startup: null,
  source: 'live',
  camera: { status: 'idle', deviceId: null, label: null, width: null, height: null, frameRate: null, startMs: null, message: null },
  devices: [],
  mirror: true,
  model: { status: 'idle', variant: 'full', delegate: null, loadMs: null, fallbackReason: null, error: null },
  perf: { fps: null, inferenceMs: null, latencyMs: null, dropped: 0 },
  snapshot: null,
  visibility: null,
  thresholds: { ...pushUp.defaultThresholds },
  repLog: [],
  cameraCounted: 0,
  corrections: [],
  total: 0,
  hint: 'Getting ready…',
  sim: { presetId: 'full_normal', tempo: 1, depth: 85, noise: 1, dropout: 0 },
  includePose: false,
  exportResult: null,
  announce: ''
}))
