import { POSE_CONNECTIONS, SIDE_JOINTS } from '@readyup/pose-types'
import type { FrameView } from '../engine/engine'

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/** Where a w×h image lands inside a box with object-fit: contain. */
export function containRect(boxW: number, boxH: number, imgW: number, imgH: number): Rect {
  if (!imgW || !imgH) return { x: 0, y: 0, w: boxW, h: boxH }
  const s = Math.min(boxW / imgW, boxH / imgH)
  const w = imgW * s
  const h = imgH * s
  return { x: (boxW - w) / 2, y: (boxH - h) / 2, w, h }
}

const COLORS = { paper: '#eeeae2', ember: '#f39a6b', mist: '#97a1b3', ink: 'rgba(12,15,21,0.78)', floor: 'rgba(238,234,226,0.08)' }

/**
 * Draws the skeleton. When mirrored, positions flip but text is drawn unmirrored, so labels
 * always read correctly (the "level content" rule).
 */
export function drawPose(ctx: CanvasRenderingContext2D, v: FrameView, rect: Rect, mirror: boolean, dpr: number): void {
  const lms = v.frame.landmarks
  ctx.save()
  ctx.scale(dpr, dpr)
  if (v.source === 'sim') {
    ctx.strokeStyle = COLORS.floor
    ctx.lineWidth = 1
    ctx.beginPath()
    const fy = rect.y + rect.h * ((v.frame.height - 90) / v.frame.height)
    ctx.moveTo(rect.x, fy)
    ctx.lineTo(rect.x + rect.w, fy)
    ctx.stroke()
  }
  if (!lms) {
    ctx.restore()
    return
  }
  const P = (i: number): { x: number; y: number; v: number } => {
    const l = lms[i]!
    return { x: rect.x + (mirror ? 1 - l.x : l.x) * rect.w, y: rect.y + l.y * rect.h, v: l.visibility }
  }
  const minVis = v.thresholds.minVisibility
  ctx.lineCap = 'round'
  for (const [a, b] of POSE_CONNECTIONS) {
    const p = P(a)
    const q = P(b)
    const visible = p.v >= minVis && q.v >= minVis
    ctx.strokeStyle = visible ? 'rgba(238,234,226,0.7)' : 'rgba(151,161,179,0.25)'
    ctx.setLineDash(visible ? [] : [3, 4])
    ctx.lineWidth = visible ? 2 : 1
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
    ctx.lineTo(q.x, q.y)
    ctx.stroke()
  }
  ctx.setLineDash([])
  const side = v.snap.side
  if (side) {
    const j = SIDE_JOINTS[side]
    const s = P(j.shoulder)
    const e = P(j.elbow)
    const w = P(j.wrist)
    ctx.strokeStyle = COLORS.ember
    ctx.lineWidth = 3.5
    ctx.beginPath()
    ctx.moveTo(s.x, s.y)
    ctx.lineTo(e.x, e.y)
    ctx.lineTo(w.x, w.y)
    ctx.stroke()
    for (const p of [s, e, w]) {
      ctx.fillStyle = COLORS.ember
      ctx.beginPath()
      ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2)
      ctx.fill()
    }
    const angle = v.snap.signals.primary
    if (angle !== null) label(ctx, `${Math.round(angle)}°`, e.x + 12, e.y - 12, COLORS.ember)
  }
  for (let i = 11; i < 33; i++) {
    const p = P(i)
    if (p.v < minVis) continue
    ctx.fillStyle = COLORS.paper
    ctx.beginPath()
    ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string): void {
  ctx.font = '600 13px "IBM Plex Mono", monospace'
  const w = ctx.measureText(text).width
  ctx.fillStyle = COLORS.ink
  ctx.beginPath()
  ctx.roundRect(x - 6, y - 15, w + 12, 21, 4)
  ctx.fill()
  ctx.fillStyle = color
  ctx.fillText(text, x, y)
}

export interface TracePoint {
  t: number
  v: number | null
  mark?: 'counted' | 'rejected' | 'voided'
}

/** 10-second primary-angle trace with the top and bottom thresholds drawn as dashed lines. */
export function drawTrace(ctx: CanvasRenderingContext2D, pts: TracePoint[], w: number, h: number, top: number, bottom: number, dpr: number): void {
  ctx.save()
  ctx.scale(dpr, dpr)
  ctx.clearRect(0, 0, w, h)
  const pad = { l: 34, r: 6, t: 6, b: 6 }
  const lo = 30
  const hi = 185
  const y = (deg: number): number => pad.t + (1 - (deg - lo) / (hi - lo)) * (h - pad.t - pad.b)
  const now = pts.length ? pts[pts.length - 1]!.t : 0
  const x = (t: number): number => pad.l + (1 - (now - t) / 10_000) * (w - pad.l - pad.r)
  ctx.font = '10px "IBM Plex Mono", monospace'
  for (const [deg, color] of [[top, '#8fd3a8'], [bottom, '#f0b566']] as const) {
    ctx.strokeStyle = color
    ctx.setLineDash([4, 4])
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(pad.l, y(deg))
    ctx.lineTo(w - pad.r, y(deg))
    ctx.stroke()
    ctx.fillStyle = color
    ctx.fillText(`${deg}°`, 2, y(deg) + 3)
  }
  ctx.setLineDash([])
  ctx.strokeStyle = '#f39a6b'
  ctx.lineWidth = 1.8
  ctx.beginPath()
  let pen = false
  for (const p of pts) {
    if (p.v === null) {
      pen = false
      continue
    }
    const px = x(p.t)
    const py = y(Math.max(lo, Math.min(hi, p.v)))
    if (pen) ctx.lineTo(px, py)
    else ctx.moveTo(px, py)
    pen = true
  }
  ctx.stroke()
  for (const p of pts) {
    if (!p.mark) continue
    ctx.fillStyle = p.mark === 'counted' ? '#8fd3a8' : p.mark === 'rejected' ? '#f0b566' : '#f08a7e'
    ctx.fillRect(x(p.t) - 1, pad.t, 2, h - pad.t - pad.b)
  }
  ctx.restore()
}
