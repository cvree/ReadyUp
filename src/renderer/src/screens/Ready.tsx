import { useEffect, useRef } from 'react'
import { exerciseById } from '@readyup/exercise'
import { formatClock } from '@readyup/session'
import * as C from '../state/controller'
import { useStore } from '../state/store'
import { Kbd, ReadyCheck, Shell, useKeys } from '../ui/kit'
import { moveSummary, slotsFor, taskWord } from './common'

/** The completion moment: brief (≤ 1.1 s), never blocks Enter, with an equally deliberate reduced-motion version. */
export function Ready(): React.JSX.Element {
  const settings = useStore((s) => s.settings)
  const active = useStore((s) => s.active)
  const reduced = useStore((s) => s.reducedMotion)
  const launchRef = useRef<HTMLButtonElement>(null)
  const game = C.chosenGame(settings)
  useKeys({ Enter: () => void C.launch(), Escape: () => C.notNow() })
  useEffect(() => {
    launchRef.current?.focus()
  }, [])
  if (!active) return <Shell title="Ready"><p className="lead">Loading…</p></Shell>
  const unit = exerciseById(active.move.exerciseId).copy.unit
  const repsLine = active.move.override ? 'override' : `${active.move.cameraCounted} camera-counted`
  return (
    <Shell title="Ready">
      <section className={`ready ${reduced ? 'calm' : 'animate'}`}>
        <ReadyCheck {...slotsFor(settings, active, C.now())} lockIn />
        <h1 className="readyword">READY<em>.</em></h1>
        <dl className="summary">
          <div><dt>{formatClock(active.focus.accumulatedMs)}</dt><dd>focused{active.focus.endedEarly ? ' (ended early)' : ''}</dd></div>
          <div><dt>{active.task || 'Focus'}</dt><dd>{taskWord(active.taskResult)}</dd></div>
          <div><dt>{active.move.override ? active.move.override.selfReported ?? '—' : active.move.cameraCounted + active.move.corrections.reduce((s, c) => s + c.delta, 0)}</dt><dd>{unit}, {repsLine}</dd></div>
        </dl>
        <p className="fine">{moveSummary(active.move)}</p>
        <div className="row">
          <button ref={launchRef} className="btn gold big launch" onClick={() => void C.launch()}>{game ? `Launch ${game.name}` : 'Add a game to launch'} <Kbd>Enter</Kbd></button>
          <button className="btn ghost" onClick={() => C.notNow()}>Not now</button>
        </div>
        <p className="fine">Ready Up opens your game's shortcut. It doesn't block your game any other way.</p>
      </section>
    </Shell>
  )
}
