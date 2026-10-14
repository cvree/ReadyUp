import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IPC } from '../shared/channels'
import type { ReadyUpApi } from './api'
import type { PowerEvent } from '../shared/ipc'

// The only bridge between the sandboxed UI and the main process. No Node APIs are exposed.
const api: ReadyUpApi = {
  getSystemInfo: () => ipcRenderer.invoke(IPC.systemInfo),
  getStartupMetrics: () => ipcRenderer.invoke(IPC.startupMetrics),
  getRuntimeConfig: () => ipcRenderer.invoke(IPC.runtimeConfig),
  getSettings: () => ipcRenderer.invoke(IPC.getSettings),
  updateSettings: (patch) => ipcRenderer.invoke(IPC.updateSettings, patch),
  log: (type, data = {}) => ipcRenderer.send(IPC.log, { type, data }),
  exportLog: (payload) => ipcRenderer.invoke(IPC.exportLog, payload),
  openCameraSettings: () => ipcRenderer.invoke(IPC.openCameraSettings),
  notify: (title, body) => ipcRenderer.invoke(IPC.notify, title, body),
  onPower: (cb) => {
    const listener = (_e: IpcRendererEvent, ev: PowerEvent): void => cb(ev)
    ipcRenderer.on(IPC.powerEvent, listener)
    return () => ipcRenderer.removeListener(IPC.powerEvent, listener)
  },
  listHistory: () => ipcRenderer.invoke(IPC.historyList),
  saveRecord: (record) => ipcRenderer.invoke(IPC.historyAdd, record),
  addMatch: (sessionId, match) => ipcRenderer.invoke(IPC.historyAddMatch, sessionId, match),
  exportHistory: () => ipcRenderer.invoke(IPC.historyExport),
  deleteAllData: (confirm) => ipcRenderer.invoke(IPC.deleteAllData, confirm),
  loadActiveSession: () => ipcRenderer.invoke(IPC.activeLoad),
  saveActiveSession: (s) => ipcRenderer.invoke(IPC.activeSave, s),
  clearActiveSession: () => ipcRenderer.invoke(IPC.activeClear),
  pickShortcut: () => ipcRenderer.invoke(IPC.gamesPick),
  validateGame: (game) => ipcRenderer.invoke(IPC.gamesValidate, game),
  launchGame: (gameId, sessionId) => ipcRenderer.invoke(IPC.gamesLaunch, gameId, sessionId)
}

contextBridge.exposeInMainWorld('readyup', api)
