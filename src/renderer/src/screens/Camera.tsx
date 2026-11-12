import { useEffect, useRef, useState, type ReactNode } from 'react'
import { EXERCISE_LIST, exerciseById } from '@readyup/exercise'
import { moveTotal } from '@readyup/session'
import { cameraDisplayName } from '../camera/CameraService'
import { engine, type FrameView } from '../engine/engine'
import { useApp } from '../engine/store'
import * as C from '../state/controller'
import { playRepTick } from '../state/sound'
import { useStore } from '../state/store'
import { containRect, drawPose } from '../ui/draw'
import { Beta, Kbd, ReadyCheck, Sheet, Shell, useKeys } from '../ui/kit'
import { slotsFor } from './common'

// ---------------------------------------------------------------- shared camera view

/** What the Move screen shows on top of the picture, big enough to read from across the room. */
export interface CameraHud {
  count: number
  target: number
  unit: string
  hint: string
}

const FLASH_MS = 650
const HANDS_FREE_SECONDS = 3

/**
 * Live camera with the skeleton overlay, a status line and quick controls (switch camera, mirror,
 * fill the window). The camera runs only while this is on screen.
 */
export function CameraView({ ghost, onOverride, hud, frameOk, overlay }: {
  ghost?: string
  onOverride?: () => void
  hud?: CameraHud
  /** Camera setup: corner marks that turn green when every check passes. */
  frameOk?: boolean
  overlay?: ReactNode
}): React.JSX.Element {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const mirror = useApp((s) => s.mirror)
  const source = useApp((s) => s.source)
  const deviceCount = useApp((s) => s.devices.length)
  const lastEvent = useApp((s) => s.repLog[0])
  const sound = useStore((s) => s.settings.sound)
  const [expanded, setExpanded] = useState(false)
  const [flash, setFlash] = useState<'counted' | 'missed' | null>(null)
  const mirrorRef = useRef(mirror)
  mirrorRef.current = mirror
  const live = source === 'live'
  const canSwitch = live && deviceCount > 1

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

  // A pulse around the picture for every rep: green when it counted, amber when it didn't.
  const seenEvent = useRef(lastEvent)
  useEffect(() => {
    if (!lastEvent || lastEvent === seenEvent.current) return
    seenEvent.current = lastEvent
    const counted = lastEvent.outcome === 'counted'
    setFlash(counted ? 'counted' : 'missed')
    if (counted && hud && sound) playRepTick(engine.tally.total >= hud.target)
    const id = window.setTimeout(() => setFlash(null), FLASH_MS)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reacts to new rep events only
  }, [lastEvent])

  // While the camera fills the window, the page behind it must not scroll or show a scrollbar.
  useEffect(() => {
    if (!expanded) return
    const root = document.documentElement
    const before = root.style.overflow
    root.style.overflow = 'hidden'
    return () => {
      root.style.overflow = before
    }
  }, [expanded])

  const toggleExpanded = (): void => setExpanded((v) => !v)
  const toggleMirror = (): void => void engine.setMirror(!useApp.getState().mirror)
  const switchCamera = (): void => void engine.cycleCamera()
  useKeys({
    f: toggleExpanded, F: toggleExpanded,
    ...(live ? { m: toggleMirror, M: toggleMirror } : {}),
    ...(canSwitch ? { c: switchCamera, C: switchCamera } : {}),
    ...(expanded ? { Escape: () => setExpanded(false) } : {})
  })

  return (
    <div className={`camview ${expanded ? 'expanded' : ''}`} ref={boxRef} data-flash={flash ?? undefined} data-expanded={expanded}>
      <video ref={videoRef} className={`camview-video ${mirror ? 'mirrored' : ''}`} hidden={!live} playsInline muted aria-label="Camera preview" />
      {ghost && <Ghost kind={ghost} />}
      <canvas ref={canvasRef} className="camview-overlay" aria-hidden="true" />
      {frameOk !== undefined && <div className="cam-frame" data-ok={frameOk} aria-hidden="true"><i /><i /><i /><i /></div>}
      <div className="cam-top">
        {live ? <CameraStatus /> : <span className="tag sim-tag">Simulated input</span>}
        <div className="cam-tools" role="group" aria-label="Camera controls">
          {canSwitch && (
            <button className="camtool" onClick={switchCamera} aria-label="Switch camera" title="Switch camera (C)">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l2-2.5h6L17 8h3v10H4z" /><path d="M9.5 12.5a2.5 2.5 0 0 1 4.6-1.3M14.5 13.5a2.5 2.5 0 0 1-4.6 1.3" /><path d="M14.3 9.6v1.8h-1.8M9.7 16.4v-1.8h1.8" /></svg>
            </button>
          )}
          {live && (
            <button className="camtool" onClick={toggleMirror} aria-label="Mirror preview" aria-pressed={mirror} title="Mirror preview (M)">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18" strokeDasharray="2 3" /><path d="M9 7 4 17h5zM15 7l5 10h-5z" /></svg>
            </button>
          )}
          <button className="camtool" onClick={toggleExpanded} aria-label="Fill the window with the camera" aria-pressed={expanded} title={expanded ? 'Back to normal size (F or Esc)' : 'Fill the window (F)'}>
            {expanded
              ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /></svg>
              : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>}
          </button>
        </div>
      </div>
      {hud && <Hud hud={hud} showHint={expanded} />}
      {overlay}
      {live && <CameraStateCard onOverride={onOverride} />}
    </div>
  )
}

/** One line that says whether the camera and the tracker are doing their job right now. */
function CameraStatus(): React.JSX.Element | null {
  const camera = useApp((s) => s.camera)
  const model = useApp((s) => s.model.status)
  const tracking = useApp((s) => s.snapshot?.tracking ?? null)
  const fps = useApp((s) => s.perf.fps)
  if (camera.status !== 'live') return <span />
  const state = model !== 'ready' ? 'wait' : tracking === 'ok' ? 'ok' : tracking === 'holding' ? 'wait' : 'none'
  const word = model !== 'ready' ? 'Warming up' : tracking === 'ok' ? 'Tracking you' : tracking === 'holding' ? 'Finding you' : 'Can\'t see you yet'
  const slow = fps !== null && fps < 15
  return (
    <div className="cam-status" data-testid="cam-status" data-tracking={state}>
      <span className="cam-dot" aria-hidden="true" />
      <strong>{word}</strong>
      <span className="cam-meta">{cameraDisplayName(camera.label)}{camera.width && camera.height ? ` · ${camera.width}×${camera.height}` : ''}</span>
      {fps !== null && model === 'ready' && <span className={`cam-meta ${slow ? 'slow' : ''}`}>{Math.round(fps)} fps{slow ? ' · slow' : ''}</span>}
    </div>
  )
}

/** The count on top of the picture. Decorative for assistive tech: the side panel says the same. */
function Hud({ hud, showHint }: { hud: CameraHud; showHint: boolean }): React.JSX.Element {
  const r = 44
  const len = 2 * Math.PI * r
  const done = Math.max(0, Math.min(1, hud.target ? hud.count / hud.target : 0))
  return (
    <div className="cam-hud" aria-hidden="true">
      <div className="hud-count">
        <svg viewBox="0 0 100 100"><circle cx="50" cy="50" r={r} className="hud-track" /><circle cx="50" cy="50" r={r} className="hud-arc" strokeDasharray={len} strokeDashoffset={len * (1 - done)} transform="rotate(-90 50 50)" /></svg>
        <span className="hud-n" key={hud.count}>{hud.count}</span>
      </div>
      <div className="hud-text">
        <span className="hud-of">of {hud.target} {hud.unit}</span>
        {showHint && <span className="hud-hint">{hud.hint}</span>}
      </div>
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
  // Hands-free: during a ready check, holding a good position starts the set without a keypress.
  // Touching anything on this screen means you're adjusting things, so it waits for you instead.
  const [handsFree, setHandsFree] = useState(returnTo === 'move')
  const [secs, setSecs] = useState<number | null>(null)
  const exerciseId = active?.phase === 'move' ? active.move.exerciseId : settings.routine.exerciseId
  const def = exerciseById(exerciseId)
  const allPass = !!checks && checks.every((c) => c.pass)
  const leave = (): void => C.go(returnTo ?? 'lobby')

  useEffect(() => {
    if (useApp.getState().exerciseId !== exerciseId) engine.setExercise(exerciseId)
  }, [exerciseId])
  useKeys({ Enter: () => (allPass ? void C.setupPassed() : undefined), Escape: leave })
  useEffect(() => {
    if (!handsFree || !allPass) {
      setSecs(null)
      return
    }
    setSecs(HANDS_FREE_SECONDS)
    const id = window.setInterval(() => setSecs((v) => (v === null ? null : Math.max(0, v - 1))), 1000)
    return () => window.clearInterval(id)
  }, [handsFree, allPass])
  useEffect(() => {
    if (secs === 0) void C.setupPassed()
  }, [secs])

  return (
    <Shell title="Camera setup">
      <section className="setup" onPointerDown={() => setHandsFree(false)}>
        <div className="setup-cam">
          <CameraView
            ghost={exerciseId}
            frameOk={allPass}
            overlay={secs !== null && secs > 0 ? <div className="cam-countdown" role="status"><span>{secs}</span><small>Hold it there. Starting by itself.</small></div> : null}
          />
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
          {handsFree && <p className="fine" data-testid="hands-free">Hands-free: once every check is green, hold the position for {HANDS_FREE_SECONDS} seconds and your set starts by itself.</p>}
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
  const say = camera.status === 'live' || useApp.getState().source === 'sim' ? (recent ?? hint) : 'Waiting for the camera.'

  return (
    <Shell title={`${total} of ${active.move.target} ${def.copy.unit}`} bar={<ReadyCheck {...slotsFor(settings, active, C.now())} size="slim" />}>
      <section className="move">
        <div className="move-cam"><CameraView onOverride={() => setOverrideOpen(true)} hud={{ count: total, target: active.move.target, unit: def.copy.unit, hint: say }} /></div>
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
          <p className="say" data-testid="move-hint">{say}</p>
          <div className="row">
            <button className="btn" onClick={() => engine.correct(-1)} aria-label="Correct the count: minus one">−1 <Kbd>-</Kbd></button>
            <button className="btn" onClick={() => engine.correct(1)} aria-label="Correct the count: plus one">+1 <Kbd>+</Kbd></button>
          </div>
          <div className="row">
            <button className="btn ghost" onClick={() => setOverrideOpen(true)}>Can't use the camera? <Kbd>O</Kbd></button>
            <button className="btn link" onClick={() => C.go('setup', 'move')}>Camera setup</button>
          </div>
          <p className="fine">On the picture: <Kbd>F</Kbd> fills the window, <Kbd>M</Kbd> mirrors, <Kbd>C</Kbd> switches camera.</p>
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
