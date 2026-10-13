import { LANDMARK_COUNT, type Landmark, type PoseFrame } from '@readyup/pose-types'
import { RepCounter, RepTally, pushUp, type CounterSnapshot, type RepEvent, type Thresholds } from '@readyup/exercise'
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

type Listener = (v: FrameView) => void

const UI_INTERVAL_MS = 100
const POSE_RING = 900 // ~30 s at 30 fps, only kept in memory; exported only if the person asks
const ANALYSIS_WIDTH = 640

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

/** Wires input (camera or simulation) → pose → counter → UI. Owns no React state. */
export class Engine {
  readonly counter = new RepCounter(pushUp)
  readonly tally = new RepTally()
  private camera: CameraService | null = null
  private readonly pose: PoseClient
  private video: HTMLVideoElement | null = null
  private listeners = new Set<Listener>()
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
  private loopActive = false
  private capturing = false
  private readonly captureStartedAt = new Map<number, number>()
  private latencyMs: number | null = null
  private booted = false

  constructor() {
    this.pose = new PoseClient(
      (r) => this.onPose(r),
      (s) => this.onModel(s),
      (message, count) => {
        // Log the first few and then every 100th, so a persistent failure is visible without flooding.
        if (count <= 3 || count % 100 === 0) window.readyup.log('pose.frame_error', { message: message.slice(0, 300), count })
      }
    )
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  async boot(video: HTMLVideoElement): Promise<void> {
    if (this.booted) return
    this.booted = true
    this.video = video
    const api = window.readyup
    const [settings, startup] = await Promise.all([api.getSettings(), api.getStartupMetrics()])
    useApp.setState({ mirror: settings.mirror, startup })
    void api.getSystemInfo().then((system) => useApp.setState({ system }))

    this.camera = new CameraService(video, (s) => this.onCamera(s), (devices) => useApp.setState({ devices }))
    const modelReady = this.pose.init('full', 'auto')
    await this.camera.refreshDevices()
    const preferred = this.camera.resolvePreferred(settings.camera)
    await this.camera.start(preferred)
    await modelReady
    this.startLoop()
    api.log('engine.booted', { camera: this.camera.state.status, model: this.pose.status.status, delegate: this.pose.status.delegate })
  }

  // ---------- input: live camera ----------

  private startLoop(): void {
    const video = this.video
    if (!video || this.loopActive) return
    this.loopActive = true
    const tick = (now: number): void => {
      if (this.source === 'live' && this.camera?.state.status !== 'idle') {
        this.camera?.noteFrame()
        if (this.camera?.state.status === 'live' && this.pose.ready && video.videoWidth > 0) {
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
      video.requestVideoFrameCallback(tick)
    }
    video.requestVideoFrameCallback(tick)
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
    if (this.source !== 'live') return
    this.process(toFrame(r))
  }

  // ---------- input: simulation ----------

  private buildSimFrames(sim: SimSettings): PoseFrame[] {
    if (sim.presetId !== 'custom') {
      const p = presetById(sim.presetId)
      if (p) return generate(p.segments, { seed: Math.floor(Math.random() * 1e6), ...p.options })
    }
    const k = 1 / Math.max(0.25, sim.tempo)
    const reps = normalReps({ bottomDeg: sim.depth, descendMs: 700 * k, ascendMs: 700 * k, holdTopMs: 300 * k, holdBottomMs: 100 * k })
    const segs: Segment[] = [{ kind: 'hold', pose: 'plank', elbowDeg: 170, durationMs: 1000 }, reps]
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
    const base = performance.now()
    let offset = base
    this.simTimer = window.setInterval(() => {
      const f = this.simFrames[this.simIndex]
      if (!f) {
        // Loop: regenerate so noise differs each pass.
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
    const snap = this.counter.update(frame)
    this.tally.setCameraCounted(snap.count)
    this.poseRing.push({ t: frame.t, landmarks: frame.landmarks ? frame.landmarks.map((l) => [l.x, l.y, l.z, l.visibility]) : null })
    if (this.poseRing.length > POSE_RING) this.poseRing.shift()
    const thresholds = this.counter.thresholds
    for (const l of this.listeners) l({ frame, snap, thresholds, source: this.source })
    if (snap.events.length) this.recordEvents(snap.events)
    const now = performance.now()
    if (snap.events.length || now - this.lastUi > UI_INTERVAL_MS) {
      this.lastUi = now
      useApp.setState({
        snapshot: snap,
        visibility: frame.landmarks ? frame.landmarks.map((l) => l.visibility) : null,
        cameraCounted: this.tally.cameraCounted,
        total: this.tally.total,
        perf: {
          fps: this.source === 'live' ? this.fps : 30,
          inferenceMs: this.source === 'live' ? this.inferenceMs : null,
          latencyMs: this.source === 'live' ? this.latencyMs : null,
          dropped: this.dropped
        },
        hint: liveHint(snap, thresholds)
      })
    }
  }

  private recordEvents(events: RepEvent[]): void {
    const log = [...events].reverse().concat(useApp.getState().repLog).slice(0, 300)
    const last = events[events.length - 1]!
    useApp.setState({
      repLog: log,
      announce: last.outcome === 'counted' ? `Rep ${last.count} counted` : `Not counted: ${last.message}`
    })
    for (const e of events) {
      window.readyup.log('rep', {
        outcome: e.outcome, reason: e.reason, count: e.count, minAngle: round(e.metrics.minAngle), maxAngle: round(e.metrics.maxAngle),
        durationMs: Math.round(e.metrics.durationMs), side: e.metrics.side, meanVisibility: round(e.metrics.meanVisibility, 2), source: this.source
      })
    }
  }

  private interrupt(): void {
    const ev = this.counter.interrupt(performance.now())
    if (ev) this.recordEvents([ev])
  }

  // ---------- state from services ----------

  private onCamera(s: CameraState): void {
    useApp.setState({ camera: s })
    window.readyup.log('camera.state', { status: s.status, width: s.width, height: s.height, frameRate: s.frameRate, startMs: s.startMs })
    if (s.status === 'disconnected' || s.status === 'stalled') this.interrupt()
  }

  private onModel(s: PoseStatus): void {
    useApp.setState({ model: s })
    window.readyup.log('model.state', { status: s.status, variant: s.variant, delegate: s.delegate, loadMs: s.loadMs, fallbackReason: s.fallbackReason })
  }

  // ---------- actions ----------

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
    await this.camera.refreshDevices()
    const settings = await window.readyup.getSettings()
    const s = await this.camera.start(this.camera.resolvePreferred(settings.camera))
    if (s.status === 'live' && s.deviceId && !settings.camera) await window.readyup.updateSettings({ camera: { deviceId: s.deviceId, label: s.label ?? '' } })
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
      await this.retryCamera()
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
  }

  resetSession(): void {
    this.counter.reset()
    this.tally.reset()
    this.poseRing = []
    useApp.setState({ repLog: [], corrections: [], cameraCounted: 0, total: 0, snapshot: null, announce: 'Session reset' })
    window.readyup.log('session.reset', {})
  }

  async exportLog(): Promise<void> {
    const st = useApp.getState()
    const res = await window.readyup.exportLog({
      includePose: st.includePose,
      thresholds: { ...st.thresholds },
      metrics: {
        fps: st.perf.fps === null ? null : round(st.perf.fps, 1),
        inferenceMs: st.perf.inferenceMs === null ? null : round(st.perf.inferenceMs, 1),
        droppedFrames: st.perf.dropped,
        latencyMs: st.perf.latencyMs === null ? null : round(st.perf.latencyMs, 1),
        cameraStartMs: st.camera.startMs,
        modelLoadMs: st.model.loadMs === null ? null : Math.round(st.model.loadMs),
        modelVariant: st.model.variant,
        delegate: st.model.delegate,
        cameraStatus: st.camera.status,
        cameraResolution: st.camera.width && st.camera.height ? `${st.camera.width}x${st.camera.height}` : null,
        source: st.source,
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
