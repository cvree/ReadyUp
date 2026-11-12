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
/** A stalled camera is restarted by itself this long after it stopped, at most twice in a row. */
const STALL_RESTART_MS = 4000
const MAX_AUTO_RESTARTS = 2
/** Some Windows drivers never answer; give up and explain instead of spinning forever. */
const START_TIMEOUT_MS = 12_000

/**
 * Lower is better. Windows lists infrared (Windows Hello) sensors and virtual cameras next to
 * the real webcam, often first; they give a black or grey picture that can't be tracked.
 */
export function cameraRank(label: string): number {
  if (/\b(ir|infrared)\b|windows hello|depth/i.test(label)) return 3
  if (/virtual|obs|snap camera|ndi|xsplit|manycam|nvidia broadcast/i.test(label)) return 2
  return 0
}

/** Camera name for display: Windows appends the USB id, e.g. "HD Webcam (046d:0825)". */
export function cameraDisplayName(label: string | null): string {
  const clean = (label ?? '').replace(/\s*\([0-9a-f]{4}:[0-9a-f]{4}\)\s*$/i, '').trim()
  return clean || 'Camera'
}

/**
 * Camera lifecycle: list devices, start/stop, remember choice, detect unplug and stalls,
 * and turn browser errors into states the UI can explain.
 */
export class CameraService {
  private stream: MediaStream | null = null
  private lastFrameAt = 0
  private stallTimer: number | null = null
  private wanted: CameraDevice | null = null
  /** Bumped by every start and stop, so a slow start that was superseded cleans up after itself. */
  private gen = 0
  private stalledAt = 0
  private autoRestarts = 0
  private lastAutoRestartAt = 0
  state: CameraState = { status: 'idle', deviceId: null, label: null, width: null, height: null, frameRate: null, startMs: null, message: null }
  devices: CameraDevice[] = []

  private video: HTMLVideoElement

  constructor(
    video: HTMLVideoElement,
    private readonly onState: (s: CameraState) => void,
    private readonly onDevices: (d: CameraDevice[]) => void
  ) {
    this.video = video
    navigator.mediaDevices.addEventListener('devicechange', () => void this.handleDeviceChange())
  }

  /** Moves the live stream to another video element (each camera screen has its own). */
  setVideo(video: HTMLVideoElement): void {
    if (video === this.video) return
    const stream = this.video.srcObject
    this.video.srcObject = null
    this.video = video
    if (stream) {
      video.srcObject = stream
      video.muted = true
      void video.play().catch(() => undefined)
    }
  }

  get element(): HTMLVideoElement {
    return this.video
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
    // First time: the first real webcam, ahead of infrared and virtual cameras.
    return [...this.devices].sort((a, b) => cameraRank(a.label) - cameraRank(b.label))[0] ?? null
  }

  /** The camera after the current one in the list, for one-key switching. */
  nextDevice(): CameraDevice | null {
    const usable = this.devices.filter((d) => d.deviceId)
    if (usable.length < 2) return null
    const i = usable.findIndex((d) => d.deviceId === this.state.deviceId)
    return usable[(i + 1) % usable.length] ?? null
  }

  async start(device: CameraDevice | null, isRetry = false): Promise<CameraState> {
    // Without permission, Chromium hides device IDs (empty strings). Asking for an empty ID fails
    // with a misleading "not found" error, so fall back to "any camera" and let the real error show.
    if (device && !device.deviceId) device = null
    this.stop(false)
    const gen = ++this.gen
    this.wanted = device
    this.set({ status: 'starting', deviceId: device?.deviceId ?? null, label: device?.label ?? null, message: null, startMs: null })
    const t0 = performance.now()
    try {
      const stream = await this.open(device)
      if (gen !== this.gen) {
        // Another start or a stop happened while this camera was opening.
        stream.getTracks().forEach((t) => t.stop())
        return this.state
      }
      this.stream = stream
      const track = stream.getVideoTracks()[0]
      if (!track) throw new DOMException('No video track', 'NotFoundError')
      track.addEventListener('ended', () => {
        if (this.stream === stream) this.handleEnded()
      })
      this.video.srcObject = stream
      this.video.muted = true
      await this.video.play()
      await this.firstFrame()
      if (gen !== this.gen) return this.state
      const s = track.getSettings()
      await this.refreshDevices()
      if (gen !== this.gen) return this.state
      const label = track.label || device?.label || 'Camera'
      const deviceId = s.deviceId ?? device?.deviceId ?? null
      this.wanted = deviceId ? { deviceId, label } : null
      this.lastFrameAt = performance.now()
      this.stalledAt = 0
      this.watchStalls()
      return this.set({
        status: 'live', deviceId, label, width: s.width ?? this.video.videoWidth, height: s.height ?? this.video.videoHeight,
        frameRate: s.frameRate ?? null, startMs: Math.round(performance.now() - t0), message: null
      })
    } catch (err) {
      if (gen !== this.gen) return this.state
      this.stop(false)
      const name = err instanceof DOMException || err instanceof Error ? err.name : ''
      // The remembered camera is gone or can't meet the constraints: try any camera once.
      if (device && !isRetry && (name === 'OverconstrainedError' || name === 'NotFoundError')) return this.start(null, true)
      return this.set(classify(err))
    }
  }

  /**
   * Opens the camera at 720p/30. Some drivers refuse the format they are asked for with a
   * "not readable" error even though the camera is free, so that case is retried once at whatever
   * the camera offers by default.
   */
  private async open(device: CameraDevice | null): Promise<MediaStream> {
    const pick = device ? { deviceId: { exact: device.deviceId } } : {}
    const ask = (video: MediaTrackConstraints): Promise<MediaStream> => {
      const pending = navigator.mediaDevices.getUserMedia({ audio: false, video })
      let timer = 0
      const timeout = new Promise<never>((_, reject) => {
        timer = window.setTimeout(() => reject(new DOMException('Camera start timed out', 'AbortError')), START_TIMEOUT_MS)
      })
      // If the camera does open after we gave up, release it so its light doesn't stay on.
      let gaveUp = false
      void pending.then((st) => { if (gaveUp) st.getTracks().forEach((t) => t.stop()) }, () => undefined)
      return Promise.race([pending, timeout]).catch((e: unknown) => {
        gaveUp = true
        throw e
      }).finally(() => window.clearTimeout(timer))
    }
    try {
      return await ask({ ...pick, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } })
    } catch (err) {
      if (err instanceof DOMException && err.name === 'NotReadableError') return ask(pick)
      throw err
    }
  }

  stop(updateState = true): void {
    this.gen++
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
    if (this.state.status === 'stalled') {
      this.stalledAt = 0
      this.autoRestarts = 0
      this.set({ status: 'live', message: null })
    }
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
      const now = performance.now()
      // A hidden or minimised window gets no video callbacks; that is not a camera fault.
      if (document.hidden) {
        this.lastFrameAt = now
        return
      }
      if (this.state.status === 'live' && now - this.lastFrameAt > STALL_MS) {
        this.stalledAt = now
        this.set({ status: 'stalled', message: 'The camera stopped sending pictures. Trying to get it back…' })
      } else if (this.state.status === 'stalled' && this.stalledAt && now - this.stalledAt > STALL_RESTART_MS) {
        this.stalledAt = 0
        // A camera that has behaved for a minute gets a fresh allowance.
        if (now - this.lastAutoRestartAt > 60_000) this.autoRestarts = 0
        if (this.autoRestarts < MAX_AUTO_RESTARTS) {
          this.autoRestarts++
          this.lastAutoRestartAt = now
          void this.start(this.wanted)
        } else {
          this.set({ message: 'The camera stopped sending pictures. Another app may be using it. Close that app, or choose another camera.' })
        }
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
    } else if (this.state.status === 'not_found' && this.devices.length > 0) {
      // A camera was plugged in while we were saying there wasn't one: just use it.
      await this.start(this.resolvePreferred(this.wanted))
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
