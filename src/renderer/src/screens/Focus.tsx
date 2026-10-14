import { useEffect, useState } from 'react'
import { elapsedMs, formatClock, remainingMs } from '@readyup/session'
import * as C from '../state/controller'
import { useStore } from '../state/store'
import { Kbd, ReadyCheck, Sheet, Shell, useKeys } from '../ui/kit'
import { slotsFor } from './common'

export function Focus(): React.JSX.Element {
  const settings = useStore((s) => s.settings)
  const active = useStore((s) => s.active)
  const slept = useStore((s) => s.sleptDuringFocus)
  const [, setTick] = useState(0)
  const [confirmEnd, setConfirmEnd] = useState(false)

  useEffect(() => {
    const id = window.setInterval(() => {
      C.focusTick()
      setTick((n) => n + 1)
    }, 250)
    return () => window.clearInterval(id)
  }, [])

  useKeys({ ' ': () => C.togglePause(), Escape: () => setConfirmEnd(true) })

  if (!active || active.phase !== 'focus') return <Shell title="Focus" quiet><p className="lead">Loading…</p></Shell>
  const t = C.now()
  const running = active.focus.runningSince !== null
  const remaining = remainingMs(active.focus, t)
  const progress = elapsedMs(active.focus, t) / active.focus.targetMs
  return (
    <Shell title={`${formatClock(remaining)} focus`} quiet bar={<ReadyCheck {...slotsFor(settings, active, t)} size="slim" />}>
      <section className="focus">
        <p className="eyebrow moon">{running ? 'Focusing on' : 'Paused'}</p>
        <p className="task-name">{active.task || 'Your focus session'}</p>
        <div className="timer" role="timer" aria-live="off" aria-label={`${formatClock(remaining)} remaining`}>{formatClock(remaining)}</div>
        <div className="progress" aria-hidden="true"><i style={{ width: `${Math.min(100, progress * 100)}%` }} /></div>
        {slept && <p className="notice" role="status">Paused while your PC was asleep. Resume when you're back.</p>}
        <div className="row">
          <button className="btn primary" onClick={() => C.togglePause()}>{running ? 'Pause' : 'Resume'} <Kbd>Space</Kbd></button>
          <button className="btn ghost" onClick={() => setConfirmEnd(true)}>End early</button>
          <p className="fine push-right">Time is measured. Pauses don't count.</p>
        </div>
      </section>
      <Sheet
        open={confirmEnd}
        title="End focus early?"
        onClose={() => setConfirmEnd(false)}
        actions={<>
          <button className="btn" onClick={() => setConfirmEnd(false)}>Keep going</button>
          <button className="btn primary" onClick={() => { setConfirmEnd(false); void C.completeFocus(true) }}>End focus now</button>
        </>}
      >
        <p>{formatClock(elapsedMs(active.focus, t))} measured so far. Your history will show this session ended early, and you can still continue to Move.</p>
      </Sheet>
    </Shell>
  )
}

export function Review(): React.JSX.Element {
  const settings = useStore((s) => s.settings)
  const active = useStore((s) => s.active)
  useKeys({ '1': () => void C.answer('done'), '2': () => void C.answer('partly'), '3': () => void C.answer('not_yet') })
  useEffect(() => {
    document.getElementById('answer-done')?.focus()
  }, [])
  if (!active) return <Shell title="Focus done"><p className="lead">Loading…</p></Shell>
  return (
    <Shell title="Focus done" bar={<ReadyCheck {...slotsFor(settings, active, C.now())} size="slim" />}>
      <section className="review">
        <p className="eyebrow moon">Focus done</p>
        <h1 className="display">{formatClock(active.focus.accumulatedMs)} focused.</h1>
        {active.focus.endedEarly && <p className="lead muted">You ended early. That's recorded as it happened.</p>}
        <h2 className="question">{active.task ? <>Did you finish <em>{active.task}</em>?</> : 'How did it go?'}</h2>
        <div className="choices" role="group" aria-label="Your answer">
          <button id="answer-done" className="btn choice" onClick={() => void C.answer('done')}><Kbd>1</Kbd> Yes</button>
          <button className="btn choice" onClick={() => void C.answer('partly')}><Kbd>2</Kbd> Partly</button>
          <button className="btn choice" onClick={() => void C.answer('not_yet')}><Kbd>3</Kbd> Not this time</button>
        </div>
        <p className="fine">Your answer is what's recorded. Ready Up can measure the time, not the studying.</p>
      </section>
    </Shell>
  )
}
