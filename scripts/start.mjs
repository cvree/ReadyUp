// One command to run Ready Up from source: installs what's missing, builds what's stale, opens the app.
// Used by `npm start` and by "Start Ready Up.cmd" (double-click on Windows).
import { spawn, spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const say = (m) => console.log(`\n  ${m}`)

function fail(message) {
  console.error(`\n  Ready Up couldn't start: ${message}\n`)
  process.exit(1)
}

function run(args, what) {
  say(`${what}…`)
  // npm is a .cmd file on Windows, which Node only runs through a shell.
  const r = spawnSync(npm, args, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' })
  if (r.status !== 0) fail(`"npm ${args.join(' ')}" failed. The messages above say why.`)
}

function mtime(path) {
  try {
    return statSync(path).mtimeMs
  } catch {
    return 0
  }
}

/** Newest modification time under a file or folder. */
function newest(path) {
  const st = statSync(path, { throwIfNoEntry: false })
  if (!st) return 0
  if (!st.isDirectory()) return st.mtimeMs
  let max = 0
  for (const name of readdirSync(path)) {
    if (name === 'node_modules' || name === 'mediapipe') continue
    max = Math.max(max, newest(join(path, name)))
  }
  return max
}

const [major, minor] = process.versions.node.split('.').map(Number)
if (major < 22 || (major === 22 && minor < 12)) {
  fail(`Node.js 22.12 or newer is needed, and this computer has ${process.versions.node}. Install the current LTS from https://nodejs.org and try again.`)
}

// Dependencies: missing, or older than the lockfile (for example after pulling an update).
const installed = mtime(join(root, 'node_modules/.package-lock.json'))
if (!installed || installed < mtime(join(root, 'package-lock.json'))) run(['ci'], 'Installing (first run takes a few minutes)')

// Build: missing, or older than any source file.
const built = Math.min(mtime(join(root, 'out/main/index.js')) || 0, mtime(join(root, 'out/renderer/index.html')) || 0)
const sources = Math.max(...['src', 'packages', 'package.json', 'electron.vite.config.ts', 'assets.lock.json'].map((p) => newest(join(root, p))))
if (!built || built < sources || process.argv.includes('--rebuild')) run(['run', 'build'], 'Building the app')
else if (!existsSync(join(root, 'out/renderer/mediapipe'))) run(['run', 'build'], 'Building the app')

say('Opening Ready Up.')
const electron = createRequire(import.meta.url)(join(root, 'node_modules/electron'))
const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE
const child = spawn(electron, [root, ...process.argv.slice(2).filter((a) => a !== '--rebuild')], { cwd: root, detached: true, stdio: 'ignore', env })
child.on('error', (e) => fail(e.message))
child.unref()
// Give a failed launch a moment to report before this window closes.
setTimeout(() => process.exit(0), 1500)
