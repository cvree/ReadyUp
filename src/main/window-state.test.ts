import { describe, expect, it } from 'vitest'
import { DEFAULT_SIZE, placeWindow, type Area } from './window-state'

const fhd: Area = { x: 0, y: 0, width: 1920, height: 1040 }
const second: Area = { x: 1920, y: 0, width: 2560, height: 1400 }

describe('placeWindow', () => {
  it('centres a default-size window on first run', () => {
    expect(placeWindow(null, [fhd], fhd)).toEqual({ x: 280, y: 80, ...DEFAULT_SIZE, maximized: false })
  })

  it('restores a window that is still on a display', () => {
    const saved = { x: 2100, y: 120, width: 1500, height: 900, maximized: false }
    expect(placeWindow(saved, [fhd, second], fhd)).toEqual(saved)
  })

  it('brings the window back when its monitor is gone, keeping its size and maximized state', () => {
    const saved = { x: 2100, y: 120, width: 1500, height: 900, maximized: true }
    expect(placeWindow(saved, [fhd], fhd)).toEqual({ x: 210, y: 70, width: 1500, height: 900, maximized: true })
  })

  it('shrinks and nudges a window that no longer fits its display', () => {
    const small: Area = { x: 0, y: 0, width: 1280, height: 680 }
    const saved = { x: 300, y: 100, width: 1600, height: 900, maximized: false }
    expect(placeWindow(saved, [small], small)).toEqual({ x: 0, y: 0, width: 1280, height: 680, maximized: false })
  })

  it('rescues a window whose title bar is above the top of the screen', () => {
    const saved = { x: 100, y: -400, width: 1360, height: 880, maximized: false }
    expect(placeWindow(saved, [fhd], fhd)).toMatchObject({ x: 280, y: 80 })
  })
})
