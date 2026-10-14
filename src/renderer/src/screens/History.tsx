import { useState } from 'react'
import { EXERCISE_NAMES, exerciseById } from '@readyup/exercise'
import { formatClock, weekStrip, weekTotals, type SessionRecord } from '@readyup/session'
import * as C from '../state/controller'
import { useStore } from '../state/store'
import { Sheet, Shell, useKeys } from '../ui/kit'
import { moveSummary, taskWord } from './common'

export function History(): React.JSX.Element {
  const history = useStore((s) => s.history)
  const [open, setOpen] = useState<string | null>(null)
  useKeys({ Escape: () => C.go('lobby') })
  const t = C.now()
  const days = weekStrip(history, t)
  const totals = weekTotals(history, t)
  const recent = [...history].sort((a, b) => b.completedAt - a.completedAt).slice(0, 30)
  const selected = history.find((s) => s.id === open) ?? null
  return (
    <Shell title="History">
      <section className="history">
        <p className="eyebrow">Last 7 days</p>
        <h1 className="h1">{totals.readyChecks === 0 ? 'Your first ready check is waiting.' : `${totals.readyChecks} ready check${totals.readyChecks === 1 ? '' : 's'} this week`}</h1>
        <ol className="week" aria-label="Ready checks per day">
          {days.map((d) => (
            <li key={d.key} className={`${d.isToday ? 'today' : ''} ${d.readyChecks ? 'has' : ''}`} aria-label={`${d.label}: ${d.readyChecks} ready check${d.readyChecks === 1 ? '' : 's'}`}>
              <span className="day-mark" aria-hidden="true">{d.readyChecks > 1 ? d.readyChecks : ''}</span>
              <span className="day-label" aria-hidden="true">{d.label}</span>
            </li>
          ))}
        </ol>
        <p className="quiet-line">
          {Math.round(totals.focusMs / 60000)} min focused (measured)
          {Object.entries(totals.cameraReps).filter(([, n]) => n > 0).map(([id, n]) => ` · ${n} ${exerciseById(id).copy.unit} camera-counted`).join('')}
          {totals.corrections ? ` · ${totals.corrections} correction${totals.corrections === 1 ? '' : 's'}` : ''}
          {totals.overrides ? ` · ${totals.overrides} override${totals.overrides === 1 ? '' : 's'}` : ''}
          {totals.gameSessions ? ` · ${totals.gameSessions} game session${totals.gameSessions === 1 ? '' : 's'}` : ''}
        </p>

        <h2 className="h2">Recent sessions</h2>
        {recent.length === 0 && <p className="lead muted">Finished sessions show up here as one mark per day. No charts to fill, no streak to protect.</p>}
        <ul className="sessions">
          {recent.map((s) => (
            <li key={s.id}>
              <button className="session-row" onClick={() => setOpen(s.id)}>
                <span className="when">{new Date(s.completedAt).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })}</span>
                <span className="what">{s.task || 'Focus session'}{s.status === 'ended_early' && <span className="badge">ended early</span>}{s.move.override && <span className="badge">override</span>}</span>
                <span className="mono">{formatClock(s.focus.measuredMs)} · {s.status === 'ready' ? (s.move.override ? 'override' : `${s.move.cameraCounted} ${exerciseById(s.move.exerciseId).copy.unit}`) : '—'}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
      <Details record={selected} onClose={() => setOpen(null)} />
    </Shell>
  )
}

function Details({ record, onClose }: { record: SessionRecord | null; onClose: () => void }): React.JSX.Element {
  const r = record
  return (
    <Sheet open={!!r} title="Session details" onClose={onClose} actions={<button className="btn primary" onClick={onClose}>Close</button>}>
      {r && (
        <>
          <dl className="details">
            <div><dt>Focus</dt><dd>{formatClock(r.focus.measuredMs)} measured of {formatClock(r.focus.targetMs)}{r.focus.pauseCount ? ` · ${r.focus.pauseCount} pause${r.focus.pauseCount === 1 ? '' : 's'}` : ''}{r.focus.endedEarly ? ' · ended early' : ''}</dd></div>
            <div><dt>Task</dt><dd>{r.task || '—'} · {taskWord(r.taskResult)}</dd></div>
            <div><dt>Move</dt><dd>{EXERCISE_NAMES[r.move.exerciseId] ?? r.move.exerciseId}: {moveSummary(r.move)}</dd></div>
            {r.move.corrections.length > 0 && (
              <div><dt>Corrections</dt><dd><ul className="plain">{r.move.corrections.map((c, i) => <li key={i}>{c.delta > 0 ? '+1' : '−1'} at {new Date(c.t).toLocaleTimeString()} (camera count was {c.cameraCountAtTime})</li>)}</ul></dd></div>
            )}
            <div><dt>Game sessions</dt><dd>{r.launches.length ? r.launches.map((l) => `${l.gameName}${l.ok ? '' : ' (didn\'t open)'} at ${new Date(l.at).toLocaleTimeString()}`).join(', ') : 'None launched from Ready Up'}</dd></div>
            <div><dt>Matches</dt><dd>{r.matches.length ? r.matches.map((m) => m.result ?? 'played').join(', ') : 'None logged'}</dd></div>
          </dl>
          <p className="fine">Ready Up can't see matches. Log them here if you want to keep track.</p>
          <div className="row" role="group" aria-label="Log a match">
            <span className="field-label">Log a match:</span>
            {(['win', 'loss', 'draw', null] as const).map((res) => (
              <button key={String(res)} className="btn small" onClick={() => void C.logMatch(r.id, res)}>{res ?? 'Played'}</button>
            ))}
          </div>
        </>
      )}
    </Sheet>
  )
}
