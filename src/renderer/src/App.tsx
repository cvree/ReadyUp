import { useEffect, useRef } from 'react'
import { engine } from './engine/engine'
import { useApp } from './engine/store'
import { CameraPanel, ExercisePanel, ExportPanel, ModelPanel, RepLogPanel, SourcePanel, SystemPanel, ThresholdsPanel, TrackingPanel } from './ui/Panels'
import { Stage } from './ui/Stage'

export function App(): React.JSX.Element {
  const videoRef = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    if (videoRef.current) void engine.boot(videoRef.current)
  }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return
      if (e.key === '+' || e.key === '=') engine.correct(1)
      if (e.key === '-' || e.key === '_') engine.correct(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="app">
      <header className="top">
        <div className="wordmark" aria-label="Ready Up">READY<span> UP</span></div>
        <div className="title">
          <h1>Diagnostics</h1>
          <p>Milestone 1 · proof of concept · push-ups</p>
        </div>
        <p className="honesty" role="note">Logic tested on synthetic data. Accuracy not yet measured.</p>
      </header>
      <main className="body">
        <div className="left">
          <Stage videoRef={videoRef} />
          <CountBar />
        </div>
        <div className="right" aria-label="Diagnostics panels">
          <SourcePanel />
          <ExercisePanel />
          <ThresholdsPanel />
          <RepLogPanel />
          <CameraPanel />
          <ModelPanel />
          <SystemPanel />
          <TrackingPanel />
          <ExportPanel />
        </div>
      </main>
      <Announcer />
    </div>
  )
}

function CountBar(): React.JSX.Element {
  const camera = useApp((s) => s.cameraCounted)
  const total = useApp((s) => s.total)
  const corrections = useApp((s) => s.corrections)
  const hint = useApp((s) => s.hint)
  const net = total - camera
  return (
    <div className="countbar">
      <div className="count" aria-label={`${camera} push-ups counted by camera`}>
        <span className="n" data-testid="camera-count">{camera}</span>
        <span className="k">camera-counted</span>
      </div>
      <div className="corrections">
        <span className="k">Corrections</span>
        <span className="v" data-testid="corrections">{corrections.length === 0 ? 'none' : `${net >= 0 ? '+' : ''}${net} (${corrections.length})`}</span>
        <span className="k">Total {total}</span>
      </div>
      <p className="hint" data-testid="hint">{hint}</p>
      <div className="actions">
        <button className="btn" onClick={() => engine.correct(-1)} aria-label="Correct count: minus one" title="Minus one (−)">−1</button>
        <button className="btn" onClick={() => engine.correct(1)} aria-label="Correct count: plus one" title="Plus one (+)">+1</button>
        <button className="btn" onClick={() => engine.resetSession()}>Reset session</button>
      </div>
    </div>
  )
}

function Announcer(): React.JSX.Element {
  const announce = useApp((s) => s.announce)
  return <div className="sr-only" aria-live="polite">{announce}</div>
}
