import { useEffect, useRef } from 'react'
import { LANDMARK_NAMES } from '@readyup/pose-types'
import { PRESETS } from '@readyup/sim'
import { engine } from '../engine/engine'
import { useApp } from '../engine/store'
import { drawTrace, type TracePoint } from './draw'
import { KV, Panel, Segmented, Slider } from './primitives'

const fmtMs = (n: number | null | undefined): string | null => (n === null || n === undefined ? null : `${Math.round(n)} ms`)

export function SystemPanel(): React.JSX.Element {
  const s = useApp((st) => st.system)
  const startup = useApp((st) => st.startup)
  const archNote = s ? (s.emulated ? `${s.appArch} build, emulated on ${s.osArch}` : s.appArch === s.osArch ? `${s.appArch} (native)` : `${s.appArch} build on ${s.osArch}`) : null
  return (
    <Panel title="System" id="system" badge={s && s.appArch !== s.osArch ? <em className="warn">Install the {s.osArch} build</em> : undefined}>
      <KV items={[
        ['Operating system', s?.osName ?? 'Detecting…'],
        ['Version', s?.osVersion ?? null],
        ['Build', s?.osBuild ?? null],
        ['Architecture', archNote],
        ['Camera access', s?.cameraAccess ?? null],
        ['GPU', s?.gpu ?? null],
        ['Window ready', fmtMs(startup?.windowReadyMs)],
        ['Ready Up', s ? `${s.appVersion} · Electron ${s.electron}` : null]
      ]} />
      {s && <p className="fine">Detected from: {s.source}.</p>}
    </Panel>
  )
}

export function CameraPanel(): React.JSX.Element {
  const camera = useApp((s) => s.camera)
  const devices = useApp((s) => s.devices)
  const mirror = useApp((s) => s.mirror)
  const source = useApp((s) => s.source)
  return (
    <Panel title="Camera" id="camera" badge={<em className={camera.status === 'live' ? 'ok' : 'warn'}>{camera.status.replace(/_/g, ' ')}</em>}>
      <label className="field">
        <span>Camera</span>
        <select value={camera.deviceId ?? ''} disabled={source !== 'live' || devices.length === 0} onChange={(e) => void engine.selectCamera(e.target.value)}>
          {devices.length === 0 && <option value="">No cameras found</option>}
          {devices.map((d) => <option key={d.deviceId} value={d.deviceId}>{d.label}</option>)}
        </select>
      </label>
      <KV items={[
        ['Resolution', camera.width && camera.height ? `${camera.width}×${camera.height}` : null],
        ['Camera fps', camera.frameRate ? Math.round(camera.frameRate) : null],
        ['Start time', fmtMs(camera.startMs)]
      ]} />
      <div className="row">
        <label className="check"><input type="checkbox" checked={mirror} onChange={(e) => void engine.setMirror(e.target.checked)} /> Mirror preview</label>
        <button className="btn small" onClick={() => engine.simulateDisconnect()} disabled={camera.status !== 'live'}>Simulate unplug</button>
      </div>
      <p className="fine">Phone cameras work when Windows lists them as a webcam (for example via a webcam app on the phone).</p>
    </Panel>
  )
}

export function ModelPanel(): React.JSX.Element {
  const m = useApp((s) => s.model)
  const perf = useApp((s) => s.perf)
  return (
    <Panel title="Pose model" id="model" badge={<em className={m.status === 'ready' ? 'ok' : 'warn'}>{m.status}</em>}>
      <Segmented label="Model variant" value={m.variant} options={[{ value: 'full', label: 'Full' }, { value: 'lite', label: 'Lite' }]} onChange={(v) => void engine.setModel(v)} />
      <KV items={[
        ['Runs on', m.delegate ? (m.delegate === 'GPU' ? 'Graphics card (GPU)' : 'Processor (CPU)') : null],
        ['Load time', fmtMs(m.loadMs)],
        ['Inference', perf.inferenceMs === null ? null : `${perf.inferenceMs.toFixed(1)} ms`],
        ['Tracking rate', perf.fps === null ? null : `${Math.round(perf.fps)} fps`],
        ['Frame to result', perf.latencyMs === null ? null : `${Math.round(perf.latencyMs)} ms`],
        ['Camera frames skipped', perf.dropped]
      ]} />
      {m.fallbackReason && <p className="fine warn">Fell back to CPU. {m.fallbackReason}</p>}
      <p className="fine">Runs entirely on this computer. No network.</p>
    </Panel>
  )
}

export function SourcePanel(): React.JSX.Element {
  const source = useApp((s) => s.source)
  const sim = useApp((s) => s.sim)
  return (
    <Panel title="Input" id="input">
      <Segmented label="Input source" value={source} options={[{ value: 'live', label: 'Live camera' }, { value: 'sim', label: 'Simulated' }]} onChange={(v) => void engine.setSource(v)} />
      {source === 'sim' && (
        <div className="stack">
          <label className="field">
            <span>Movement</span>
            <select value={sim.presetId} onChange={(e) => engine.updateSim({ presetId: e.target.value })}>
              {PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              <option value="custom">Custom (sliders)</option>
            </select>
          </label>
          <p className="fine">{sim.presetId === 'custom' ? '10 reps shaped by the sliders below.' : PRESETS.find((p) => p.id === sim.presetId)?.description}</p>
          {sim.presetId === 'custom' && (
            <>
              <Slider label="Tempo" value={sim.tempo} min={0.4} max={2.5} step={0.1} unit="×" onChange={(v) => engine.updateSim({ tempo: v })} />
              <Slider label="Depth" value={sim.depth} min={60} max={140} step={1} unit="°" onChange={(v) => engine.updateSim({ depth: v })} />
              <Slider label="Noise" value={sim.noise} min={0} max={8} step={0.5} unit=" px" onChange={(v) => engine.updateSim({ noise: v })} />
              <Slider label="Dropouts" value={sim.dropout} min={0} max={20} step={1} unit="/min" onChange={(v) => engine.updateSim({ dropout: v })} />
            </>
          )}
        </div>
      )}
    </Panel>
  )
}

export function ExercisePanel(): React.JSX.Element {
  const snap = useApp((s) => s.snapshot)
  const th = useApp((s) => s.thresholds)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const pts: TracePoint[] = []
    let scheduled = false
    let lastTh = { top: 150, bottom: 100 }
    const paint = (): void => {
      scheduled = false
      const dpr = window.devicePixelRatio || 1
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      if (canvas.width !== Math.round(w * dpr)) canvas.width = Math.round(w * dpr)
      if (canvas.height !== Math.round(h * dpr)) canvas.height = Math.round(h * dpr)
      drawTrace(ctx, pts, w, h, lastTh.top, lastTh.bottom, dpr)
    }
    return engine.subscribe((v) => {
      const ev = v.snap.events[v.snap.events.length - 1]
      pts.push({ t: v.frame.t, v: v.snap.signals.primary, ...(ev ? { mark: ev.outcome } : {}) })
      while (pts.length && v.frame.t - pts[0]!.t > 10_000) pts.shift()
      lastTh = v.thresholds
      if (!scheduled) {
        scheduled = true
        requestAnimationFrame(paint)
      }
    })
  }, [])
  const extra = snap?.signals.extra ?? {}
  return (
    <Panel title="Exercise · push-ups" id="exercise" badge={<em className="phase">{snap ? snap.phase.toUpperCase() : '—'}</em>}>
      <canvas ref={canvasRef} className="trace" aria-label={`Elbow angle over the last 10 seconds, with the top threshold at ${th.top}° and bottom at ${th.bottom}°`} role="img" />
      <KV items={[
        ['Elbow (smoothed)', snap?.signals.primary != null ? `${Math.round(snap.signals.primary)}°` : null],
        ['Elbow (raw)', snap?.signals.primaryRaw != null ? `${Math.round(snap.signals.primaryRaw)}°` : null],
        ['Side used', snap?.side ?? null],
        ['Tracking', snap?.tracking ?? null],
        ['Body incline', extra.bodyIncline !== undefined ? `${Math.round(extra.bodyIncline)}°` : null],
        ['Knee', extra.knee !== undefined ? `${Math.round(extra.knee)}°` : null]
      ]} />
      <ul className="gates" aria-label="Position checks">
        {(snap?.gates ?? []).map((g) => (
          <li key={g.id} className={g.pass ? 'pass' : 'fail'}>
            <span aria-hidden="true">{g.pass ? '✓' : '!'}</span>
            <span>{g.label}</span>
            <span className="mono">{g.unit === '°' ? `${Math.round(g.value)}° / ${g.threshold}°` : g.pass ? 'yes' : 'no'}</span>
          </li>
        ))}
        {snap && snap.gates.length === 0 && <li className="fail"><span aria-hidden="true">!</span><span>{snap.missingJoints.length ? `Can't see: ${[...new Set(snap.missingJoints)].join(', ')}` : 'No person detected'}</span><span /></li>}
      </ul>
    </Panel>
  )
}

export function ThresholdsPanel(): React.JSX.Element {
  const th = useApp((s) => s.thresholds)
  return (
    <Panel title="Thresholds" id="thresholds" badge={<em className="warn">test values</em>}>
      <Slider label="Bottom ≤" value={th.bottom} min={60} max={130} step={1} unit="°" onChange={(v) => engine.setThresholds({ bottom: v })} />
      <Slider label="Top ≥" value={th.top} min={130} max={175} step={1} unit="°" onChange={(v) => engine.setThresholds({ top: v })} />
      <Slider label="Min visibility" value={th.minVisibility} min={0.3} max={0.95} step={0.05} onChange={(v) => engine.setThresholds({ minVisibility: v })} />
      <Slider label="Body line ≥" value={th.bodyLineMin} min={120} max={175} step={1} unit="°" onChange={(v) => engine.setThresholds({ bodyLineMin: v })} />
      <div className="row">
        <p className="fine">Provisional. Changes apply live and are not saved.</p>
        <button className="btn small" onClick={() => engine.resetThresholds()}>Reset to defaults</button>
      </div>
    </Panel>
  )
}

export function RepLogPanel(): React.JSX.Element {
  const log = useApp((s) => s.repLog)
  const corrections = useApp((s) => s.corrections)
  return (
    <Panel title="Rep log" id="replog" badge={<em>{log.length} attempts · {corrections.length} corrections</em>}>
      {log.length === 0 && <p className="fine">Every attempt appears here, counted or not, with the reason.</p>}
      <ol className="replog">
        {log.slice(0, 60).map((e, i) => (
          <li key={`${e.t}-${i}`} className={e.outcome}>
            <span className="mono">{e.outcome === 'counted' ? `#${e.count}` : e.outcome}</span>
            <span>{e.outcome === 'counted' ? 'Counted' : e.message}</span>
            <span className="mono fine">{Number.isFinite(e.metrics.minAngle) ? `min ${Math.round(e.metrics.minAngle)}°` : ''} {(e.metrics.durationMs / 1000).toFixed(1)}s {e.metrics.side ?? ''}</span>
          </li>
        ))}
      </ol>
    </Panel>
  )
}

export function TrackingPanel(): React.JSX.Element {
  const vis = useApp((s) => s.visibility)
  const th = useApp((s) => s.thresholds)
  return (
    <Panel title="Landmarks" id="landmarks">
      {!vis && <p className="fine">No person detected.</p>}
      {vis && (
        <ul className="landmarks">
          {vis.map((v, i) => (
            <li key={i} className={v >= th.minVisibility ? '' : 'low'}>
              <span className="mono">{LANDMARK_NAMES[i]}</span>
              <span className="bar"><i style={{ width: `${Math.round(v * 100)}%` }} /></span>
              <span className="mono">{v.toFixed(2)}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

export function ExportPanel(): React.JSX.Element {
  const includePose = useApp((s) => s.includePose)
  const res = useApp((s) => s.exportResult)
  return (
    <Panel title="Export log" id="export">
      <p className="fine">Saves system info, settings, events and rep metrics as JSON. Never includes video or images.</p>
      <label className="check"><input type="checkbox" checked={includePose} onChange={(e) => useApp.setState({ includePose: e.target.checked })} /> Include the last 30 s of pose landmarks (numbers only)</label>
      <div className="row">
        <button className="btn primary" onClick={() => void engine.exportLog()}>Export log…</button>
      </div>
      {res && (res.ok ? <p className="fine ok" role="status">Saved to {res.path}</p> : res.reason === 'cancelled' ? null : <p className="fine warn" role="alert">Couldn't save: {res.message}</p>)}
    </Panel>
  )
}
