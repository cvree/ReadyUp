import { LANDMARK_COUNT, type Landmark, type PoseFrame } from '@readyup/pose-types'
import { RepCounter, RepTally, exerciseById, setupChecks, type Correction, type CounterSnapshot, type RepEvent, type Thresholds } from '@readyup/exercise'
import { generate, normalReps, presetById, type Segment } from '@readyup/sim'
import { CameraService, type CameraDevice, type CameraState } from '../camera/CameraService'
import { PoseClient, type PoseResult, type PoseStatus } from '../pose/PoseClient'
import type { ModelVariant } from '../pose/protocol'
import { liveHint } from './hints'
import { useApp, type SimSettings, type SourceKind } from './store'

export interface FrameView {
  frame: PoseFrame
  snap: CounterSnapshot
  thresholds: Thresholds
  source: SourceKind
}

export interface TallyView {
  cameraCounted: number
  corrections: readonly Correction[]
  total: number
  lastEvent: RepEvent | null
}

type Listener = (v: FrameView) => void
type TallyListener = (t: TallyView) => void

const UI_INTERVAL_MS = 100
const POSE_RING = 900 // ~30 s at 30 fps, kept in memory only; exported only if the person asks
const ANALYSIS_WIDTH = 640
const LUMA_INTERVAL_MS = 600
const SLOW_FPS = 15
const SLOW_FPS_AFTER_MS = 6000

function toFrame(r: PoseResult): PoseFrame {
  let landmarks: Landmark[] | null = null
  if (r.landmarks) {
    landmarks = new Array(LANDMARK_COUNT)
    for (let i = 0; i < LANDMARK_COUNT; i++) {
      landmarks[i] = { x: r.landmarks[i * 4]!, y: r.landmarks[i * 4 + 1]!, z: r.landmarks[i * 4 + 2]!, visibility: r.landmarks[i * 4 + 3]! }
    }
  }
  return { t: r.t, width: r.width, height: r.height, landmarks }
}

/**
 * Wires input (camera or simulation) → pose → counter → UI. The camera only runs while a camera
 * screen is mounted (setup, move, diagnostics); the model can be warmed up in the background.
 */
export class Engine {
  counter = new RepCounter(exerciseById('push_up'))
  readonly tally = new RepTally()
  private camera: CameraService | null = null
  private readonly pose: PoseClient
  private video: HTMLVideoElement | null = null
  private listeners = new Set<Listener>()
  private tallyListeners = new Set<TallyListener>()
  private lastUi = 0
  private fps: number | null = null
  private inferenceMs: number | null = null
  private lastResultAt = 0
  private dropped = 0
  private poseRing: Array<{ t: number; landmarks: number[][] | null }> = []
  private simTimer: number | null = null
  private simFrames: PoseFrame[] = []
  private simIndex = 0
  private source: SourceKind = 'live'
  private loopToken = 0
  private capturing = false
  private readonly captureStartedAt = new Map<number, number>()
  private latencyMs: number | null = null
  private lumaCanvas: OffscreenCanvas | null = null
  private lastLumaAt = 0
  private liveSince = 0
  private autoLiteDone = false
  private cameraWanted = false
  private infoLoaded = false

  constructor() {
    this.pose = new PoseClient(
      (r) => this.onPose(r),
      (s) => this.onModel(s),
      (message, count) => {
        if (count <= 3 || count % 100 === 0) window.readyup.log('pose.frame_error', { message: message.slice(0, 300), count })
      }
    )
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  /** Count and correction changes, for the session in progress. */
  onTally(fn: TallyListener): () => void {
    this.tallyListeners.add(fn)
    return () => this.tallyListeners.delete(fn)
  }

  /** System info and startup metrics, for Diagnostics. */
  async loadInfo(): Promise<void> {
    if (this.infoLoaded) return
    this.infoLoaded = true
    const api = window.readyup
    const [settings, startup] = await Promise.all([api.getSettings(), api.getStartupMetrics()])
    useApp.setState({ mirror: settings.mirror, startup })
    void api.getSystemInfo().then((system) => useApp.setState({ system }))
  }

  /** Loads the pose model in the background so Move starts instantly. Safe to call repeatedly. */
  warmModel(): void {
    if (this.pose.status.status === 'idle' || this.pose.status.status === 'error') void this.pose.init('full', 'auto')
  }

  // ---------- camera lifecycle ----------

  /** A camera screen mounted its video element: show the stream there and start the camera. */
  async attach(video: HTMLVideoElement): Promise<void> {
    this.video = video
    this.cameraWanted = true
    if (!this.camera) this.camera = new CameraService(video, (s) => this.onCamera(s), (devices) => useApp.setState({ devices }))
    else this.camera.setVideo(video)
    this.warmModel()
    this.startLoop(video)
    if (this.source === 'live' && (this.camera.state.status === 'idle' || this.camera.state.status === 'disconnected' || this.camera.state.status === 'error')) {
      await this.startPreferredCamera()
    }
  }

  /** The camera screen went away: stop the camera so its light turns off. */
  detach(video: HTMLVideoElement): void {
    if (this.video !== video) return
    this.cameraWanted = false
    this.loopToken++
    this.video = null
    this.interrupt()
    this.camera?.stop()
    this.stopSim()
    if (this.source === 'sim') {
      this.source = 'live'
      useApp.setState({ source: 'live' })
    }
  }

  private async startPreferredCamera(): Promise<void> {
    if (!this.camera) return
    await this.camera.refreshDevices()
    const settings = await window.readyup.getSettings()
    useApp.setState({ mirror: settings.mirror })
    if (!this.cameraWanted) return
    const s = await this.camera.start(this.camera.resolvePreferred(settings.camera))
    if (s.status === 'live' && s.deviceId && (!settings.camera || settings.camera.deviceId !== s.deviceId)) {
      await window.readyup.updateSettings({ camera: { deviceId: s.deviceId, label: s.label ?? '' } })
    }
    if (!this.cameraWanted) this.camera.stop()
  }

  private startLoop(video: HTMLVideoElement): void {
    const token = ++this.loopToken
    const tick = (now: number): void => {
      if (token !== this.loopToken) return
      if (this.source === 'live' && this.camera && this.camera.state.status !== 'idle') {
        this.camera.noteFrame()
        if (this.camera.state.status === 'live' && video.videoWidth > 0) {
          this.sampleLuma(video, now)
          if (this.pose.ready) {
            if (this.pose.isBusy || this.capturing) {
              this.dropped++
            } else {
              // One frame in flight at a time (capture → worker → result) keeps latency low.
              this.capturing = true
              this.captureStartedAt.set(now, performance.now())
              const h = Math.round((ANALYSIS_WIDTH * video.videoHeight) / video.videoWidth)
              createImageBitmap(video, { resizeWidth: ANALYSIS_WIDTH, resizeHeight: h, resizeQuality: 'low' })
                .then((bmp) => {
                  if (!this.pose.submit(bmp, now)) this.captureStartedAt.delete(now)
                })
                .catch(() => this.captureStartedAt.delete(now))
                .finally(() => {
                  this.capturing = false
                })
            }
          }
        }
      }
      video.requestVideoFrameCallback(tick)
    }
    video.requestVideoFrameCallback(tick)
  }

  /** Mean brightness from a tiny downscaled copy of the frame. Pixels are read and discarded. */
  private sampleLuma(video: HTMLVideoElement, now: number): void {
    if (now - this.lastLumaAt < LUMA_INTERVAL_MS) return
    this.lastLumaAt = now
    try {
      this.lumaCanvas ??= new OffscreenCanvas(32, 18)
      const ctx = this.lumaCanvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) return
      ctx.drawImage(video, 0, 0, 32, 18)
      const d = ctx.getImageData(0, 0, 32, 18).data
      let sum = 0
      for (let i = 0; i < d.length; i += 4) sum += 0.2126 * d[i]! + 0.7152 * d[i + 1]! + 0.0722 * d[i + 2]!
      useApp.setState({ luma: sum / (d.length / 4) })
    } catch {
      /* brightness is a hint only */
    }
  }

  private onPose(r: PoseResult): void {
    const now = performance.now()
    if (this.lastResultAt) {
      const inst = 1000 / Math.max(1, now - this.lastResultAt)
      this.fps = this.fps === null ? inst : this.fps * 0.9 + inst * 0.1
    }
    this.lastResultAt = now
    this.inferenceMs = this.inferenceMs === null ? r.inferenceMs : this.inferenceMs * 0.9 + r.inferenceMs * 0.1
    const started = this.captureStartedAt.get(r.t)
    if (started !== undefined) {
      this.captureStartedAt.delete(r.t)
      const lat = now - started
      this.latencyMs = this.latencyMs === null ? lat : this.latencyMs * 0.9 + lat * 0.1
    }
    if (this.captureStartedAt.size > 10) this.captureStartedAt.clear()
    this.maybeSwitchToLite(now)
    if (this.source !== 'live') return
    this.process(toFrame(r))
  }

  /** If tracking stays below 15 fps on the full model, switch to the lite model once. */
  private maybeSwitchToLite(now: number): void {
    if (this.autoLiteDone || this.pose.status.variant !== 'full' || !this.liveSince || this.fps === null) return
    if (now - this.liveSince > SLOW_FPS_AFTER_MS && this.fps < SLOW_FPS) {
      this.autoLiteDone = true
      window.readyup.log('model.auto_lite', { fps: Math.round(this.fps) })
      this.interrupt()
      void this.pose.init('lite', 'auto')
    }
  }

  // ---------- input: simulation ----------

  private buildSimFrames(sim: SimSettings): PoseFrame[] {
    if (sim.presetId !== 'custom') {
      const p = presetById(sim.presetId)
      if (p) return generate(p.segments, { seed: Math.floor(Math.random() * 1e6), ...p.options })
    }
    const k = 1 / Math.max(0.25, sim.tempo)
    const reps = normalReps({ bottomDeg: sim.depth, descendMs: 700 * k, ascendMs: 700 * k, holdTopMs: 300 * k, holdBottomMs: 100 * k })
    const segs: Segment[] = [{ kind: 'hold', pose: 'plank', deg: 170, durationMs: 1000 }, reps]
    const total = 1000 + 10 * (reps.holdTopMs + reps.descendMs + reps.holdBottomMs + reps.ascendMs)
    const dropouts: Array<{ startMs: number; durationMs: number }> = []
    const n = Math.round((sim.dropout * total) / 60000)
    for (let i = 0; i < n; i++) dropouts.push({ startMs: 1000 + Math.random() * (total - 1500), durationMs: 200 + Math.random() * 600 })
    return generate(segs, { seed: Math.floor(Math.random() * 1e6), noisePx: sim.noise, dropouts })
  }

  private startSim(): void {
    this.stopSim()
    this.simFrames = this.buildSimFrames(useApp.getState().sim)
    this.simIndex = 0
    let offset = performance.now()
    this.simTimer = window.setInterval(() => {
      const f = this.simFrames[this.simIndex]
      if (!f) {
        this.simFrames = this.buildSimFrames(useApp.getState().sim)
        this.simIndex = 0
        offset = performance.now()
        return
      }
      this.simIndex++
      this.process({ ...f, t: offset + f.t })
    }, 1000 / 30)
  }

  private stopSim(): void {
    if (this.simTimer !== null) window.clearInterval(this.simTimer)
    this.simTimer = null
  }

  // ---------- processing ----------

  private process(frame: PoseFrame): void {
    const before = this.tally.cameraCounted
    const snap = this.counter.update(frame)
    this.tally.setCameraCounted(this.baseCount + snap.count)
    this.poseRing.push({ t: frame.t, landmarks: frame.landmarks ? frame.landmarks.map((l) => [l.x, l.y, l.z, l.visibility]) : null })
    if (this.poseRing.length > POSE_RING) this.poseRing.shift()
    const thresholds = this.counter.thresholds
    for (const l of this.listeners) l({ frame, snap, thresholds, source: this.source })
    if (snap.events.length) this.recordEvents(snap.events)
    if (this.tally.cameraCounted !== before || snap.events.length) this.emitTally(snap.events[snap.events.length - 1] ?? null)
    const now = performance.now()
    if (snap.events.length || now - this.lastUi > UI_INTERVAL_MS) {
      this.lastUi = now
      const st = useApp.getState()
      useApp.setState({
        snapshot: snap,
        visibility: frame.landmarks ? frame.landmarks.map((l) => l.visibility) : null,
        setup: setupChecks({ frame, def: this.counter.exercise, luma: this.source === 'live' ? st.luma : null, minVisibility: thresholds.minVisibility }),
        cameraCounted: this.tally.cameraCounted,
        total: this.tally.total,
        perf: {
          fps: this.source === 'live' ? this.fps : 30,
          inferenceMs: this.source === 'live' ? this.inferenceMs : null,
          latencyMs: this.source === 'live' ? this.latencyMs : null,
          dropped: this.dropped
        },
        hint: liveHint(snap, this.counter.exercise, thresholds)
      })
    }
  }

  private emitTally(lastEvent: RepEvent | null): void {
    const view: TallyView = { cameraCounted: this.tally.cameraCounted, corrections: this.tally.corrections, total: this.tally.total, lastEvent }
    for (const l of this.tallyListeners) l(view)
  }

  private recordEvents(events: RepEvent[]): void {
    const log = [...events].reverse().concat(useApp.getState().repLog).slice(0, 300)
    const last = events[events.length - 1]!
    const unit = this.counter.exercise.copy.unit
    useApp.setState({
      repLog: log,
      announce: last.outcome === 'counted' ? `${this.tally.cameraCounted} ${unit}` : `Not counted. ${last.message}`
    })
    for (const e of events) {
      window.readyup.log('rep', {
        exercise: this.counter.exercise.id, outcome: e.outcome, reason: e.reason, count: e.count, minAngle: round(e.metrics.minAngle),
        maxAngle: round(e.metrics.maxAngle), durationMs: Math.round(e.metrics.durationMs), side: e.metrics.side,
        meanVisibility: round(e.metrics.meanVisibility, 2), source: this.source
      })
    }
  }

  private interrupt(): void {
    const ev = this.counter.interrupt(performance.now())
    if (ev) {
      this.recordEvents([ev])
      this.emitTally(ev)
    }
  }

  // ---------- state from services ----------

  private onCamera(s: CameraState): void {
    useApp.setState({ camera: s })
    if (s.status === 'live') this.liveSince = performance.now()
    window.readyup.log('camera.state', { status: s.status, width: s.width, height: s.height, frameRate: s.frameRate, startMs: s.startMs })
    if (s.status === 'disconnected' || s.status === 'stalled') this.interrupt()
  }

  private onModel(s: PoseStatus): void {
    useApp.setState({ model: s })
    window.readyup.log('model.state', { status: s.status, variant: s.variant, delegate: s.delegate, loadMs: s.loadMs, fallbackReason: s.fallbackReason })
  }

  // ---------- actions ----------

  /** Starts a fresh count for an exercise (used at the start of each Move phase). */
  setExercise(id: string, restore?: { cameraCounted: number; corrections: readonly Correction[] }): void {
    const def = exerciseById(id)
    this.counter = new RepCounter(def)
    this.tally.reset()
    if (restore) {
      // After a restart, reps already counted by the camera carry over.
      this.tally.setCameraCounted(restore.cameraCounted)
      for (const c of restore.corrections) this.tally.correct(c.delta, c.t)
      this.baseCount = restore.cameraCounted
    } else {
      this.baseCount = 0
    }
    useApp.setState({ exerciseId: def.id, thresholds: this.counter.thresholds, repLog: [], cameraCounted: this.tally.cameraCounted, corrections: [...this.tally.corrections], total: this.tally.total, snapshot: null })
  }

  /** Reps counted before a restart, added to the counter's own count. */
  private baseCount = 0

  async selectCamera(deviceId: string): Promise<void> {
    if (!this.camera) return
    const device: CameraDevice | undefined = useApp.getState().devices.find((d) => d.deviceId === deviceId)
    if (!device) return
    this.interrupt()
    const s = await this.camera.start(device)
    if (s.status === 'live' && s.deviceId) await window.readyup.updateSettings({ camera: { deviceId: s.deviceId, label: s.label ?? device.label } })
  }

  async retryCamera(): Promise<void> {
    if (!this.camera) return
    await this.startPreferredCamera()
  }

  simulateDisconnect(): void {
    this.camera?.simulateDisconnect()
  }

  async setMirror(mirror: boolean): Promise<void> {
    useApp.setState({ mirror })
    await window.readyup.updateSettings({ mirror })
  }

  async setModel(variant: ModelVariant): Promise<void> {
    this.interrupt()
    this.autoLiteDone = true
    await this.pose.init(variant, 'auto')
  }

  async setSource(source: SourceKind): Promise<void> {
    if (source === this.source) return
    this.interrupt()
    this.source = source
    useApp.setState({ source, snapshot: null })
    window.readyup.log('source.changed', { source })
    if (source === 'sim') {
      this.camera?.stop()
      this.startSim()
    } else {
      this.stopSim()
      if (this.cameraWanted) await this.startPreferredCamera()
    }
  }

  updateSim(patch: Partial<SimSettings>): void {
    useApp.setState({ sim: { ...useApp.getState().sim, ...patch } })
    if (this.source === 'sim') {
      this.interrupt()
      this.startSim()
    }
  }

  setThresholds(patch: Partial<Thresholds>): void {
    this.counter.setThresholds(patch)
    useApp.setState({ thresholds: this.counter.thresholds })
    window.readyup.log('thresholds.changed', patch as Record<string, unknown>)
  }

  resetThresholds(): void {
    this.counter.resetThresholds()
    useApp.setState({ thresholds: this.counter.thresholds })
    window.readyup.log('thresholds.reset', {})
  }

  correct(delta: 1 | -1): void {
    if (!this.tally.correct(delta, Date.now())) return
    useApp.setState({ corrections: [...this.tally.corrections], total: this.tally.total, announce: `Manual correction ${delta > 0 ? 'plus' : 'minus'} one. Total ${this.tally.total}.` })
    window.readyup.log('correction', { delta, cameraCounted: this.tally.cameraCounted, total: this.tally.total })
    this.emitTally(null)
  }

  resetSession(): void {
    this.counter.reset()
    this.tally.reset()
    this.baseCount = 0
    this.poseRing = []
    useApp.setState({ repLog: [], corrections: [], cameraCounted: 0, total: 0, snapshot: null, announce: 'Session reset' })
    window.readyup.log('session.reset', {})
    this.emitTally(null)
  }

  async exportLog(): Promise<void> {
    const st = useApp.getState()
    const res = await window.readyup.exportLog({
      includePose: st.includePose,
      thresholds: { ...st.thresholds },
      metrics: {
        fps: st.perf.fps === null ? null : round(st.perf.fps, 1),
        inferenceMs: st.perf.inferenceMs === null ? null : round(st.perf.inferenceMs, 1),
        latencyMs: st.perf.latencyMs === null ? null : round(st.perf.latencyMs, 1),
        droppedFrames: st.perf.dropped,
        cameraStartMs: st.camera.startMs,
        modelLoadMs: st.model.loadMs === null ? null : Math.round(st.model.loadMs),
        modelVariant: st.model.variant,
        delegate: st.model.delegate,
        cameraStatus: st.camera.status,
        cameraResolution: st.camera.width && st.camera.height ? `${st.camera.width}x${st.camera.height}` : null,
        source: st.source,
        exercise: st.exerciseId,
        cameraCounted: st.cameraCounted,
        total: st.total
      },
      repEvents: st.repLog.map((e) => ({ ...e, metrics: { ...e.metrics } })),
      corrections: st.corrections.map((c) => ({ ...c })),
      ...(st.includePose ? { pose: this.poseRing.slice(-POSE_RING) } : {})
    })
    useApp.setState({ exportResult: res })
  }
}

function round(n: number, digits = 0): number {
  const k = 10 ** digits
  return Number.isFinite(n) ? Math.round(n * k) / k : NaN
}

export const engine = new Engine()
