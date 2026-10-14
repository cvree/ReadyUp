import { useState } from 'react'
import { EXERCISE_LIST } from '@readyup/exercise'
import * as C from '../state/controller'
import { useStore } from '../state/store'
import { playReadyChord } from '../state/sound'
import { Sheet, Shell, Stepper, useKeys } from '../ui/kit'
import { PhoneHelp } from './Camera'
import { GamesEditor } from './Games'

export function Settings(): React.JSX.Element {
  const settings = useStore((s) => s.settings)
  const [phone, setPhone] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [exported, setExported] = useState<string | null>(null)
  useKeys({ Escape: () => C.go('lobby') })
  const r = settings.routine
  const setRoutine = (patch: Partial<typeof r>): void => void C.updateSettings({ routine: { ...r, ...patch } })

  return (
    <Shell title="Settings">
      <section className="settings">
        <h1 className="h1">Settings</h1>

        <div className="set-group" aria-labelledby="set-routine">
          <h2 id="set-routine" className="h2">Your routine</h2>
          <div className="set-grid">
            <Stepper label="Focus" value={r.focusMinutes} min={5} max={120} step={5} unit="min" onChange={(v) => setRoutine({ focusMinutes: v })} />
            <Stepper label="Reps" value={r.reps} min={1} max={100} unit="reps" onChange={(v) => setRoutine({ reps: v })} />
            <label className="field">
              <span className="field-label">Exercise</span>
              <select value={r.exerciseId} onChange={(e) => setRoutine({ exerciseId: e.target.value })}>
                {EXERCISE_LIST.map((e) => <option key={e.id} value={e.id}>{e.name}{e.beta ? ' (Beta)' : ''}</option>)}
              </select>
            </label>
          </div>
          <p className="fine">Rep standards are provisional and visible in Diagnostics. Knee push-ups are their own exercise, never counted as failed push-ups. Sit-up detection is in Beta.</p>
        </div>

        <div className="set-group" aria-labelledby="set-games">
          <h2 id="set-games" className="h2">Games</h2>
          <p className="fine">The selected game is what the Launch button opens. Ready Up opens your shortcut the same way a double-click does; it doesn't block your game any other way, and it never touches the game itself.</p>
          <GamesEditor />
        </div>

        <div className="set-group" aria-labelledby="set-camera">
          <h2 id="set-camera" className="h2">Camera</h2>
          <div className="row tight">
            <button className="btn" onClick={() => C.go('setup', 'settings')}>Open camera setup</button>
            <button className="btn ghost" onClick={() => setPhone(true)}>Use your phone as a camera</button>
          </div>
          <p className="fine">The camera only turns on during camera setup, Move and Diagnostics. Video stays on this computer and is never saved.</p>
        </div>

        <div className="set-group" aria-labelledby="set-a11y">
          <h2 id="set-a11y" className="h2">Motion and sound</h2>
          <fieldset className="radios">
            <legend className="field-label">Animations</legend>
            {([['system', 'Follow Windows setting'], ['reduced', 'Reduce motion'], ['full', 'Full motion']] as const).map(([v, label]) => (
              <label key={v} className="radio"><input type="radio" name="motion" checked={settings.motion === v} onChange={() => void C.updateSettings({ motion: v })} /> {label}</label>
            ))}
          </fieldset>
          <div className="row tight">
            <label className="check"><input type="checkbox" checked={settings.sound} onChange={(e) => void C.updateSettings({ sound: e.target.checked })} /> Play a sound when you're ready</label>
            <button className="btn small ghost" onClick={() => playReadyChord()}>Preview sound</button>
          </div>
        </div>

        <div className="set-group" aria-labelledby="set-data">
          <h2 id="set-data" className="h2">Your data</h2>
          <p className="fine">Everything stays in a folder on this PC. There's no account and nothing is uploaded.</p>
          <div className="row tight">
            <button className="btn" onClick={async () => {
              const res = await window.readyup.exportHistory()
              setExported(res.ok ? `Saved to ${res.path}` : res.reason === 'cancelled' ? null : `Couldn't save: ${res.message ?? ''}`)
            }}>Export history…</button>
            <button className="btn" onClick={() => C.go('diagnostics')}>Diagnostics</button>
            <button className="btn danger" onClick={() => setConfirmDelete(true)}>Delete everything…</button>
          </div>
          {exported && <p className="fine" role="status">{exported}</p>}
        </div>
      </section>
      <PhoneHelp open={phone} onClose={() => setPhone(false)} />
      <Sheet
        open={confirmDelete}
        title="Delete everything?"
        onClose={() => setConfirmDelete(false)}
        actions={<>
          <button className="btn" onClick={() => setConfirmDelete(false)}>Keep my data</button>
          <button className="btn danger" onClick={() => { setConfirmDelete(false); void C.deleteEverything() }}>Delete everything</button>
        </>}
      >
        <p>This removes your history, the session in progress, your games and your settings from this PC. It can't be undone.</p>
      </Sheet>
    </Shell>
  )
}
