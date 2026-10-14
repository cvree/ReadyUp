import { useState } from 'react'
import type { Game } from '@shared/ipc'
import * as C from '../state/controller'
import { useStore } from '../state/store'

/** Add, test and choose game shortcuts. Ready Up never guesses install locations. */
export function GamesEditor(): React.JSX.Element {
  const settings = useStore((s) => s.settings)
  const [draft, setDraft] = useState<{ name: string; kind: Game['kind']; target: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)

  const pick = async (): Promise<void> => {
    setError(null)
    const picked = await window.readyup.pickShortcut()
    if (picked) setDraft({ name: picked.suggestedName, kind: 'file', target: picked.path })
  }
  const save = async (): Promise<void> => {
    if (!draft) return
    const game: Game = { id: crypto.randomUUID(), name: draft.name.trim(), kind: draft.kind, target: draft.target.trim() }
    const check = await window.readyup.validateGame(game)
    if (!check.ok) {
      setError(check.error)
      return
    }
    const games = [...settings.games, game]
    await C.updateSettings({ games, routine: { ...settings.routine, gameId: settings.routine.gameId ?? game.id } })
    setDraft(null)
    setError(null)
    setStatus(`Added ${game.name}.`)
  }
  const remove = async (id: string): Promise<void> => {
    const games = settings.games.filter((g) => g.id !== id)
    await C.updateSettings({ games, routine: { ...settings.routine, gameId: settings.routine.gameId === id ? games[0]?.id ?? null : settings.routine.gameId } })
  }
  const test = async (g: Game): Promise<void> => {
    const r = await window.readyup.launchGame(g.id, null)
    setStatus(r.ok ? `Opened ${g.name}. If it started, you're set.` : r.error)
  }

  return (
    <div className="games">
      {settings.games.length === 0 && !draft && <p className="muted">No games yet. Add the shortcut you already use, or paste a launcher link (for example from Steam or Battle.net).</p>}
      <ul className="game-list">
        {settings.games.map((g) => (
          <li key={g.id}>
            <label className="radio">
              <input type="radio" name="default-game" checked={settings.routine.gameId === g.id} onChange={() => void C.updateSettings({ routine: { ...settings.routine, gameId: g.id } })} />
              <span><strong>{g.name}</strong><small className="mono">{g.target}</small></span>
            </label>
            <span className="row tight">
              <button className="btn small" onClick={() => void test(g)}>Test launch</button>
              <button className="btn small ghost" onClick={() => void remove(g.id)} aria-label={`Remove ${g.name}`}>Remove</button>
            </span>
          </li>
        ))}
      </ul>
      {draft ? (
        <div className="card draft">
          <label className="field"><span className="field-label">Name</span><input value={draft.name} maxLength={60} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label>
          <label className="field">
            <span className="field-label">{draft.kind === 'file' ? 'Shortcut' : 'Launcher link'}</span>
            <input value={draft.target} readOnly={draft.kind === 'file'} placeholder="steam://rungameid/2767030" onChange={(e) => setDraft({ ...draft, target: e.target.value })} />
          </label>
          {error && <p className="fine warn" role="alert">{error}</p>}
          <div className="row tight">
            <button className="btn primary" disabled={!draft.name.trim() || !draft.target.trim()} onClick={() => void save()}>Save game</button>
            <button className="btn ghost" onClick={() => { setDraft(null); setError(null) }}>Cancel</button>
          </div>
        </div>
      ) : (
        <div className="row tight">
          <button className="btn" onClick={() => void pick()}>Choose a shortcut…</button>
          <button className="btn ghost" onClick={() => setDraft({ name: '', kind: 'url', target: '' })}>Paste a launcher link</button>
        </div>
      )}
      {status && <p className="fine" role="status">{status}</p>}
    </div>
  )
}
