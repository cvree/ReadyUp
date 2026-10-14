import { useEffect } from 'react'
import { useApp } from './engine/store'
import * as C from './state/controller'
import { useStore } from './state/store'
import { CameraSetup, Move } from './screens/Camera'
import { Diagnostics } from './screens/Diagnostics'
import { Focus, Review } from './screens/Focus'
import { History } from './screens/History'
import { Lobby } from './screens/Lobby'
import { Onboarding } from './screens/Onboarding'
import { Ready } from './screens/Ready'
import { Settings } from './screens/Settings'

export function App(): React.JSX.Element {
  const screen = useStore((s) => s.screen)
  useEffect(() => {
    void C.boot()
    // Ctrl+Shift+D opens Diagnostics from anywhere.
    const onKey = (e: KeyboardEvent): void => {
      if (e.ctrlKey && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
        e.preventDefault()
        C.go('diagnostics')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  // Move focus to the new screen's heading for screen-reader and keyboard users, unless the screen
  // already put focus somewhere useful (the task field, the Launch button).
  useEffect(() => {
    const h = document.querySelector<HTMLElement>('main h1, .onboarding h1')
    const root = document.querySelector('main, .onboarding')
    const ae = document.activeElement
    const alreadyPlaced = ae && ae !== document.body && root?.contains(ae)
    if (h && !alreadyPlaced) {
      h.setAttribute('tabindex', '-1')
      h.focus({ preventScroll: true })
    }
  }, [screen])

  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      {screen === 'boot' && <div className="boot" aria-busy="true"><span className="wordmark static">READY<span>UP</span></span></div>}
      {screen === 'onboarding' && <Onboarding />}
      {screen === 'lobby' && <Lobby />}
      {screen === 'focus' && <Focus />}
      {screen === 'review' && <Review />}
      {screen === 'setup' && <CameraSetup />}
      {screen === 'move' && <Move />}
      {screen === 'ready' && <Ready />}
      {screen === 'history' && <History />}
      {screen === 'settings' && <Settings />}
      {screen === 'diagnostics' && <Diagnostics />}
      <Announcer />
    </>
  )
}

function Announcer(): React.JSX.Element {
  const announce = useApp((s) => s.announce)
  return <div className="sr-only" aria-live="polite">{announce}</div>
}
