import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// Pure packages must not depend on Electron, Node built-ins or the DOM, so counting logic can be
// tested on recorded data and reused anywhere. (tsconfig.packages.json also compiles them with no
// DOM or Node type libraries, and ESLint enforces the same rule.)
const PURE = ['packages/pose-types/src', 'packages/exercise/src', 'packages/sim/src', 'packages/session/src']
const FORBIDDEN_IMPORT = /from\s+['"](electron|node:[^'"]+|fs|path|os|child_process|crypto|react|react-dom)['"]/
const FORBIDDEN_GLOBAL = /\b(window|document|navigator|process|require|Buffer|localStorage|fetch)\s*[.([]/

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    return statSync(p).isDirectory() ? files(p) : p.endsWith('.ts') ? [p] : []
  })
}

describe('module boundaries', () => {
  for (const dir of PURE) {
    it(`${dir} imports nothing from Electron, Node or the DOM`, () => {
      const offenders: string[] = []
      for (const f of files(dir)) {
        const src = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')
        if (FORBIDDEN_IMPORT.test(src)) offenders.push(`${f}: forbidden import`)
        if (FORBIDDEN_GLOBAL.test(src)) offenders.push(`${f}: forbidden global`)
      }
      expect(offenders).toEqual([])
    })
  }

  it('the checker itself catches violations', () => {
    expect(FORBIDDEN_IMPORT.test("import { app } from 'electron'")).toBe(true)
    expect(FORBIDDEN_IMPORT.test("import fs from 'node:fs'")).toBe(true)
    expect(FORBIDDEN_GLOBAL.test('window.addEventListener(')).toBe(true)
    expect(FORBIDDEN_GLOBAL.test('const shadow = 1')).toBe(false)
  })
})
