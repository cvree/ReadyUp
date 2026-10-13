/** Messages between the UI thread and the pose worker. */
export type Delegate = 'GPU' | 'CPU'
export type ModelVariant = 'full' | 'lite'

export type ToWorker =
  | { type: 'init'; wasmBase: string; modelUrl: string; delegate: Delegate; variant: ModelVariant }
  | { type: 'frame'; bitmap: ImageBitmap; t: number }
  | { type: 'close' }

export type FromWorker =
  | { type: 'ready'; delegate: Delegate; variant: ModelVariant; loadMs: number }
  | { type: 'init_error'; delegate: Delegate; message: string }
  | {
      type: 'result'
      t: number
      width: number
      height: number
      /** 33 × (x, y, z, visibility), or null when no person was found. */
      landmarks: Float32Array | null
      inferenceMs: number
    }
  | { type: 'frame_error'; message: string }
