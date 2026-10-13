import type { ReadyUpApi } from './api'

declare global {
  interface Window {
    readyup: ReadyUpApi
  }
}
export {}
