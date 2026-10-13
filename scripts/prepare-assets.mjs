// Prepares the third-party runtime assets bundled with the app so tracking works fully offline:
//  - MediaPipe Tasks Vision WASM (copied from node_modules)
//  - Pose Landmarker models (downloaded from pinned, versioned URLs)
// Every file is verified against assets.lock.json. Run with --update-lock to record new hashes.
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Node's built-in fetch ignores HTTPS_PROXY unless NODE_USE_ENV_PROXY is set at startup.
if (process.env.HTTPS_PROXY && !process.env.NODE_USE_ENV_PROXY) {
  const r = spawnSync(process.execPath, process.argv.slice(1), { stdio: 'inherit', env: { ...process.env, NODE_USE_ENV_PROXY: '1' } })
  process.exit(r.status ?? 1)
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const lockPath = join(root, 'assets.lock.json')
const outDir = join(root, 'src/renderer/public/mediapipe')
const update = process.argv.includes('--update-lock')
const lock = JSON.parse(readFileSync(lockPath, 'utf8'))

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex')

function verify(entry, buf) {
  const hash = sha256(buf)
  if (!entry.sha256 || update) {
    entry.sha256 = hash
    entry.bytes = buf.length
    return
  }
  if (hash !== entry.sha256) {
    throw new Error(`Hash mismatch for ${entry.path}\n  expected ${entry.sha256}\n  got      ${hash}`)
  }
}

async function main() {
  for (const entry of lock.files) {
    const dest = join(outDir, entry.path)
    mkdirSync(dirname(dest), { recursive: true })
    if (existsSync(dest) && !update && entry.sha256 && sha256(readFileSync(dest)) === entry.sha256) continue
    let buf
    if (entry.from === 'npm') {
      buf = readFileSync(join(root, 'node_modules', entry.source))
    } else {
      process.stdout.write(`Downloading ${entry.source}\n`)
      const res = await fetch(entry.source)
      if (!res.ok) throw new Error(`Download failed (${res.status}) for ${entry.source}`)
      buf = Buffer.from(await res.arrayBuffer())
    }
    verify(entry, buf)
    writeFileSync(dest, buf)
  }
  if (update) writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n')
  console.log(`Assets ready (${lock.files.length} files verified) in src/renderer/public/mediapipe`)
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
