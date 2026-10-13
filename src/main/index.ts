import { BrowserWindow, Menu, app, dialog, ipcMain, session, shell, type IpcMainEvent, type IpcMainInvokeEvent } from 'electron'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { IPC } from '../shared/channels'
import { ExportPayloadSchema, LogEventSchema, SettingsPatchSchema, type ExportResult, type StartupMetrics, type SystemInfo } from '../shared/ipc'
import { EventLog, buildExport } from './log'
import { handleAppProtocol, registerAppScheme } from './protocol'
import { APP_ORIGIN, DEV_CSP, isLocalUrl, isTrustedOrigin } from './security'
import { SettingsStore, writeFileAtomic } from './storage'
import { getSystemInfo } from './system'

const processStart = Date.now() - process.uptime() * 1000
const E2E = process.env.READYUP_E2E === '1'
const devServer = !app.isPackaged && process.env.ELECTRON_RENDERER_URL ? process.env.ELECTRON_RENDERER_URL : null

// Test isolation: end-to-end tests get their own profile folder.
if (E2E && process.env.READYUP_USER_DATA) app.setPath('userData', process.env.READYUP_USER_DATA)

if (E2E) {
  // Chromium's synthetic camera, so tests run without hardware. Never enabled in normal use.
  app.commandLine.appendSwitch('use-fake-device-for-media-stream')
  // The fake-UI flag auto-approves camera prompts and bypasses our permission handler,
  // so the permission-denied test runs without it.
  if (process.env.READYUP_E2E_DENY_CAMERA !== '1') app.commandLine.appendSwitch('use-fake-ui-for-media-stream')
  if (process.env.READYUP_FAKE_VIDEO) app.commandLine.appendSwitch('use-file-for-fake-video-capture', process.env.READYUP_FAKE_VIDEO)
  if (process.env.READYUP_DISABLE_GPU === '1') app.disableHardwareAcceleration()
  // Chromium's own network log covers every process, so tests can prove nothing left the machine.
  if (process.env.READYUP_NETLOG) app.commandLine.appendSwitch('log-net-log', process.env.READYUP_NETLOG)
}
const denyCameraForTest = E2E && process.env.READYUP_E2E_DENY_CAMERA === '1'

// MediaPipe needs WebGL to read camera frames, even when inference runs on the CPU. On machines
// whose GPU is blocklisted or broken, Chromium no longer falls back to its software renderer
// (SwiftShader) unless this flag is set. The flag is named "unsafe" because it widens attack
// surface for untrusted web content; Ready Up loads only its own bundled code under a strict CSP
// with no remote content, so the trade-off favours a working tracker.
app.commandLine.appendSwitch('enable-unsafe-swiftshader')

registerAppScheme()

const log = new EventLog()
const blockedRequests: Array<{ url: string; at: string }> = []
let store: SettingsStore
let mainWindow: BrowserWindow | null = null
const startup: StartupMetrics = { windowReadyMs: null }
let systemInfo: Promise<SystemInfo> | null = null

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })
}

function hardenSession(): void {
  const ses = session.defaultSession
  // Electron's spellchecker downloads Hunspell dictionaries from Google at startup on Linux, from
  // the browser process (outside the CSP and webRequest). Point it at a local path that doesn't
  // exist and clear the languages, so nothing is fetched.
  ses.setSpellCheckerDictionaryDownloadURL(`${APP_ORIGIN}/no-dictionaries/`)
  ses.setSpellCheckerLanguages([])
  ses.setSpellCheckerEnabled(false)

  ses.setPermissionRequestHandler((wc, permission, callback, details) => {
    const origin = details.requestingUrl || wc.getURL()
    const mediaTypes = 'mediaTypes' in details ? (details.mediaTypes ?? []) : []
    const ok = !denyCameraForTest && permission === 'media' && isTrustedOrigin(origin, devServer) && mediaTypes.every((m) => m === 'video')
    if (!ok) log.add({ type: 'permission.denied', data: { permission } })
    callback(ok)
  })
  ses.setPermissionCheckHandler((_wc, permission, origin) => !denyCameraForTest && permission === 'media' && isTrustedOrigin(origin, devServer))

  // Defence in depth on top of the CSP: nothing leaves the machine.
  ses.webRequest.onBeforeRequest({ urls: ['<all_urls>'] }, (details, callback) => {
    if (isLocalUrl(details.url, devServer)) return callback({})
    const entry = { url: details.url.slice(0, 200), at: new Date().toISOString() }
    blockedRequests.push(entry)
    log.add({ type: 'network.blocked', data: entry })
    callback({ cancel: true })
  })

  if (devServer) {
    ses.webRequest.onHeadersReceived((details, callback) => {
      const headers = { ...details.responseHeaders, 'Content-Security-Policy': [DEV_CSP] }
      callback({ responseHeaders: headers })
    })
  }
}

app.on('web-contents-created', (_e, contents) => {
  contents.on('will-navigate', (event, url) => {
    if (!isTrustedOrigin(url, devServer)) {
      event.preventDefault()
      log.add({ type: 'navigation.blocked', data: { url: url.slice(0, 200) } })
    }
  })
  contents.on('will-redirect', (event, url) => {
    if (!isTrustedOrigin(url, devServer)) event.preventDefault()
  })
  contents.on('will-attach-webview', (event) => event.preventDefault())
  contents.setWindowOpenHandler(() => ({ action: 'deny' }))
})

function trustedSender(e: IpcMainEvent | IpcMainInvokeEvent): boolean {
  const url = e.senderFrame?.url ?? ''
  return isTrustedOrigin(url, devServer)
}

function registerIpc(): void {
  const handle = <T>(channel: string, fn: (e: IpcMainInvokeEvent, ...args: unknown[]) => T): void => {
    ipcMain.handle(channel, (e, ...args) => {
      if (!trustedSender(e)) throw new Error('Untrusted sender')
      return fn(e, ...args)
    })
  }

  handle(IPC.systemInfo, () => (systemInfo ??= getSystemInfo()))
  handle(IPC.startupMetrics, () => startup)
  handle(IPC.getSettings, () => store.get())
  handle(IPC.updateSettings, (_e, patch) => store.update(SettingsPatchSchema.parse(patch)))

  ipcMain.on(IPC.log, (e, raw) => {
    if (!trustedSender(e)) return
    const parsed = LogEventSchema.safeParse(raw)
    if (!parsed.success || JSON.stringify(parsed.data).length > 16_384) return
    log.add(parsed.data)
  })

  handle(IPC.exportLog, async (_e, raw): Promise<ExportResult> => {
    const parsed = ExportPayloadSchema.safeParse(raw)
    if (!parsed.success) return { ok: false, reason: 'error', message: 'Invalid export request' }
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const name = `ready-up-diagnostics-${stamp}.json`
    let target: string | undefined
    if (E2E && process.env.READYUP_E2E_EXPORT_DIR) {
      mkdirSync(process.env.READYUP_E2E_EXPORT_DIR, { recursive: true })
      target = join(process.env.READYUP_E2E_EXPORT_DIR, name)
    } else {
      const res = await dialog.showSaveDialog(mainWindow ?? new BrowserWindow({ show: false }), {
        title: 'Export diagnostics log',
        defaultPath: join(app.getPath('documents'), name),
        filters: [{ name: 'JSON', extensions: ['json'] }]
      })
      if (res.canceled || !res.filePath) return { ok: false, reason: 'cancelled' }
      target = res.filePath
    }
    try {
      const doc = buildExport({ payload: parsed.data, system: await (systemInfo ??= getSystemInfo()), startup, settings: store.get(), events: log.all() })
      const text = JSON.stringify(doc, null, 2)
      writeFileAtomic(target, text)
      log.add({ type: 'log.exported', data: { bytes: text.length } })
      return { ok: true, path: target, bytes: text.length }
    } catch (err) {
      return { ok: false, reason: 'error', message: (err as Error).message }
    }
  })

  handle(IPC.openCameraSettings, async () => {
    if (process.platform === 'win32') {
      await shell.openExternal('ms-settings:privacy-webcam')
      return true
    }
    if (process.platform === 'darwin') {
      await shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Camera')
      return true
    }
    return false
  })
}

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1360,
    height: 880,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    backgroundColor: '#0C0F15',
    title: 'Ready Up',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      spellcheck: false,
      backgroundThrottling: false
    }
  })
  mainWindow = win
  win.once('ready-to-show', () => {
    startup.windowReadyMs = Date.now() - processStart
    log.add({ type: 'app.window_ready', data: { ms: startup.windowReadyMs } })
    if (process.env.READYUP_HIDDEN !== '1') win.show()
  })
  win.webContents.on('render-process-gone', (_e, details) => log.add({ type: 'renderer.gone', data: { reason: details.reason } }))
  win.on('closed', () => {
    mainWindow = null
  })
  void win.loadURL(devServer ?? `${APP_ORIGIN}/index.html`)
}

app.whenReady().then(() => {
  if (app.isPackaged) Menu.setApplicationMenu(null)
  handleAppProtocol(join(__dirname, '../renderer'))
  hardenSession()
  store = new SettingsStore(app.getPath('userData'), (message) => log.add({ type: 'settings.reset', data: { message } }))
  registerIpc()
  log.add({ type: 'app.start', data: { version: app.getVersion(), packaged: app.isPackaged } })
  createWindow()
})

app.on('window-all-closed', () => app.quit())

// Packaged-build self-test (READYUP_E2E=1 and READYUP_SELFTEST_OUT set): after the app has run for
// a while, write what happened to a file and quit. Lets us check fuses, asar and app:// serving in
// a real packaged build, where test tooling can't attach.
if (E2E && process.env.READYUP_SELFTEST_OUT) {
  const out = process.env.READYUP_SELFTEST_OUT
  const seconds = Number(process.env.READYUP_SELFTEST_SECONDS ?? '20')
  app.whenReady().then(() => {
    setTimeout(() => {
      writeFileAtomic(out, JSON.stringify({ packaged: app.isPackaged, startup, blockedRequests, events: log.all() }, null, 2))
      app.quit()
    }, seconds * 1000)
  })
}

// Read-only hooks for end-to-end tests (only when READYUP_E2E=1).
if (E2E) {
  Object.assign(globalThis, {
    __readyupTest: {
      blockedRequests: () => [...blockedRequests],
      events: () => log.all(),
      userData: () => app.getPath('userData')
    }
  })
}
