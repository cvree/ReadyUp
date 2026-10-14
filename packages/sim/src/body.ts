import { LM, LANDMARK_COUNT, type Landmark, type Side } from '@readyup/pose-types'

/** A point in body space: metres, x to the right, y up from the floor. */
export interface V2 {
  x: number
  y: number
}

export interface BodyPose {
  head: V2
  shoulder: V2
  elbow: V2
  wrist: V2
  hip: V2
  knee: V2
  ankle: V2
  heel: V2
  toe: V2
}

export const UPPER_ARM = 0.3
export const FOREARM = 0.28

const add = (a: V2, b: V2): V2 => ({ x: a.x + b.x, y: a.y + b.y })
const sub = (a: V2, b: V2): V2 => ({ x: a.x - b.x, y: a.y - b.y })
const mul = (a: V2, k: number): V2 => ({ x: a.x * k, y: a.y * k })
const len = (a: V2): number => Math.hypot(a.x, a.y)
const unit = (a: V2): V2 => {
  const l = len(a)
  return l === 0 ? { x: 0, y: 0 } : mul(a, 1 / l)
}
const lerp = (a: V2, b: V2, k: number): V2 => add(a, mul(sub(b, a), k))
const rad = (deg: number): number => (deg * Math.PI) / 180

/**
 * Elbow position for a two-segment arm from shoulder S to wrist W with interior elbow angle.
 * `bendSign` picks which side of the S→W line the elbow sits on.
 */
function solveElbow(S: V2, W: V2, bendSign: 1 | -1): V2 {
  const d = Math.max(1e-6, len(sub(W, S)))
  const a = (UPPER_ARM * UPPER_ARM - FOREARM * FOREARM + d * d) / (2 * d)
  const h = Math.sqrt(Math.max(0, UPPER_ARM * UPPER_ARM - a * a))
  const u = unit(sub(W, S))
  const n = { x: -u.y * bendSign, y: u.x * bendSign }
  return add(add(S, mul(u, a)), mul(n, h))
}

/** Shoulder-to-wrist distance for an interior elbow angle (law of cosines). */
function reach(elbowDeg: number): number {
  return Math.sqrt(UPPER_ARM ** 2 + FOREARM ** 2 - 2 * UPPER_ARM * FOREARM * Math.cos(rad(elbowDeg)))
}

export interface PlankOptions {
  elbowDeg: number
  /** Hip drop below the shoulder–ankle line, metres (negative = piked). */
  sag: number
  /** Pivot on the knees instead of the toes. */
  knees: boolean
}

/** Side-view push-up (or knee push-up). Head to the left, feet to the right. */
export function plankPose(o: PlankOptions): BodyPose {
  const wrist: V2 = { x: 0.6, y: 0.02 }
  const shoulder: V2 = { x: wrist.x - 0.03, y: wrist.y + reach(o.elbowDeg) }
  const elbow = solveElbow(shoulder, wrist, 1)
  let hip: V2, knee: V2, ankle: V2
  if (!o.knees) {
    ankle = { x: shoulder.x + 1.38, y: 0.09 }
    // Positive sag lowers the hip (and half as much the knee) below the straight body line.
    hip = add(lerp(shoulder, ankle, 0.42), { x: 0, y: -o.sag })
    knee = add(lerp(shoulder, ankle, 0.71), { x: 0, y: -o.sag * 0.5 })
  } else {
    knee = { x: shoulder.x + 0.95, y: 0.05 }
    hip = add(lerp(shoulder, knee, 0.58), { x: 0, y: -o.sag })
    ankle = add(knee, { x: 0.4 * Math.cos(rad(40)), y: 0.4 * Math.sin(rad(40)) })
  }
  const back = unit(sub(shoulder, hip))
  const head = add(add(shoulder, mul(back, 0.24)), { x: 0, y: 0.03 })
  const heel = add(ankle, { x: 0.05, y: 0.01 })
  const toe = o.knees ? add(ankle, { x: 0.05, y: 0.12 }) : { x: ankle.x - 0.02, y: 0.0 }
  return { head, shoulder, elbow, wrist, hip, knee, ankle, heel, toe }
}

/** Standing side view with the forearm curling up in front (used for arm-curl negatives). */
export function standingCurlPose(elbowDeg: number): BodyPose {
  const ankle: V2 = { x: 1.2, y: 0.08 }
  const knee: V2 = { x: 1.2, y: 0.5 }
  const hip: V2 = { x: 1.2, y: 0.93 }
  const shoulder: V2 = { x: 1.2, y: 1.45 }
  const head: V2 = { x: 1.2, y: 1.68 }
  const elbow: V2 = { x: 1.21, y: shoulder.y - UPPER_ARM }
  // Forearm hangs down at 180°, rotates forward (to the left) as the elbow flexes.
  const fromDown = 180 - elbowDeg
  const wrist: V2 = { x: elbow.x - FOREARM * Math.sin(rad(fromDown)), y: elbow.y - FOREARM * Math.cos(rad(fromDown)) }
  return { head, shoulder, elbow, wrist, hip, knee, ankle, heel: { x: 1.25, y: 0.03 }, toe: { x: 1.08, y: 0.0 } }
}

export interface ProjectOptions {
  width: number
  height: number
  /** Pixels per metre. */
  scale: number
  /** Image position of body-space origin. */
  originX: number
  floorY: number
  nearSide: Side
  nearVisibility: number
  farVisibility: number
  /** Gaussian landmark noise, pixels. */
  noisePx: number
  /** Far-side landmarks scattered randomly (simulates the model guessing hidden joints). */
  farGarbage: boolean
  rand: () => number
  gauss: () => number
}

/** Projects a body pose into 33 MediaPipe-style normalized landmarks. */
export function project(p: BodyPose, o: ProjectOptions): Landmark[] {
  const out: Landmark[] = new Array(LANDMARK_COUNT)
  const px = (v: V2, jitter = 0): { x: number; y: number } => ({
    x: o.originX + v.x * o.scale + o.gauss() * (o.noisePx + jitter),
    y: o.floorY - v.y * o.scale + o.gauss() * (o.noisePx + jitter)
  })
  const set = (i: number, v: V2, vis: number, z: number, jitter = 0): void => {
    const q = px(v, jitter)
    out[i] = { x: q.x / o.width, y: q.y / o.height, z, visibility: vis }
  }
  const near = o.nearSide
  const far: Side = near === 'left' ? 'right' : 'left'
  const idx = (side: Side, left: number, right: number): number => (side === 'left' ? left : right)
  const farOffset: V2 = { x: 0.015, y: 0.02 }
  const sideJoints: Array<[number, number, keyof BodyPose]> = [
    [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER, 'shoulder'],
    [LM.LEFT_ELBOW, LM.RIGHT_ELBOW, 'elbow'],
    [LM.LEFT_WRIST, LM.RIGHT_WRIST, 'wrist'],
    [LM.LEFT_HIP, LM.RIGHT_HIP, 'hip'],
    [LM.LEFT_KNEE, LM.RIGHT_KNEE, 'knee'],
    [LM.LEFT_ANKLE, LM.RIGHT_ANKLE, 'ankle'],
    [LM.LEFT_HEEL, LM.RIGHT_HEEL, 'heel'],
    [LM.LEFT_FOOT_INDEX, LM.RIGHT_FOOT_INDEX, 'toe']
  ]
  for (const [l, r, key] of sideJoints) {
    set(idx(near, l, r), p[key], o.nearVisibility, -0.1)
    if (o.farGarbage) {
      const g: V2 = { x: p[key].x + (o.rand() - 0.5) * 0.6, y: p[key].y + (o.rand() - 0.5) * 0.6 }
      set(idx(far, l, r), g, o.farVisibility, 0.1)
    } else {
      set(idx(far, l, r), add(p[key], farOffset), o.farVisibility, 0.1, 2)
    }
  }
  // Hands: small offsets from the wrist on both sides.
  const hand: Array<[number, number, V2]> = [
    [LM.LEFT_PINKY, LM.RIGHT_PINKY, { x: -0.04, y: -0.02 }],
    [LM.LEFT_INDEX, LM.RIGHT_INDEX, { x: -0.06, y: -0.01 }],
    [LM.LEFT_THUMB, LM.RIGHT_THUMB, { x: -0.04, y: 0.01 }]
  ]
  for (const [l, r, off] of hand) {
    set(idx(near, l, r), add(p.wrist, off), o.nearVisibility * 0.9, -0.1)
    set(idx(far, l, r), add(add(p.wrist, off), farOffset), o.farVisibility, 0.1)
  }
  // Face: clustered around the head.
  const face: Array<[number, V2, boolean]> = [
    [LM.NOSE, { x: -0.09, y: -0.01 }, true],
    [LM.LEFT_EYE_INNER, { x: -0.07, y: 0.02 }, near === 'left'], [LM.LEFT_EYE, { x: -0.065, y: 0.025 }, near === 'left'],
    [LM.LEFT_EYE_OUTER, { x: -0.055, y: 0.025 }, near === 'left'], [LM.RIGHT_EYE_INNER, { x: -0.07, y: 0.02 }, near === 'right'],
    [LM.RIGHT_EYE, { x: -0.065, y: 0.025 }, near === 'right'], [LM.RIGHT_EYE_OUTER, { x: -0.055, y: 0.025 }, near === 'right'],
    [LM.LEFT_EAR, { x: 0.0, y: 0.01 }, near === 'left'], [LM.RIGHT_EAR, { x: 0.0, y: 0.01 }, near === 'right'],
    [LM.MOUTH_LEFT, { x: -0.075, y: -0.04 }, near === 'left'], [LM.MOUTH_RIGHT, { x: -0.075, y: -0.04 }, near === 'right']
  ]
  for (const [i, off, isNear] of face) set(i, add(p.head, off), isNear ? o.nearVisibility : o.farVisibility, 0)
  return out
}

const rot = (v: V2, deg: number): V2 => {
  const r = rad(deg)
  return { x: v.x * Math.cos(r) - v.y * Math.sin(r), y: v.x * Math.sin(r) + v.y * Math.cos(r) }
}

/** Side-view squat. Facing left: knees travel forward (-x), hips sit back (+x). */
export function squatPose(kneeDeg: number): BodyPose {
  const ankle: V2 = { x: 1.2, y: 0.08 }
  const flex = 180 - kneeDeg
  const shinTilt = rad(flex * 0.45)
  const knee: V2 = { x: ankle.x - 0.45 * Math.sin(shinTilt), y: ankle.y + 0.45 * Math.cos(shinTilt) }
  const toAnkle = unit(sub(ankle, knee))
  const hip = add(knee, mul(rot(toAnkle, kneeDeg), 0.45))
  const lean = rad(flex * 0.4)
  const up: V2 = { x: -Math.sin(lean), y: Math.cos(lean) }
  const shoulder = add(hip, mul(up, 0.52))
  const head = add(shoulder, mul(up, 0.22))
  const elbow = add(shoulder, { x: -0.29, y: -0.02 })
  const wrist = add(elbow, { x: -0.27, y: 0 })
  return { head, shoulder, elbow, wrist, hip, knee, ankle, heel: add(ankle, { x: 0.05, y: -0.05 }), toe: add(ankle, { x: -0.12, y: -0.07 }) }
}

/** Standing, bending forward at the hips (as if picking something up) with soft knees. */
export function bendPose(pitchDeg: number): BodyPose {
  const base = squatPose(165)
  const fwd: V2 = { x: -Math.sin(rad(pitchDeg)), y: Math.cos(rad(pitchDeg)) }
  const shoulder = add(base.hip, mul(fwd, 0.52))
  const head = add(shoulder, mul(fwd, 0.22))
  const elbow = add(shoulder, { x: -0.02, y: -0.29 })
  const wrist = add(elbow, { x: -0.02, y: -0.27 })
  return { ...base, shoulder, head, elbow, wrist }
}

/** Side-view sit-up: lying on the back with knees bent; the torso rotates up about the hip. */
export function situpPose(torsoDeg: number): BodyPose {
  const hip: V2 = { x: 1.0, y: 0.1 }
  const knee = add(hip, { x: 0.45 * Math.cos(rad(40)), y: 0.45 * Math.sin(rad(40)) })
  const ankle: V2 = { x: knee.x + 0.3, y: 0.08 }
  const dir: V2 = { x: -Math.cos(rad(torsoDeg)), y: Math.sin(rad(torsoDeg)) }
  const shoulder = add(hip, mul(dir, 0.5))
  const head = add(shoulder, mul(dir, 0.22))
  const perp: V2 = { x: dir.y, y: -dir.x }
  const elbow = add(lerp(hip, shoulder, 0.75), mul(perp, -0.08))
  const wrist = add(lerp(hip, shoulder, 0.9), mul(perp, -0.1))
  return { head, shoulder, elbow, wrist, hip, knee, ankle, heel: add(ankle, { x: 0.04, y: -0.02 }), toe: add(ankle, { x: 0.12, y: -0.06 }) }
}
