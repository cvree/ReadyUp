import { useEffect, useState } from 'react'
import { EXERCISE_LIST } from '@readyup/exercise'
import * as C from '../state/controller'
import { useStore } from '../state/store'
import { Kbd, ReadyCheck, Stepper, useKeys } from '../ui/kit'
import { GamesEditor } from './Games'

const STEPS = ['Welcome', 'Your routine', 'Your games', 'Camera'] as const

/** First run: under a minute, every step skippable. */
export function Onboarding(): React.JSX.Element {
  const settings = useStore((s) => s.settings)
  const [step, setStep] = useState(0)
  const r = settings.routine
  const next = (): void => (step < STEPS.length - 1 ? setStep(step + 1) : void C.finishOnboarding())
  useKeys({ Enter: next })
  useEffect(() => {
    document.title = `${STEPS[step]} · Ready Up`
    document.getElementById('onb-primary')?.focus()
  }, [step])

  return (
    <div className="onboarding">
      <header className="onb-top">
        <span className="wordmark static">READY<span>UP</span></span>
        <ol className="onb-steps" aria-label="Setup steps">
          {STEPS.map((s, i) => <li key={s} className={i === step ? 'on' : i < step ? 'done' : ''} aria-current={i === step ? 'step' : undefined}>{s}</li>)}
        </ol>
        <button className="btn ghost small" onClick={() => void C.finishOnboarding()}>Skip setup</button>
      </header>
      <main className="onb-body">
        {step === 0 && (
          <section className="onb-card">
            <p className="eyebrow">Welcome</p>
            <h1 className="display">Study, move,<br />then <em>play.</em></h1>
            <ReadyCheck focus={{ state: 'active', value: '25:00', progress: 0.35 }} move={{ state: 'idle', value: '10 push-ups' }} play={{ state: 'locked', value: 'Your game' }} />
            <p className="lead">Each session is a ready check. Focus on your study, do a short set counted by your webcam, and your game's Launch button unlocks. Everything stays on this computer.</p>
          </section>
        )}
        {step === 1 && (
          <section className="onb-card">
            <p className="eyebrow">Your routine</p>
            <h1 className="h1">This is a good place to start.</h1>
            <div className="set-grid">
              <Stepper label="Focus" value={r.focusMinutes} min={5} max={120} step={5} unit="min" onChange={(v) => void C.updateSettings({ routine: { ...r, focusMinutes: v } })} />
              <Stepper label="Reps" value={r.reps} min={1} max={100} unit="reps" onChange={(v) => void C.updateSettings({ routine: { ...r, reps: v } })} />
              <label className="field">
                <span className="field-label">Exercise</span>
                <select value={r.exerciseId} onChange={(e) => void C.updateSettings({ routine: { ...r, exerciseId: e.target.value } })}>
                  {EXERCISE_LIST.map((e) => <option key={e.id} value={e.id}>{e.name}{e.beta ? ' (Beta)' : ''}</option>)}
                </select>
              </label>
            </div>
            <p className="fine">You can change these any time in Settings.</p>
          </section>
        )}
        {step === 2 && (
          <section className="onb-card">
            <p className="eyebrow">Your games</p>
            <h1 className="h1">Which game do you play?</h1>
            <p className="lead">Choose the shortcut you already use, like the Overwatch 2 or Marvel Rivals shortcut on your desktop, or paste a launcher link.</p>
            <GamesEditor />
            <p className="fine honest">Ready Up unlocks its own Launch button. It can't stop you opening your game another way. It's a promise you make to yourself.</p>
          </section>
        )}
        {step === 3 && (
          <section className="onb-card">
            <p className="eyebrow">Camera</p>
            <h1 className="h1">Your webcam counts your reps.</h1>
            <p className="lead">The pose tracker runs on this computer. It looks at where your joints are and lets the picture go: nothing is saved or uploaded. Windows may ask for camera permission.</p>
            <div className="row">
              <button className="btn" onClick={async () => { await C.updateSettings({ onboarded: true }); C.go('setup', 'lobby') }}>Check my camera now</button>
            </div>
            <p className="fine">Or skip this: you'll check your camera before your first Move.</p>
          </section>
        )}
      </main>
      <footer className="onb-foot">
        {step > 0 && <button className="btn ghost" onClick={() => setStep(step - 1)}>Back</button>}
        <button id="onb-primary" className="btn primary big" onClick={next}>{step === 0 ? 'Get started' : step === STEPS.length - 1 ? 'Finish' : 'Continue'} <Kbd>Enter</Kbd></button>
      </footer>
    </div>
  )
}
