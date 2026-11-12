import { readFileSync } from 'node:fs'
import { z } from 'zod'

/** Where the window was when the app last closed. Not user data; safe to lose. */
export const WindowStateSchema = z.object({
  x: z.number().int(),
  y: z.number().int(),
  width: z.number().int().min(200).max(20000),
  height: z.number().int().min(200).max(20000),
  maximized: z.boolean()
})
export type WindowState = z.infer<typeof WindowStateSchema>

export interface Area {
  x: number
  y: number
  width: number
  height: number
}

export const DEFAULT_SIZE = { width: 1360, height: 880 }
export const MIN_SIZE = { width: 1024, height: 700 }

export function readWindowState(file: string): WindowState | null {
  try {
    const parsed = WindowStateSchema.safeParse(JSON.parse(readFileSync(file, 'utf8')))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

/**
 * Turns a remembered window into one that is certainly reachable now. The monitor it was on may
 * be unplugged or have a different resolution, so the window is used only if it still sits well
 * inside a current display's work area; otherwise it is centred on the primary display. The size
 * never exceeds the display it lands on.
 */
export function placeWindow(saved: WindowState | null, displays: Area[], primary: Area): Area & { maximized: boolean } {
  const fit = (area: Area, width: number, height: number): { width: number; height: number } => ({
    width: Math.min(Math.max(width, Math.min(MIN_SIZE.width, area.width)), area.width),
    height: Math.min(Math.max(height, Math.min(MIN_SIZE.height, area.height)), area.height)
  })
  const centred = (maximized: boolean): Area & { maximized: boolean } => {
    const size = fit(primary, saved?.width ?? DEFAULT_SIZE.width, saved?.height ?? DEFAULT_SIZE.height)
    return { x: Math.round(primary.x + (primary.width - size.width) / 2), y: Math.round(primary.y + (primary.height - size.height) / 2), ...size, maximized }
  }
  if (!saved) return centred(false)
  // The display holding the middle of the title bar is the one the person would look for it on.
  const cx = saved.x + saved.width / 2
  const home = displays.find((d) => cx >= d.x && cx < d.x + d.width && saved.y >= d.y - 8 && saved.y < d.y + d.height - 40)
  if (!home) return centred(saved.maximized)
  const size = fit(home, saved.width, saved.height)
  const x = Math.min(Math.max(saved.x, home.x), home.x + home.width - size.width)
  const y = Math.min(Math.max(saved.y, home.y), home.y + home.height - size.height)
  return { x, y, ...size, maximized: saved.maximized }
}
