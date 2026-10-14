import { useEffect, useId, useRef, type ReactNode } from 'react'
import * as C from '../state/controller'
import { useStore, type Screen } from '../state/store'

// ---------------------------------------------------------------- keyboard

type KeyMap = Partial<Record<string, (e: KeyboardEvent) => void>>

/**
 * Screen-level shortcuts. Ignored while typing in a field (except keys listed in `inFields`) and
 * while a dialog is open.
 */
export function useKeys(map: KeyMap, inFields: string[] = []): void {
  const ref = useRef(map)
  ref.current = map
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return
      if (document.querySelector('dialog[open]')) return
      const t = e.target as HTMLElement | null
      const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)
      if (typing && !inFields.includes(e.key)) return
      if (!typing && t && t.tagName === 'BUTTON' && (e.key === 'Enter' || e.key === ' ')) return
      const fn = ref.current[e.key]
      if (fn) {
        e.preventDefault()
        fn(e)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [inFields])
}

// ---------------------------------------------------------------- ready-check bar

export type SlotState = 'idle' | 'active' | 'done' | 'locked' | 'ready'
export interface Slot {
  state: SlotState
  value: string
  /** 0–1, shown as the slot's underline while active. */
  progress?: number
}

/**
 * The signature element: three slots for Focus, Move and Play. Only the slot edges are slanted;
 * all text stays level.
 */
export function ReadyCheck({ focus, move, play, size = 'large', lockIn = false }: { focus: Slot; move: Slot; play: Slot; size?: 'large' | 'slim'; lockIn?: boolean }): React.JSX.Element {
  const slots: Array<[string, string, Slot]> = [['focus', 'Focus', focus], ['move', 'Move', move], ['play', 'Play', play]]
  return (
    <ol className={`rc rc-${size} ${lockIn ? 'lockin' : ''}`} aria-label="Ready check">
      {slots.map(([key, label, s]) => (
        <li key={key} className={`rc-slot rc-${key} is-${s.state}`} aria-label={`${label}: ${s.value}, ${stateWord(s.state)}`}>
          <span className="rc-k" aria-hidden="true">{s.state === 'done' || s.state === 'ready' ? '✓ ' : ''}{label}</span>
          <span className="rc-v" aria-hidden="true">{s.value}</span>
          {s.state === 'active' && <span className="rc-fill" style={{ width: `${Math.round((s.progress ?? 0) * 100)}%` }} aria-hidden="true" />}
        </li>
      ))}
    </ol>
  )
}

function stateWord(s: SlotState): string {
  return s === 'done' ? 'done' : s === 'ready' ? 'unlocked' : s === 'active' ? 'in progress' : s === 'locked' ? 'locked' : 'up next'
}

// ---------------------------------------------------------------- shell

const NAV: Array<[Screen, string]> = [['lobby', 'Home'], ['history', 'History'], ['settings', 'Settings']]

export function Shell({ children, bar, quiet = false, title }: { children: ReactNode; bar?: ReactNode; quiet?: boolean; title: string }): React.JSX.Element {
  const screen = useStore((s) => s.screen)
  useEffect(() => {
    document.title = `${title} · Ready Up`
  }, [title])
  return (
    <div className={`shell ${quiet ? 'quiet' : ''}`}>
      <header className="topbar">
        <button className="wordmark" onClick={() => C.go('lobby')} aria-label="Ready Up, go to home">READY<span>UP</span></button>
        {bar && <div className="topbar-bar">{bar}</div>}
        <nav aria-label="Main">
          {NAV.map(([id, label]) => (
            <button key={id} className={`navlink ${screen === id ? 'on' : ''}`} aria-current={screen === id ? 'page' : undefined} onClick={() => C.go(id)}>{label}</button>
          ))}
        </nav>
      </header>
      <main className="page" id="main">{children}</main>
      <Toast />
    </div>
  )
}

export function Toast(): React.JSX.Element | null {
  const toast = useStore((s) => s.toast)
  if (!toast) return null
  return (
    <div className={`toast ${toast.tone}`} role={toast.tone === 'error' ? 'alert' : 'status'}>
      <span>{toast.text}</span>
      <button className="btn ghost small" onClick={() => useStore.setState({ toast: null })} aria-label="Dismiss">Dismiss</button>
    </div>
  )
}

// ---------------------------------------------------------------- controls

export function Kbd({ children }: { children: ReactNode }): React.JSX.Element {
  return <kbd className="kbd">{children}</kbd>
}

export function Stepper({ label, value, min, max, step = 1, unit, onChange }: { label: string; value: number; min: number; max: number; step?: number; unit: string; onChange: (v: number) => void }): React.JSX.Element {
  const id = useId()
  return (
    <div className="stepper" role="group" aria-labelledby={id}>
      <span className="field-label" id={id}>{label}</span>
      <div className="stepper-row">
        <button className="btn icon" onClick={() => onChange(Math.max(min, value - step))} disabled={value <= min} aria-label={`Decrease ${label}`}>−</button>
        <output className="stepper-value" aria-live="polite">{value}<small> {unit}</small></output>
        <button className="btn icon" onClick={() => onChange(Math.min(max, value + step))} disabled={value >= max} aria-label={`Increase ${label}`}>+</button>
      </div>
    </div>
  )
}

/** Modal dialog built on <dialog>: native focus trapping, Esc to close, focus returns afterwards. */
export function Sheet({ open, title, onClose, children, actions }: { open: boolean; title: string; onClose: () => void; children: ReactNode; actions: ReactNode }): React.JSX.Element {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog ref={ref} className="sheet" aria-labelledby={titleId} onClose={onClose} onCancel={(e) => { e.preventDefault(); onClose() }}>
      {open && (
        <>
          <h2 id={titleId}>{title}</h2>
          <div className="sheet-body">{children}</div>
          <div className="sheet-actions">{actions}</div>
        </>
      )}
    </dialog>
  )
}

export function Beta(): React.JSX.Element {
  return <span className="badge beta" title="Detection is still being tested on real cameras">Beta</span>
}
