/** IPC channel names. Kept separate from the zod schemas so the preload stays tiny. */
export const IPC = {
  systemInfo: 'system:info',
  startupMetrics: 'system:startup-metrics',
  getSettings: 'settings:get',
  updateSettings: 'settings:update',
  log: 'log:event',
  exportLog: 'log:export',
  openCameraSettings: 'platform:open-camera-settings'
} as const
