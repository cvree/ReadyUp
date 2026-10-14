import { dialog, shell, type BrowserWindow } from 'electron'
import { existsSync } from 'node:fs'
import type { Game, LaunchResult, PickedShortcut } from '../shared/ipc'
import { checkFileTarget, checkUrlTarget, nameFromPath } from './launcher-rules'

/** Test mode records launches instead of opening anything. */
export const testLaunches: Array<{ at: number; target: string }> = []

export function validateGame(game: Game): LaunchResult {
  const check = game.kind === 'url' ? checkUrlTarget(game.target) : checkFileTarget(game.target)
  if (!check.ok) return { ok: false, error: check.error }
  if (game.kind === 'file' && !existsSync(game.target) && process.env.READYUP_E2E !== '1') {
    return { ok: false, error: 'That shortcut isn\'t there any more. Choose it again in Settings → Games.' }
  }
  return { ok: true }
}

/**
 * Asks Windows to open the chosen shortcut, exactly like double-clicking it. Ready Up doesn't
 * touch the game process, so it never interacts with anti-cheat.
 */
export async function launchGame(game: Game): Promise<LaunchResult> {
  const valid = validateGame(game)
  if (!valid.ok) return valid
  if (process.env.READYUP_E2E === '1') {
    testLaunches.push({ at: Date.now(), target: game.target })
    return { ok: true }
  }
  try {
    if (game.kind === 'url') {
      await shell.openExternal(game.target)
      return { ok: true }
    }
    const err = await shell.openPath(game.target)
    return err ? { ok: false, error: `Windows couldn't open it: ${err}` } : { ok: true }
  } catch (e) {
    return { ok: false, error: `Windows couldn't open it: ${(e as Error).message}` }
  }
}

export async function pickShortcut(win: BrowserWindow | null): Promise<PickedShortcut | null> {
  if (process.env.READYUP_E2E === '1' && process.env.READYUP_E2E_PICK) {
    return { path: process.env.READYUP_E2E_PICK, suggestedName: nameFromPath(process.env.READYUP_E2E_PICK) }
  }
  const opts = {
    title: 'Choose your game\'s shortcut',
    properties: ['openFile' as const],
    filters: [{ name: 'Game shortcuts and programs', extensions: ['lnk', 'url', 'exe'] }]
  }
  const res = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
  const path = res.filePaths[0]
  if (res.canceled || !path) return null
  return { path, suggestedName: nameFromPath(path) }
}
