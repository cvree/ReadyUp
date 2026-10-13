import { describe, expect, it } from 'vitest'
import { OneEuroFilter, angleDeg, inclinationDeg, offsetBelowLine } from '@readyup/exercise'

describe('geometry', () => {
  it('measures interior angles', () => {
    expect(angleDeg({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 })).toBeCloseTo(180)
    expect(angleDeg({ x: 0, y: 1 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toBeCloseTo(90)
    expect(angleDeg({ x: 1, y: 1 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toBeCloseTo(45)
  })
  it('handles degenerate segments without NaN', () => {
    expect(angleDeg({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toBe(180)
  })
  it('measures inclination from horizontal regardless of direction', () => {
    expect(inclinationDeg({ x: 0, y: 0 }, { x: 10, y: 0 })).toBeCloseTo(0)
    expect(inclinationDeg({ x: 0, y: 0 }, { x: 0, y: -10 })).toBeCloseTo(90)
    expect(inclinationDeg({ x: 10, y: 10 }, { x: 0, y: 0 })).toBeCloseTo(45)
  })
  it('reports which side of a line a point is on (image y grows downward)', () => {
    const a = { x: 0, y: 0 }
    const b = { x: 10, y: 0 }
    expect(offsetBelowLine(a, b, { x: 5, y: 2 })).toBeCloseTo(2)
    expect(offsetBelowLine(a, b, { x: 5, y: -3 })).toBeCloseTo(-3)
  })
})

describe('One-Euro filter', () => {
  it('passes the first sample through and reduces jitter on a steady signal', () => {
    const f = new OneEuroFilter()
    expect(f.filter(100, 0)).toBe(100)
    let maxDev = 0
    for (let i = 1; i < 120; i++) {
      const v = f.filter(100 + (i % 2 ? 5 : -5), i * 33)
      if (i > 30) maxDev = Math.max(maxDev, Math.abs(v - 100))
    }
    expect(maxDev).toBeLessThan(5)
  })
  it('follows a fast step change within a few frames', () => {
    const f = new OneEuroFilter()
    for (let i = 0; i < 10; i++) f.filter(170, i * 33)
    let v = 0
    for (let i = 10; i < 16; i++) v = f.filter(90, i * 33)
    expect(v).toBeLessThan(110)
  })
})
