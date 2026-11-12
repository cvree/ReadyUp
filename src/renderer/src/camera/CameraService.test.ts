import { describe, expect, it } from 'vitest'
import { cameraDisplayName, cameraRank } from './CameraService'

describe('camera choice on a first run', () => {
  it('prefers a real webcam over infrared and virtual cameras', () => {
    const labels = ['Integrated IR Camera (04f2:b6c2)', 'OBS Virtual Camera', 'Integrated Camera (04f2:b6c1)', 'Logitech BRIO (046d:085e)']
    const sorted = [...labels].sort((a, b) => cameraRank(a) - cameraRank(b))
    expect(sorted[0]).toBe('Integrated Camera (04f2:b6c1)')
    expect(sorted.at(-1)).toBe('Integrated IR Camera (04f2:b6c2)')
  })

  it('does not mistake ordinary names for infrared', () => {
    expect(cameraRank('Iriun Webcam')).toBe(0)
    expect(cameraRank('fake_device_0')).toBe(0)
  })
})

describe('cameraDisplayName', () => {
  it('drops the USB id Windows appends', () => {
    expect(cameraDisplayName('HD Pro Webcam C920 (046d:082d)')).toBe('HD Pro Webcam C920')
    expect(cameraDisplayName('FaceTime HD Camera (Built-in)')).toBe('FaceTime HD Camera (Built-in)')
    expect(cameraDisplayName(null)).toBe('Camera')
  })
})
