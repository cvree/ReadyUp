import { useEffect, useRef, useState } from 'react'
import { EXERCISE_LIST, exerciseById } from '@readyup/exercise'
import { moveTotal } from '@readyup/session'
import { engine, type FrameView } from '../engine/engine'
import { useApp } from '../engine/store'
import * as C from '../state/controller'
import { useStore } from '../state/store'
import { containRect, drawPose } from '../ui/draw'
import { Beta, Kbd, ReadyCheck, Sheet, Shell, useKeys } from '../ui/kit'
import { slotsFor } from './common'

// ---------------------------------------------------------------- shared camera view

/** Live camera with the skeleton overlay. The camera runs only while this is on screen. */
export function CameraView({ ghost, onOverride }: { ghost?: string; onOverride?: () => void }): React.JSX.Element {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const mirror = useApp((s) => s.mirror)
  const source = useApp((s) => s.source)
  const mirrorRef = useRef(mirror)
  mirrorRef.current = mirror

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    void engine.attach(video)
    return () => engine.detach(video)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const box = boxRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !box || !ctx) return
    let last: FrameView | null = null
    let queued = false
    const paint = (): void => {
      queued = false
      const dpr = window.devicePixelRatio || 1
      const { width, height } = box.getBoundingClientRect()
      if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
        canvas.width = Math.round(width * dpr)
        canvas.height = Math.round(height * dpr)
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      if (last) drawPose(ctx, last, containRect(width, height, last.frame.width, last.frame.height), mirrorRef.current && last.source === 'live', dpr)
    }
    const unsub = engine.subscribe((v) => {
      last = v
      if (!queued) {
        queued = true
        requestAnimationFrame(paint)
      }
    })
    const ro = new ResizeObserver(paint)
    ro.observe(box)
    return () => {
      unsub()
      ro.disconnect()
    }
  }, [])

  return (
    <div className="camview" ref={boxRef}>
      <video ref={videoRef} className={`camview-video ${mirror ? 'mirrored' : ''}`} hidden={source !== 'live'} playsInline muted aria-label="Camera preview" />
      {ghost && <Ghost kind={ghost} />}
      <canvas ref={canvasRef} className="camview-overlay" aria-hidden="true" />
      {source === 'sim' && <span className="tag sim-tag">Simulated input</span>}
      {source === 'live' && <CameraStateCard onOverride={onOverride} />}
    </div>
  )
}

/** A dashed outline showing roughly where to be. Drawn level, never mirrored text. */
function Ghost({ kind }: { kind: string }): React.JSX.Element {
  const view = exerciseById(kind)
  const path = view.id === 'squat'
    ? 'M70 18 L70 46 L66 70 L74 92 M70 30 L54 38'
    : view.id === 'sit_up'
      ? 'M28 86 L58 86 L74 70 L86 90 M58 86 L36 74'
      : view.id === 'knee_push_up'
        ? 'M26 62 L60 72 L76 88 L94 78 M26 62 L26 88'
        : 'M22 60 L64 68 L100 82 M22 60 L22 88'
  return (
    <svg className="cam-ghost" viewBox="0 0 120 100" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <path d={path} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="3 6" />
      <circle cx={view.id === 'squat' ? 70 : view.id === 'sit_up' ? 30 : 14} cy={view.id === 'squat' ? 10 : view.id === 'sit_up' ? 74 : 56} r="6" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="3 4" />
    </svg>
  )
}

function CameraStateCard({ onOverride }: { onOverride?: (() => void) | undefined }): React.JSX.Element | null {
  const camera = useApp((s) => s.camera)
  const model = useApp((s) => s.model)
  const overrideBtn = onOverride ? <button className="btn" onClick={onOverride}>Count reps myself</button> : null
  if (camera.status === 'live' && model.status === 'loading') {
    return (
      <div className="camcard" role="status"><h3>Warming up the tracker…</h3><p>Loading the pose model on this computer. It doesn't need the internet.</p><div className="loadbar"><i /></div></div>
    )
  }
  if (camera.status === 'live' && model.status === 'error') {
    return (
      <div className="camcard" role="alert"><h3>The tracker couldn't start</h3><p>{model.error}</p>
        <div className="row"><button className="btn primary" onClick={() => void engine.setModel(model.variant)}>Try again</button>{overrideBtn}</div></div>
    )
  }
  switch (camera.status) {
    case 'live':
    case 'idle':
      return null
    case 'starting':
      return <div className="camcard" role="status"><h3>Starting your camera…</h3></div>
    case 'permission_denied':
      return (
        <div className="camcard" role="alert" data-state="permission-denied">
          <h3>Ready Up needs your camera to count reps</h3>
          <p>{camera.message}</p>
          <div className="row">
            <button className="btn primary" onClick={() => void window.readyup.openCameraSettings()}>Open camera settings</button>
            <button className="btn" onClick={() => void engine.retryCamera()}>Try again</button>
            {overrideBtn}
          </div>
        </div>
      )
    case 'disconnected':
      return (
        <div className="camcard" role="alert" data-state="disconnected">
          <h3>Paused at {useApp.getState().total}</h3>
          <p>{camera.message}</p>
          <div className="row"><button className="btn primary" onClick={() => void engine.retryCamera()}>Reconnect</button>{overrideBtn}</div>
        </div>
      )
    default:
      return (
        <div className="camcard" role="alert" data-state={camera.status}>
          <h3>{camera.status === 'not_found' ? 'No camera found' : camera.status === 'stalled' ? 'The camera stopped' : 'The camera couldn\'t start'}</h3>
          <p>{camera.message}</p>
          <div className="row">
            <button className="btn primary" onClick={() => void engine.retryCamera()}>Try again</button>
            {camera.status === 'blocked_or_busy' && <button className="btn" onClick={() => void window.readyup.openCameraSettings()}>Open camera settings</button>}
            {overrideBtn}
          </div>
        </div>
      )
  }
}

// ---------------------------------------------------------------- camera setup

export function CameraSetup(): React.JSX.Element {
  const settings = useStore((s) => s.settings)
  const returnTo = useStore((s) => s.returnTo)
  const active = useStore((s) => s.active)
  const checks = useApp((s) => s.setup)
  const devices = useApp((s) => s.devices)
  const camera = useApp((s) => s.camera)
  const mirror = useApp((s) => s.mirror)
  const [phoneHelp, setPhoneHelp] = useState(false)
  const exerciseId = active?.phase === 'move' ? active.move.exerciseId : settings.routine.exerciseId
  const def = exerciseById(exerciseId)
  const allPass = !!checks && checks.every((c) => c.pass)
  const leave = (): void => C.go(returnTo ?? 'lobby')

  useEffect(() => {
    if (useApp.getState().exerciseId !== exerciseId) engine.setExercise(exerciseId)
  }, [exerciseId])
  useKeys({ Enter: () => (allPass ? void C.setupPassed() : undefined), Escape: leave })

  return (
    <Shell title="Camera setup">
      <section className="setup">
        <div className="setup-cam">
          <CameraView ghost={exerciseId} />
          <p className="fine">Line up roughly with the dashed outline. {def.view === 'side' ? 'Side-on, about 2–3 m away, camera near hip height.' : 'Side-on or at an angle, about 2–3 m away.'}</p>
        </div>
        <div className="setup-side">
          <p className="eyebrow">Let's set up your camera</p>
          <h1 className="h1">For {def.name.toLowerCase()} {def.beta && <Beta />}</h1>
          <ul className="checks" aria-label="Camera checks" aria-live="polite">
            {(checks ?? []).map((c) => (
              <li key={c.id} className={c.pass ? 'pass' : 'hint'}>
                <span className="dot" aria-hidden="true">{c.pass ? '✓' : '!'}</span>
                <span><strong>{c.label}</strong><small>{c.hint}</small></span>
              </li>
            ))}
            {!checks && <li className="hint"><span className="dot" aria-hidden="true">…</span><span><strong>Looking for you</strong><small>{camera.status === 'live' ? 'Step into view.' : 'Starting the camera.'}</small></span></li>}
          </ul>
          <label className="field">
            <span className="field-label">Camera</span>
            <select value={camera.deviceId ?? ''} onChange={(e) => void engine.selectCamera(e.target.value)} disabled={devices.length === 0}>
              {devices.length === 0 && <option value="">No cameras found</option>}
              {devices.map((d) => <option key={d.deviceId} value={d.deviceId}>{d.label}</option>)}
            </select>
          </label>
          <div className="row">
            <label className="check"><input type="checkbox" checked={mirror} onChange={(e) => void engine.setMirror(e.target.checked)} /> Mirror preview</label>
            <button className="btn link" onClick={() => setPhoneHelp(true)}>Use your phone as a camera</button>
          </div>
          <div className="row stick-bottom">
            <button className="btn primary big" disabled={!allPass} onClick={() => void C.setupPassed()}>I'm set <Kbd>Enter</Kbd></button>
            <button className="btn ghost" onClick={leave}>{returnTo === 'move' ? 'Continue anyway' : 'Back'}</button>
          </div>
        </div>
      </section>
      <PhoneHelp open={phoneHelp} onClose={() => setPhoneHelp(false)} />
    </Shell>
  )
}

export function PhoneHelp({ open, onClose }: { open: boolean; onClose: () => void }): React.JSX.Element {
  return (
    <Sheet open={open} title="Use your phone as a camera" onClose={onClose} actions={<button className="btn primary" onClick={onClose}>Got it</button>}>
      <p>Ready Up can use any camera Windows lists as a webcam. When your phone shows up in the camera list, choose it.</p>
      <ul className="plain">
        <li><strong>iPhone:</strong> install a webcam app on both the phone and the PC (for example Camo, iVCam or DroidCam). Windows has no built-in iPhone webcam option.</li>
        <li><strong>Android 14 or newer:</strong> plug it in with USB and choose "Webcam" in the USB notification. No app needed.</li>
        <li><strong>Android on Windows 11:</strong> Phone Link can use the phone as a connected camera.</li>
      </ul>
      <p className="fine">Prop the phone in landscape, 2–3 m away, side-on, around hip height. Those apps have their own terms and privacy policies.</p>
    </Sheet>
  )
}

// ---------------------------------------------------------------- move

export function Move(): React.JSX.Element {
  const settings = useStore((s) => s.settings)
  const active = useStore((s) => s.active)
  const snap = useApp((s) => s.snapshot)
  const hint = useApp((s) => s.hint)
  const th = useApp((s) => s.thresholds)
  const camera = useApp((s) => s.camera)
  const lastEvent = useApp((s) => s.repLog[0])
  const [overrideOpen, setOverrideOpen] = useState(false)

  useKeys({ '+': () => engine.correct(1), '=': () => engine.correct(1), '-': () => engine.correct(-1), o: () => setOverrideOpen(true) })

  if (!active || active.phase !== 'move') return <Shell title="Move"><p className="lead">Loading…</p></Shell>
  const def = exerciseById(active.move.exerciseId)
  const total = moveTotal(active.move)
  const net = total - active.move.cameraCounted
  const primary = snap?.signals.primary ?? null
  const depth = primary === null ? 0 : Math.max(0, Math.min(1, (th.top - primary) / (th.top - th.bottom)))
  const recent = lastEvent && Date.now() - lastEvent.t < 4000 && lastEvent.outcome !== 'counted' ? lastEvent.message : null

  return (
    <Shell title={`${total} of ${active.move.target} ${def.copy.unit}`} bar={<ReadyCheck {...slotsFor(settings, active, C.now())} size="slim" />}>
      <section className="move">
        <div className="move-cam"><CameraView onOverride={() => setOverrideOpen(true)} /></div>
        <aside className="move-side" aria-label="Count">
          <div className="move-ex">
            <label className="field inline">
              <span className="field-label">Exercise</span>
              <select value={def.id} onChange={(e) => void C.switchExercise(e.target.value)} aria-describedby="switch-note">
                {EXERCISE_LIST.map((e) => <option key={e.id} value={e.id}>{e.name}{e.beta ? ' (Beta)' : ''}</option>)}
              </select>
            </label>
            {def.beta && <Beta />}
            <span id="switch-note" className="sr-only">Switching exercise starts the count again.</span>
          </div>
          <div className="count" aria-live="polite" aria-atomic="true">
            <span className="count-n" data-testid="move-total">{total}</span>
            <span className="count-of">/ {active.move.target}</span>
            <span className="count-k">{def.copy.unit}</span>
          </div>
          <p className="fine" data-testid="move-breakdown">{active.move.cameraCounted} camera-counted{active.move.corrections.length ? ` · ${net >= 0 ? '+' : ''}${net} by hand` : ''}</p>
          <div className="gauge" aria-label={primary === null ? 'Depth: waiting' : `${def.copy.primaryLabel} ${Math.round(primary)} degrees`} role="img">
            <div className="gauge-bar"><i style={{ width: `${depth * 100}%` }} /><b /></div>
            <div className="gauge-lbl"><span>up · {th.top}°</span><span>{primary === null ? '—' : `${Math.round(primary)}°`}</span><span>{th.bottom}° · depth</span></div>
          </div>
          <p className="say" data-testid="move-hint">{camera.status === 'live' || useApp.getState().source === 'sim' ? (recent ?? hint) : 'Waiting for the camera.'}</p>
          <div className="row">
            <button className="btn" onClick={() => engine.correct(-1)} aria-label="Correct the count: minus one">−1 <Kbd>-</Kbd></button>
            <button className="btn" onClick={() => engine.correct(1)} aria-label="Correct the count: plus one">+1 <Kbd>+</Kbd></button>
          </div>
          <div className="row">
            <button className="btn ghost" onClick={() => setOverrideOpen(true)}>Can't use the camera? <Kbd>O</Kbd></button>
            <button className="btn link" onClick={() => C.go('setup', 'move')}>Camera setup</button>
          </div>
        </aside>
      </section>
      <OverrideSheet open={overrideOpen} onClose={() => setOverrideOpen(false)} target={active.move.target} unit={def.copy.unit} />
    </Shell>
  )
}

function OverrideSheet({ open, onClose, target, unit }: { open: boolean; onClose: () => void; target: number; unit: string }): React.JSX.Element {
  const [reason, setReason] = useState<'injury' | 'accessibility' | 'camera' | 'other' | null>(null)
  const [choice, setChoice] = useState<'self_report' | 'skip'>('self_report')
  const [count, setCount] = useState(target)
  const reasons: Array<[typeof reason & string, string]> = [['injury', 'Injury'], ['accessibility', 'Accessibility needs'], ['camera', 'Camera isn\'t working'], ['other', 'Other']]
  return (
    <Sheet
      open={open}
      title="Use an override"
      onClose={onClose}
      actions={<>
        <button className="btn" onClick={onClose}>Back to counting</button>
        <button className="btn primary" disabled={!reason} onClick={() => {
          if (!reason) return
          onClose()
          void C.override({ reason, choice, selfReported: choice === 'self_report' ? count : null })
        }}>Use override</button>
      </>}
    >
      <p>This unlocks Launch and is recorded as an override in your history. Reps you enter here are kept separate and never added to your camera-counted total.</p>
      <fieldset className="radios">
        <legend className="field-label">Why?</legend>
        {reasons.map(([id, label]) => (
          <label key={id} className="radio"><input type="radio" name="override-reason" checked={reason === id} onChange={() => setReason(id)} /> {label}</label>
        ))}
      </fieldset>
      <fieldset className="radios">
        <legend className="field-label">What happens today?</legend>
        <label className="radio"><input type="radio" name="override-choice" checked={choice === 'self_report'} onChange={() => setChoice('self_report')} /> I'll enter my own count</label>
        {choice === 'self_report' && (
          <label className="field inline indent">
            <span className="field-label">{unit}</span>
            <input type="number" min={0} max={1000} value={count} onChange={(e) => setCount(Math.max(0, Math.min(1000, Number(e.target.value) || 0)))} />
          </label>
        )}
        <label className="radio"><input type="radio" name="override-choice" checked={choice === 'skip'} onChange={() => setChoice('skip')} /> Skip moving today</label>
      </fieldset>
    </Sheet>
  )
}
