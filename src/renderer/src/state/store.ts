import { create } from 'zustand'
import type { ActiveSession, SessionRecord } from '@readyup/session'
import { DEFAULT_SETTINGS, type RuntimeConfig, type Settings } from '@shared/ipc'

export type Screen =
  | 'boot' | 'onboarding' | 'lobby' | 'focus' | 'review' | 'setup' | 'move' | 'ready' | 'history' | 'settings' | 'diagnostics'

export interface AppStore {
  screen: Screen
  /** Where camera setup returns to when it's finished. */
  returnTo: Screen | null
  settings: Settings
  runtime: RuntimeConfig
  active: ActiveSession | null
  /** The active session was restored after a restart; the Lobby offers Resume or Discard. */
  recovered: boolean
  /** The focus timer paused because the PC went to sleep. */
  sleptDuringFocus: boolean
  history: SessionRecord[]
  toast: { text: string; tone: 'info' | 'error' } | null
  reducedMotion: boolean
}

export const useStore = create<AppStore>(() => ({
  screen: 'boot',
  returnTo: null,
  settings: DEFAULT_SETTINGS,
  runtime: { timeScale: 1, e2e: false },
  active: null,
  recovered: false,
  sleptDuringFocus: false,
  history: [],
  toast: null,
  reducedMotion: false
}))
