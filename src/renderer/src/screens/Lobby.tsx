import { useEffect, useState } from 'react'
import { elapsedMs, formatClock, remainingMs, weekTotals } from '@readyup/session'
import * as C from '../state/controller'
import { useStore } from '../state/store'
import { Kbd, ReadyCheck, Shell, useKeys } from '../ui/kit'
import { partOfDay, routineMove, slotsFor } from './common'

export function Lobby(): React.JSX.Element {
  const settings = useStore((s) => s.settings)
  const active = useStore((s) => s.active)
  const recovered = useStore((s) => s.recovered)
  const history = useStore((s) => s.history)
  const [task, setTask] = useState('')
  const t = C.now()
  const week = weekTotals(history, t)
  const game = C.chosenGame(settings)
  const isReady = active?.phase === 'ready'
  const inProgress = active && !isReady

  useKeys({
    Enter: () => (isReady ? void C.launch() : inProgress ? C.continueActive() : void C.startFocus(task)),
    h: () => C.go('history'),
    e: () => C.go('settings')
  }, ['Enter'])

  useEffect(() => {
    if (!inProgress && !isReady) document.getElementById('task')?.focus()
  }, [inProgress, isReady])

  const slots = slotsFor(settings, active, t)
  return (
    <Shell title="Home">
      <section className="lobby">
        <p className="eyebrow">{partOfDay(t)}</p>

        {isReady && (
          <>
            <h1 className="display">Ready.</h1>
            <ReadyCheck {...slots} />
            <div className="row">
              <button className="btn gold big" onClick={() => void C.launch()}>{game ? `Launch ${game.name}` : 'Add a game'} <Kbd>Enter</Kbd></button>
              <button className="btn" onClick={() => void C.discardActive()}>Start a new ready check</button>
            </div>
          </>
        )}

        {inProgress && active && (
          <>
            <h1 className="display">Pick up where you left off.</h1>
            <ReadyCheck {...slots} />
            <div className="card resume" role="region" aria-label="Session in progress">
              {active.phase === 'focus' ? (
                <p><strong>{formatClock(remainingMs(active.focus, t))}</strong> left on {active.task ? <em>{active.task}</em> : 'your focus session'}. {formatClock(elapsedMs(active.focus, t))} measured so far.{recovered && active.focus.pauses.at(-1)?.reason === 'crash' ? ' Ready Up closed unexpectedly, so only time up to its last save was counted.' : ''}</p>
              ) : (
                <p>Your focus is done{active.task ? <> for <em>{active.task}</em></> : ''}. Next: {active.phase === 'review' ? 'a quick question' : active.phase === 'move' ? 'move' : 'play'}.</p>
              )}
              <div className="row">
                <button className="btn primary big" onClick={() => C.continueActive()}>{active.phase === 'focus' ? 'Resume focus' : 'Continue'} <Kbd>Enter</Kbd></button>
                <button className="btn" onClick={() => void C.discardActive()}>Discard</button>
              </div>
            </div>
          </>
        )}

        {!active && (
          <>
            <h1 className="display">Next up: focus.</h1>
            <label className="task-field">
              <span className="field-label">What are you studying?</span>
              <input id="task" value={task} maxLength={200} placeholder="Chapter 4 problems, essay outline, flashcards…" onChange={(e) => setTask(e.target.value)} autoComplete="off" />
            </label>
            <ReadyCheck {...slots} />
            <div className="row">
              <button className="btn primary big" onClick={() => void C.startFocus(task)}>Start focus <Kbd>Enter</Kbd></button>
              <button className="btn ghost" onClick={() => C.go('settings')}>Edit routine</button>
            </div>
            <p className="quiet-line">
              {week.readyChecks === 0
                ? 'Your first ready check is waiting.'
                : `${week.readyChecks} ready check${week.readyChecks === 1 ? '' : 's'} this week · ${Math.round(week.focusMs / 60000)} min focused`}
              {' · '}{settings.routine.focusMinutes} min focus, then {routineMove(settings)}
            </p>
          </>
        )}
      </section>
    </Shell>
  )
}
