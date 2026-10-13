import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/channels'
import type { ReadyUpApi } from './api'

// The only bridge between the sandboxed UI and the main process. No Node APIs are exposed.
const api: ReadyUpApi = {
  getSystemInfo: () => ipcRenderer.invoke(IPC.systemInfo),
  getStartupMetrics: () => ipcRenderer.invoke(IPC.startupMetrics),
  getSettings: () => ipcRenderer.invoke(IPC.getSettings),
  updateSettings: (patch) => ipcRenderer.invoke(IPC.updateSettings, patch),
  log: (type, data = {}) => ipcRenderer.send(IPC.log, { type, data }),
  exportLog: (payload) => ipcRenderer.invoke(IPC.exportLog, payload),
  openCameraSettings: () => ipcRenderer.invoke(IPC.openCameraSettings)
}

contextBridge.exposeInMainWorld('readyup', api)
