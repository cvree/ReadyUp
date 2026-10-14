/** Rules for game shortcuts. Pure, so they're unit-tested and shared with the UI's messages. */

export const ALLOWED_FILE_EXTENSIONS = ['.lnk', '.url', '.exe'] as const

/** Launcher link schemes Ready Up will open. Anything else is refused. */
export const ALLOWED_SCHEMES: Record<string, string> = {
  'steam:': 'Steam',
  'battlenet:': 'Battle.net',
  'com.epicgames.launcher:': 'Epic Games',
  'uplay:': 'Ubisoft Connect',
  'origin2:': 'EA app',
  'riotclient:': 'Riot Client'
}

export type ShortcutCheck = { ok: true; kind: 'file' | 'url'; label: string } | { ok: false; error: string }

export function checkUrlTarget(target: string): ShortcutCheck {
  if (/\s/.test(target)) return { ok: false, error: 'Launcher links can\'t contain spaces.' }
  let url: URL
  try {
    url = new URL(target)
  } catch {
    return { ok: false, error: 'That doesn\'t look like a launcher link. Try copying it again.' }
  }
  const label = ALLOWED_SCHEMES[url.protocol.toLowerCase()]
  if (!label) {
    return { ok: false, error: `Ready Up only opens links for known game launchers (${Object.values(ALLOWED_SCHEMES).join(', ')}). For anything else, choose its shortcut instead.` }
  }
  return { ok: true, kind: 'url', label }
}

export function checkFileTarget(target: string): ShortcutCheck {
  const lower = target.toLowerCase()
  const ext = ALLOWED_FILE_EXTENSIONS.find((e) => lower.endsWith(e))
  if (!ext) return { ok: false, error: 'Choose a shortcut (.lnk or .url) or a program (.exe).' }
  return { ok: true, kind: 'file', label: ext === '.exe' ? 'Program' : 'Shortcut' }
}

/** Suggests a display name from a file path, e.g. "C:\\…\\Overwatch 2.lnk" → "Overwatch 2". */
export function nameFromPath(path: string): string {
  const base = path.split(/[\\/]/).pop() ?? path
  return base.replace(/\.(lnk|url|exe)$/i, '').trim().slice(0, 60) || 'My game'
}
