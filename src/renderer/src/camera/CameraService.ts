export type CameraStatus =
  | 'idle'
  | 'starting'
  | 'live'
  | 'permission_denied'
  | 'blocked_or_busy'
  | 'not_found'
  | 'disconnected'
  | 'stalled'
  | 'error'

export interface CameraDevice {
  deviceId: string
  label: string
}

export interface CameraState {
  status: CameraStatus
  deviceId: string | null
  label: string | null
  width: number | null
  height: number | null
  /** Frame rate reported by the camera. */
  frameRate: number | null
  /** getUserMedia call → first frame, ms. */
  startMs: number | null
  message: string | null
}

const STALL_MS = 2000

/**
 * Camera lifecycle: list devices, start/stop, remember choice, detect unplug and stalls,
 * and turn browser errors into states the UI can explain.
 */
export class CameraService {
  private stream: MediaStream | null = null
  private lastFrameAt = 0
  private stallTimer: number | null = null
  private wanted: CameraDevice | null = null
  state: CameraState = { status: 'idle', deviceId: null, label: null, width: null, height: null, frameRate: null, startMs: null, message: null }
  devices: CameraDevice[] = []

  constructor(
    private readonly video: HTMLVideoElement,
    private readonly onState: (s: CameraState) => void,
    private readonly onDevices: (d: CameraDevice[]) => void
  ) {
    navigator.mediaDevices.addEventListener('devicechange', () => void this.handleDeviceChange())
  }

  async refreshDevices(): Promise<CameraDevice[]> {
    const all = await navigator.mediaDevices.enumerateDevices()
    this.devices = all
      .filter((d) => d.kind === 'videoinput')
      .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Camera ${i + 1}` }))
    this.onDevices(this.devices)
    return this.devices
  }

  /** Picks the remembered camera by ID, then by label, then the first available. */
  resolvePreferred(remembered: CameraDevice | null): CameraDevice | null {
    if (remembered) {
      const byId = this.devices.find((d) => d.deviceId === remembered.deviceId)
      if (byId) return byId
      const byLabel = this.devices.find((d) => d.label === remembered.label)
      if (byLabel) return byLabel
    }
    return this.devices[0] ?? null
  }

  async start(device: CameraDevice | null, isRetry = false): Promise<CameraState> {
    // Without permission, Chromium hides device IDs (empty strings). Asking for an empty ID fails
    // with a misleading "not found" error, so fall back to "any camera" and let the real error show.
    if (device && !device.deviceId) device = null
    this.stop(false)
    this.wanted = device
    this.set({ status: 'starting', deviceId: device?.deviceId ?? null, label: device?.label ?? null, message: null, startMs: null })
    const t0 = performance.now()
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          ...(device ? { deviceId: { exact: device.deviceId } } : {}),
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        }
      })
      this.stream = stream
      const track = stream.getVideoTracks()[0]
      if (!track) throw new DOMException('No video track', 'NotFoundError')
      track.addEventListener('ended', () => this.handleEnded())
      this.video.srcObject = stream
      this.video.muted = true
      await this.video.play()
      await this.firstFrame()
      const s = track.getSettings()
      await this.refreshDevices()
      const label = track.label || device?.label || 'Camera'
      const deviceId = s.deviceId ?? device?.deviceId ?? null
      this.wanted = deviceId ? { deviceId, label } : null
      this.lastFrameAt = performance.now()
      this.watchStalls()
      return this.set({
        status: 'live', deviceId, label, width: s.width ?? this.video.videoWidth, height: s.height ?? this.video.videoHeight,
        frameRate: s.frameRate ?? null, startMs: Math.round(performance.now() - t0), message: null
      })
    } catch (err) {
      this.stop(false)
      const name = err instanceof DOMException || err instanceof Error ? err.name : ''
      // The remembered camera is gone or can't meet the constraints: try any camera once.
      if (device && !isRetry && (name === 'OverconstrainedError' || name === 'NotFoundError')) return this.start(null, true)
      return this.set(classify(err))
    }
  }

  stop(updateState = true): void {
    if (this.stallTimer !== null) window.clearInterval(this.stallTimer)
    this.stallTimer = null
    this.stream?.getTracks().forEach((t) => t.stop())
    this.stream = null
    this.video.srcObject = null
    if (updateState) this.set({ status: 'idle', message: null })
  }

  /** Called by the frame loop whenever a new camera frame is presented. */
  noteFrame(): void {
    this.lastFrameAt = performance.now()
    if (this.state.status === 'stalled') this.set({ status: 'live', message: null })
  }

  /** For tests and Diagnostics: behave exactly as if the device was unplugged. */
  simulateDisconnect(): void {
    this.stream?.getVideoTracks().forEach((t) => t.stop())
    this.handleEnded()
  }

  private firstFrame(): Promise<void> {
    return new Promise((resolve) => {
      if (this.video.readyState >= 2 && this.video.videoWidth > 0) return resolve()
      const done = (): void => resolve()
      this.video.addEventListener('loadeddata', done, { once: true })
      setTimeout(done, 3000)
    })
  }

  private watchStalls(): void {
    this.stallTimer = window.setInterval(() => {
      if (this.state.status === 'live' && performance.now() - this.lastFrameAt > STALL_MS) {
        this.set({ status: 'stalled', message: 'The camera stopped sending pictures. It may be in use by another app.' })
      }
    }, 500)
  }

  private handleEnded(): void {
    if (this.state.status === 'disconnected') return
    if (this.stallTimer !== null) window.clearInterval(this.stallTimer)
    this.stallTimer = null
    this.stream = null
    this.video.srcObject = null
    this.set({ status: 'disconnected', message: 'Camera disconnected. Your count is saved. Plug it back in or choose another camera.' })
  }

  private async handleDeviceChange(): Promise<void> {
    await this.refreshDevices()
    // Reconnect automatically when the camera we were using comes back.
    if (this.state.status === 'disconnected' && this.wanted) {
      const back = this.resolvePreferred(this.wanted)
      if (back && (back.deviceId === this.wanted.deviceId || back.label === this.wanted.label)) await this.start(back)
    }
  }

  private set(patch: Partial<CameraState>): CameraState {
    this.state = { ...this.state, ...patch }
    this.onState(this.state)
    return this.state
  }
}

function classify(err: unknown): Partial<CameraState> {
  const name = err instanceof DOMException || err instanceof Error ? err.name : ''
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return { status: 'permission_denied', message: 'Camera access is off for Ready Up. On Windows, turn it on in Settings → Privacy & security → Camera, including "Let desktop apps access your camera". Video stays on this computer.' }
    case 'NotFoundError':
    case 'OverconstrainedError':
      return { status: 'not_found', message: 'No camera found. Plug in a webcam, or use a phone camera app that Windows shows as a webcam.' }
    case 'NotReadableError':
    case 'AbortError':
      return { status: 'blocked_or_busy', message: 'Windows couldn\'t start the camera. Another app may be using it, or camera access for desktop apps may be off in Settings → Privacy & security → Camera.' }
    default:
      return { status: 'error', message: `The camera couldn't start (${name || 'unknown error'}).` }
  }
}
