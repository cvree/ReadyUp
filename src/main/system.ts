import { app, systemPreferences } from 'electron'
import { execFile } from 'node:child_process'
import os from 'node:os'
import type { SystemInfo } from '../shared/ipc'
import { describeWindows, normalizeArch, parseRegQuery } from './windows-info'

function reg(args: string[]): Promise<string> {
  return new Promise((resolve) => {
    execFile('reg', args, { timeout: 4000, windowsHide: true }, (err, stdout) => resolve(err ? '' : stdout))
  })
}

function cameraAccess(): string {
  if (process.platform !== 'win32' && process.platform !== 'darwin') return 'not-applicable'
  try {
    return systemPreferences.getMediaAccessStatus('camera')
  } catch {
    return 'unknown'
  }
}

async function gpuName(): Promise<string | null> {
  try {
    const info = (await Promise.race([
      app.getGPUInfo('complete'),
      new Promise((resolve) => setTimeout(() => resolve(null), 3000))
    ])) as { auxAttributes?: { glRenderer?: string } } | null
    return info?.auxAttributes?.glRenderer ?? null
  } catch {
    return null
  }
}

/** Detected at runtime on the machine the app runs on. Nothing here is assumed. */
export async function getSystemInfo(): Promise<SystemInfo> {
  const emulated = app.runningUnderARM64Translation
  const base = {
    platform: process.platform,
    kernel: os.release(),
    appArch: process.arch,
    emulated,
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
    appVersion: app.getVersion(),
    cameraAccess: cameraAccess(),
    gpu: await gpuName()
  }
  if (process.platform === 'win32') {
    const cv = parseRegQuery(await reg(['query', 'HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion']))
    const env = parseRegQuery(await reg(['query', 'HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment', '/v', 'PROCESSOR_ARCHITECTURE']))
    const win = describeWindows(cv)
    const osArch = env.PROCESSOR_ARCHITECTURE ? normalizeArch(env.PROCESSOR_ARCHITECTURE) : emulated ? 'arm64' : process.arch
    return { ...base, ...win, osArch, source: cv.ProductName ? 'Windows registry' : 'Node os module (registry unavailable)' }
  }
  return {
    ...base,
    osName: `${os.type()} ${os.release()}`,
    osVersion: null,
    osBuild: null,
    osArch: emulated ? 'arm64' : os.arch(),
    source: 'Node os module'
  }
}
