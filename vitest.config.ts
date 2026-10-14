import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@readyup/pose-types': resolve(__dirname, 'packages/pose-types/src/index.ts'),
      '@readyup/exercise': resolve(__dirname, 'packages/exercise/src/index.ts'),
      '@readyup/sim': resolve(__dirname, 'packages/sim/src/index.ts'),
      '@readyup/session': resolve(__dirname, 'packages/session/src/index.ts'),
      '@shared': resolve(__dirname, 'src/shared')
    }
  },
  test: {
    include: ['packages/*/test/**/*.test.ts', 'src/**/*.test.ts', 'test/**/*.test.ts'],
    environment: 'node'
  }
})
