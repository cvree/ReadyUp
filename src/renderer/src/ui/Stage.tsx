import { useEffect, useRef } from 'react'
import { engine, type FrameView } from '../engine/engine'
import { useApp } from '../engine/store'
import { containRect, drawPose } from './draw'

/** Camera preview (or simulated stage) with the skeleton overlay and camera-state cards. */
export function Stage({ videoRef }: { videoRef: React.RefObject<HTMLVideoElement | null> }): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const mirror = useApp((s) => s.mirror)
  const source = useApp((s) => s.source)
  const camera = useApp((s) => s.camera)
  const model = useApp((s) => s.model)
  const perf = useApp((s) => s.perf)
  const mirrorRef = useRef(mirror)
  mirrorRef.current = mirror

  useEffect(() => {
    const canvas = canvasRef.current
    const box = boxRef.current
    if (!canvas || !box) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let last: FrameView | null = null
    const paint = (): void => {
      const dpr = window.devicePixelRatio || 1
      const { width, height } = box.getBoundingClientRect()
      if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
        canvas.width = Math.round(width * dpr)
        canvas.height = Math.round(height * dpr)
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      if (!last) return
      drawPose(ctx, last, containRect(width, height, last.frame.width, last.frame.height), mirrorRef.current && last.source === 'live', dpr)
    }
    const unsub = engine.subscribe((v) => {
      last = v
      requestAnimationFrame(paint)
    })
    const ro = new ResizeObserver(paint)
    ro.observe(box)
    return () => {
      unsub()
      ro.disconnect()
    }
  }, [])

  const live = source === 'live'
  return (
    <div className="stage" ref={boxRef}>
      <video ref={videoRef} className={`stage-video ${mirror ? 'mirrored' : ''}`} hidden={!live} playsInline muted aria-label="Camera preview" />
      <canvas ref={canvasRef} className="stage-overlay" aria-hidden="true" />
      <div className="stage-tags">
        <span className="tag">{live ? 'Live camera' : 'Simulated input'}</span>
        {perf.fps !== null && <span className="tag">{Math.round(perf.fps)} fps</span>}
        {live && model.delegate && <span className="tag">{model.delegate} · {model.variant}</span>}
        {live && perf.inferenceMs !== null && <span className="tag">{perf.inferenceMs.toFixed(1)} ms</span>}
      </div>
      {live && <CameraCard />}
      {live && model.status === 'loading' && camera.status === 'live' && (
        <div className="stage-card" role="status">
          <h3>Warming up the tracker…</h3>
          <p>Loading the pose model on this computer. It doesn't need the internet.</p>
          <div className="loadbar"><i /></div>
        </div>
      )}
      {live && model.status === 'error' && (
        <div className="stage-card" role="alert">
          <h3>The tracker couldn't start</h3>
          <p>{model.error}</p>
          <div className="card-actions"><button className="btn primary" onClick={() => void engine.setModel(model.variant)}>Try again</button></div>
        </div>
      )}
    </div>
  )
}

function CameraCard(): React.JSX.Element | null {
  const camera = useApp((s) => s.camera)
  const count = useApp((s) => s.total)
  switch (camera.status) {
    case 'live':
    case 'idle':
      return null
    case 'starting':
      return <div className="stage-card" role="status"><h3>Starting your camera…</h3></div>
    case 'permission_denied':
      return (
        <div className="stage-card" role="alert" data-state="permission-denied">
          <h3>Ready Up needs your camera to count reps</h3>
          <p>{camera.message}</p>
          <div className="card-actions">
            <button className="btn primary" onClick={() => void window.readyup.openCameraSettings()}>Open camera settings</button>
            <button className="btn" onClick={() => void engine.retryCamera()}>Try again</button>
          </div>
        </div>
      )
    case 'disconnected':
      return (
        <div className="stage-card" role="alert" data-state="disconnected">
          <h3>Paused at {count}</h3>
          <p>{camera.message}</p>
          <div className="card-actions"><button className="btn primary" onClick={() => void engine.retryCamera()}>Reconnect</button></div>
        </div>
      )
    default:
      return (
        <div className="stage-card" role="alert" data-state={camera.status}>
          <h3>{camera.status === 'not_found' ? 'No camera found' : camera.status === 'stalled' ? 'The camera stopped' : 'The camera couldn\'t start'}</h3>
          <p>{camera.message}</p>
          <div className="card-actions">
            <button className="btn primary" onClick={() => void engine.retryCamera()}>Try again</button>
            {camera.status === 'blocked_or_busy' && <button className="btn" onClick={() => void window.readyup.openCameraSettings()}>Open camera settings</button>}
          </div>
        </div>
      )
  }
}
