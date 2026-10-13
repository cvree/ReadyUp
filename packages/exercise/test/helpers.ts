import { RepCounter, pushUp, type RepEvent, type Thresholds } from '@readyup/exercise'
import { generate, presetById, type ScenarioOptions } from '@readyup/sim'
import type { PoseFrame } from '@readyup/pose-types'

export interface RunResult {
  count: number
  events: RepEvent[]
  byReason: Record<string, number>
}

export function runFrames(frames: PoseFrame[], th: Partial<Thresholds> = {}): RunResult {
  const c = new RepCounter(pushUp, th)
  const events: RepEvent[] = []
  let count = 0
  for (const f of frames) {
    const snap = c.update(f)
    events.push(...snap.events)
    count = snap.count
  }
  const byReason: Record<string, number> = {}
  for (const e of events) byReason[`${e.outcome}:${e.reason}`] = (byReason[`${e.outcome}:${e.reason}`] ?? 0) + 1
  return { count, events, byReason }
}

export function runPreset(id: string, opts: Partial<ScenarioOptions> = {}, th: Partial<Thresholds> = {}): RunResult {
  const p = presetById(id)
  if (!p) throw new Error(`unknown preset ${id}`)
  return runFrames(generate(p.segments, { ...p.options, ...opts }), th)
}

/** Events that are not successful counts. */
export const nonCounts = (r: RunResult): RepEvent[] => r.events.filter((e) => e.outcome !== 'counted')
