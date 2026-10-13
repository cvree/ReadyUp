export * from './rng'
export * from './body'
export * from './scenario'
export * from './presets'

import { generate } from './scenario'
import { presetById } from './presets'
import type { PoseFrame } from '@readyup/pose-types'

/** Frames for a named preset. */
export function presetFrames(id: string, seed = 7): PoseFrame[] {
  const p = presetById(id)
  if (!p) throw new Error(`Unknown preset: ${id}`)
  return generate(p.segments, { seed, ...p.options })
}
