import type { Delegate, FromWorker, ModelVariant, ToWorker } from './protocol'

export type DelegatePreference = 'auto' | Delegate

export interface PoseResult {
  t: number
  width: number
  height: number
  landmarks: Float32Array | null
  inferenceMs: number
}

export interface PoseStatus {
  status: 'idle' | 'loading' | 'ready' | 'error'
  variant: ModelVariant
  delegate: Delegate | null
  loadMs: number | null
  /** Why the GPU path was abandoned, if it was. */
  fallbackReason: string | null
  error: string | null
}

const INIT_TIMEOUT_MS = 30_000
const SLOW_GPU_SAMPLE = 30
const SLOW_GPU_MS = 120
const SOFTWARE_GL = /swiftshader|llvmpipe|softpipe|software|basic render/i

/** The WebGL renderer string, or null if WebGL is unavailable. */
function webglRenderer(): string | null {
  try {
    const gl = new OffscreenCanvas(1, 1).getContext('webgl2')
    if (!gl) return null
    const ext = gl.getExtension('WEBGL_debug_renderer_info')
    const name = String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER))
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return name
  } catch {
    return null
  }
}

/**
 * Owns the pose worker. Tries the GPU delegate first and falls back to CPU automatically.
 * Applies backpressure: while a frame is being processed, new frames are dropped (not queued),
 * so latency stays low on slower machines.
 */
export class PoseClient {
  private worker: Worker | null = null
  private busy = false
  private frameErrors = 0
  private framesDone = 0
  private gpuInferenceTotal = 0
  private triedSlowGpuSwitch = false
  private generation = 0
  status: PoseStatus = { status: 'idle', variant: 'full', delegate: null, loadMs: null, fallbackReason: null, error: null }

  constructor(
    private readonly onResult: (r: PoseResult) => void,
    private readonly onStatus: (s: PoseStatus) => void,
    private readonly onFrameError: (message: string, count: number) => void = () => {}
  ) {}

  get ready(): boolean {
    return this.status.status === 'ready'
  }

  async init(variant: ModelVariant, prefer: DelegatePreference = 'auto'): Promise<void> {
    const gen = ++this.generation
    this.dispose(false)
    this.setStatus({ status: 'loading', variant, delegate: null, loadMs: null, fallbackReason: null, error: null })
    let order: Delegate[] = prefer === 'auto' ? ['GPU', 'CPU'] : [prefer]
    let fallbackReason: string | null = null
    if (prefer === 'auto') {
      const renderer = webglRenderer()
      if (renderer === null || SOFTWARE_GL.test(renderer)) {
        // Software WebGL is far slower than MediaPipe's CPU (WebAssembly) path.
        order = ['CPU']
        fallbackReason = renderer === null ? 'GPU unavailable (no WebGL)' : `GPU skipped: software renderer (${renderer.slice(0, 60)})`
      }
    }
    for (const delegate of order) {
      const res = await this.tryInit(delegate, variant)
      if (gen !== this.generation) return
      if (res.ok) {
        this.setStatus({ status: 'ready', variant, delegate, loadMs: res.loadMs, fallbackReason, error: null })
        return
      }
      fallbackReason = `${delegate} unavailable (${shorten(res.message)})`
    }
    this.setStatus({ status: 'error', variant, delegate: null, loadMs: null, fallbackReason, error: fallbackReason ?? 'Could not start the pose model' })
  }

  /** Takes ownership of the bitmap. Returns false if the frame was dropped. */
  submit(bitmap: ImageBitmap, t: number): boolean {
    if (!this.worker || !this.ready || this.busy) {
      bitmap.close()
      return false
    }
    this.busy = true
    const msg: ToWorker = { type: 'frame', bitmap, t }
    this.worker.postMessage(msg, [bitmap])
    return true
  }

  get isBusy(): boolean {
    return this.busy
  }

  dispose(resetStatus = true): void {
    if (this.worker) {
      this.worker.postMessage({ type: 'close' } satisfies ToWorker)
      this.worker.terminate()
      this.worker = null
    }
    this.busy = false
    if (resetStatus) this.setStatus({ ...this.status, status: 'idle' })
  }

  private tryInit(delegate: Delegate, variant: ModelVariant): Promise<{ ok: true; loadMs: number } | { ok: false; message: string }> {
    const worker = new Worker(new URL('./pose.worker.ts', import.meta.url), { type: 'module', name: 'pose' })
    const wasmBase = new URL('mediapipe/wasm', document.baseURI).href
    const modelUrl = new URL(`mediapipe/models/pose_landmarker_${variant}.task`, document.baseURI).href
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        worker.terminate()
        resolve({ ok: false, message: 'timed out loading the model' })
      }, INIT_TIMEOUT_MS)
      worker.onerror = (ev) => {
        clearTimeout(timer)
        worker.terminate()
        resolve({ ok: false, message: ev.message || 'worker failed to start' })
      }
      worker.onmessage = (ev: MessageEvent<FromWorker>) => {
        const m = ev.data
        if (m.type === 'ready') {
          clearTimeout(timer)
          this.worker = worker
          this.frameErrors = 0
          this.framesDone = 0
          this.gpuInferenceTotal = 0
          worker.onmessage = (e: MessageEvent<FromWorker>) => this.handle(e.data)
          resolve({ ok: true, loadMs: m.loadMs })
        } else if (m.type === 'init_error') {
          clearTimeout(timer)
          worker.terminate()
          resolve({ ok: false, message: m.message })
        }
      }
      worker.postMessage({ type: 'init', wasmBase, modelUrl, delegate, variant } satisfies ToWorker)
    })
  }

  private handle(m: FromWorker): void {
    if (m.type === 'result') {
      this.busy = false
      this.framesDone++
      if (this.status.delegate === 'GPU' && !this.triedSlowGpuSwitch) {
        this.gpuInferenceTotal += m.inferenceMs
        if (this.framesDone === SLOW_GPU_SAMPLE) {
          const mean = this.gpuInferenceTotal / SLOW_GPU_SAMPLE
          if (mean > SLOW_GPU_MS) {
            this.triedSlowGpuSwitch = true
            const variant = this.status.variant
            void this.init(variant, 'CPU').then(() => {
              this.setStatus({ ...this.status, fallbackReason: `GPU was slow (${Math.round(mean)} ms per frame)` })
            })
          }
        }
      }
      this.onResult({ t: m.t, width: m.width, height: m.height, landmarks: m.landmarks, inferenceMs: m.inferenceMs })
    } else if (m.type === 'frame_error') {
      this.busy = false
      this.frameErrors++
      this.onFrameError(m.message, this.frameErrors)
      // A GPU path that fails on its first frames falls back to CPU automatically.
      if (this.status.delegate === 'GPU' && this.frameErrors >= 3 && this.framesDone < 30) {
        const variant = this.status.variant
        void this.init(variant, 'CPU').then(() => {
          this.setStatus({ ...this.status, fallbackReason: `GPU: failed on first frames (${m.message})` })
        })
      }
    }
  }

  private setStatus(s: PoseStatus): void {
    this.status = s
    this.onStatus(s)
  }
}

/** MediaPipe errors can be several hundred characters of graph internals; keep the useful start. */
function shorten(message: string): string {
  const first = message.split(/;|\n/)[0] ?? message
  const webgl = /webgl/i.test(message) ? 'WebGL is not available' : null
  return (webgl ?? first).slice(0, 120)
}
