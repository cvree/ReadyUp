import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'

const NODE_BUILTINS = [
  'assert', 'buffer', 'child_process', 'cluster', 'crypto', 'dgram', 'dns', 'events', 'fs', 'fs/promises',
  'http', 'https', 'module', 'net', 'os', 'path', 'process', 'stream', 'timers', 'tls', 'url', 'util',
  'v8', 'vm', 'worker_threads', 'zlib'
]

export default tseslint.config(
  { ignores: ['out/**', 'dist/**', 'release/**', 'node_modules/**', 'src/renderer/public/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node } },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }]
    }
  },
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn'
    }
  },
  {
    // Pure packages: no Electron, no Node built-ins, no DOM, no `any`.
    files: ['packages/*/src/**/*.ts'],
    languageOptions: { globals: {} },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      'no-restricted-imports': ['error', {
        paths: ['electron', ...NODE_BUILTINS],
        patterns: ['node:*', 'electron/*', 'react', 'react-dom']
      }],
      'no-restricted-globals': ['error', 'window', 'document', 'navigator', 'process', 'require', 'Buffer', 'global', 'globalThis', 'self']
    }
  }
)
