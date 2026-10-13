// Fails if camera media or real pose data is tracked in git.
// Synthetic pose fixtures may live only in packages/sim/fixtures/.
import { execFileSync } from 'node:child_process'

const VIDEO = /\.(mp4|mov|webm|avi|mkv|m4v|y4m|mjpe?g)$/i
const IMAGE = /\.(png|jpe?g|gif|bmp|webp|heic)$/i
const POSE = /\.pose\.jsonl?$/i
const TEST_DIRS = /(^|\/)(e2e|test|tests|fixtures|footage[^/]*|recordings|exports)\//i

export function findViolations(files) {
  const out = []
  for (const f of files) {
    if (VIDEO.test(f)) out.push(`${f}: video files are not allowed in the repository`)
    else if (IMAGE.test(f) && TEST_DIRS.test(f)) out.push(`${f}: test images are not allowed in the repository`)
    else if (POSE.test(f) && !f.startsWith('packages/sim/fixtures/')) out.push(`${f}: pose data outside packages/sim/fixtures/`)
  }
  return out
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' })
    .split('\n').filter(Boolean)
  const violations = findViolations(files)
  if (violations.length) {
    console.error('Repository check failed:\n  ' + violations.join('\n  '))
    process.exit(1)
  }
  console.log(`Repository check passed (${files.length} files).`)
}
