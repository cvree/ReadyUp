/** IPC channel names. Kept separate from the zod schemas so the preload stays tiny. */
export const IPC = {
  systemInfo: 'system:info',
  startupMetrics: 'system:startup-metrics',
  runtimeConfig: 'system:runtime-config',
  getSettings: 'settings:get',
  updateSettings: 'settings:update',
  log: 'log:event',
  exportLog: 'log:export',
  openCameraSettings: 'platform:open-camera-settings',
  notify: 'platform:notify',
  powerEvent: 'platform:power',
  historyList: 'history:list',
  historyAdd: 'history:add',
  historyAddMatch: 'history:add-match',
  historyExport: 'history:export',
  deleteAllData: 'data:delete-all',
  activeLoad: 'session:load-active',
  activeSave: 'session:save-active',
  activeClear: 'session:clear-active',
  gamesPick: 'games:pick',
  gamesValidate: 'games:validate',
  gamesLaunch: 'games:launch'
} as const
