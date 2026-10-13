/// <reference lib="webworker" />
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision'
import type { FromWorker, ToWorker } from './protocol'

// Runs MediaPipe Pose Landmarker off the UI thread. Frames arrive as transferred ImageBitmaps,
// are processed in memory and closed immediately. Nothing is stored or sent anywhere.
const ctx = self as unknown as DedicatedWorkerGlobalScope
let landmarker: PoseLandmarker | null = null
let lastTs = 0

function post(msg: FromWorker, transfer: Transferable[] = []): void {
  ctx.postMessage(msg, transfer)
}

ctx.onmessage = async (e: MessageEvent<ToWorker>) => {
  const msg = e.data
  if (msg.type === 'init') {
    const t0 = performance.now()
    try {
      const fileset = await FilesetResolver.forVisionTasks(msg.wasmBase, true)
      landmarker = await PoseLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: msg.modelUrl, delegate: msg.delegate },
        runningMode: 'VIDEO',
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
        outputSegmentationMasks: false,
        // MediaPipe uploads input frames through WebGL even when inference runs on the CPU,
        // and inside a worker it only gets a GL context if we hand it a canvas.
        canvas: new OffscreenCanvas(1, 1)
      })
      post({ type: 'ready', delegate: msg.delegate, variant: msg.variant, loadMs: performance.now() - t0 })
    } catch (err) {
      post({ type: 'init_error', delegate: msg.delegate, message: err instanceof Error ? err.message : String(err) })
    }
    return
  }
  if (msg.type === 'frame') {
    const { bitmap } = msg
    try {
      if (!landmarker) return
      // MediaPipe requires strictly increasing timestamps in VIDEO mode.
      const ts = Math.max(lastTs + 1, Math.round(msg.t))
      lastTs = ts
      const t0 = performance.now()
      const res = landmarker.detectForVideo(bitmap, ts)
      const inferenceMs = performance.now() - t0
      const pose = res.landmarks[0]
      let landmarks: Float32Array | null = null
      if (pose && pose.length === 33) {
        landmarks = new Float32Array(33 * 4)
        pose.forEach((l, i) => {
          landmarks![i * 4] = l.x
          landmarks![i * 4 + 1] = l.y
          landmarks![i * 4 + 2] = l.z
          landmarks![i * 4 + 3] = l.visibility ?? 0
        })
      }
      post({ type: 'result', t: msg.t, width: bitmap.width, height: bitmap.height, landmarks, inferenceMs }, landmarks ? [landmarks.buffer] : [])
    } catch (err) {
      post({ type: 'frame_error', message: err instanceof Error ? err.message : String(err) })
    } finally {
      bitmap.close()
    }
    return
  }
  if (msg.type === 'close') {
    landmarker?.close()
    landmarker = null
    ctx.close()
  }
}
