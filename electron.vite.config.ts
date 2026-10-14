import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

const alias = {
  '@readyup/pose-types': resolve(__dirname, 'packages/pose-types/src/index.ts'),
  '@readyup/exercise': resolve(__dirname, 'packages/exercise/src/index.ts'),
  '@readyup/sim': resolve(__dirname, 'packages/sim/src/index.ts'),
  '@readyup/session': resolve(__dirname, 'packages/session/src/index.ts'),
  '@shared': resolve(__dirname, 'src/shared')
}

export default defineConfig({
  main: {
    resolve: { alias },
    build: { outDir: 'out/main' }
  },
  preload: {
    resolve: { alias },
    build: {
      outDir: 'out/preload',
      // Sandboxed preloads must be CommonJS.
      rollupOptions: { output: { format: 'cjs', entryFileNames: '[name].cjs' } }
    }
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    publicDir: resolve(__dirname, 'src/renderer/public'),
    resolve: { alias },
    plugins: [react()],
    worker: { format: 'es' },
    build: {
      outDir: 'out/renderer',
      rollupOptions: { input: resolve(__dirname, 'src/renderer/index.html') }
    }
  }
})
