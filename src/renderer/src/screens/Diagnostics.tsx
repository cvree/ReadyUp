import { engine } from '../engine/engine'
import { useApp } from '../engine/store'
import * as C from '../state/controller'
import { Shell, useKeys } from '../ui/kit'
import { CameraPanel, ExercisePanel, ExportPanel, ModelPanel, RepLogPanel, SourcePanel, SystemPanel, ThresholdsPanel, TrackingPanel } from '../ui/Panels'
import { CameraView } from './Camera'
import { useEffect } from 'react'

/** The testing screen: why each rep counted or didn't, with every signal visible. */
export function Diagnostics(): React.JSX.Element {
  useKeys({ Escape: () => C.go('settings'), '+': () => engine.correct(1), '=': () => engine.correct(1), '-': () => engine.correct(-1) })
  useEffect(() => {
    void engine.loadInfo()
  }, [])
  return (
    <Shell title="Diagnostics">
      <div className="diag">
        <header className="diag-head">
          <h1 className="h1">Diagnostics</h1>
          <p className="honesty" role="note">Logic tested on synthetic data. Accuracy on real cameras is still being measured.</p>
        </header>
        <div className="diag-body">
          <div className="diag-left">
            <CameraView />
            <CountBar />
          </div>
          <div className="diag-right" aria-label="Diagnostics panels">
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
        </div>
      </div>
    </Shell>
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
      <div className="count-d" aria-label={`${camera} counted by camera`}>
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
        <button className="btn" onClick={() => engine.correct(-1)} aria-label="Correct count: minus one">−1</button>
        <button className="btn" onClick={() => engine.correct(1)} aria-label="Correct count: plus one">+1</button>
        <button className="btn" onClick={() => engine.resetSession()}>Reset session</button>
      </div>
    </div>
  )
}
