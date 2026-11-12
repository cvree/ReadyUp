# Ready Up

Study, move, then play. A Windows desktop app that turns a study session and a short camera-counted exercise set into a "ready check" before gaming. Everything runs locally; video never leaves the computer and is never written to disk.

**Status: full app built, in real-camera testing.** First-run setup, the ready check (focus → move → play), camera setup, push-ups, knee push-ups, squats and sit-ups (Beta), overrides, game launching, history and Diagnostics are built and covered by 130 unit tests and 21 end-to-end tests. Rep counting is tested on synthetic movement only; accuracy on real people is being measured now. See [docs/PLAN.md](docs/PLAN.md), [docs/milestones/M1.md](docs/milestones/M1.md) and [docs/milestones/M2-M7.md](docs/milestones/M2-M7.md).

**Installers:** every push runs CI on GitHub; the unsigned Windows installers are attached to each run as the `ready-up-windows-installers` artifact (Actions → CI → latest run).

## Run it on your PC

**Easiest: the installer.** Open the latest CI run on GitHub (Actions → CI), download the `ready-up-windows-installers` artifact and run `Ready-Up-Setup-…-x64.exe`. It is unsigned for now, so Windows SmartScreen asks once: choose **More info → Run anyway**. Pushing a version tag (`v0.3.0`) also publishes the installers as a GitHub Release.

**From this folder:**

1. Install [Node.js 22 or newer](https://nodejs.org) (the LTS installer, default options).
2. Double-click **`Start Ready Up.cmd`**.

The first run installs and builds for a few minutes; after that it opens in seconds, and rebuilds by itself whenever the source changed. From a terminal the same thing is `npm start`.

The window reopens where you left it, and **F11** switches full screen.

## The camera

- **Picks the right camera.** On a first run it skips infrared (Windows Hello) and virtual cameras that sit next to the real webcam; after that it remembers your choice, by name if Windows hands out a new ID.
- **Looks after itself.** Reconnects when the camera is plugged back in, starts when you plug one in on the "no camera" screen, restarts a frozen camera, and doesn't cry wolf while the window is minimised. A driver that never answers gets a clear message instead of an endless spinner.
- **Readable from the floor.** A status line says whether it is tracking you; the count sits on the picture with a progress ring; the frame pulses green for a counted rep and amber for one that didn't count. With sounds on (Settings), each counted rep ticks.
- **Hands-free start.** During a ready check, once every setup check is green, hold the position for 3 seconds and the set starts by itself.
- **Keys on the picture:** `F` fills the window (count and coaching line enlarge), `M` mirrors, `C` switches camera, `Esc` goes back.

## Landing page

The public site lives in `site/` (plain HTML, self-hosted fonts, no trackers) and deploys to GitHub Pages at https://cvree.github.io/ReadyUp/ through `.github/workflows/pages.yml` whenever `site/` changes on `main`.

## Requirements

- Node.js 22.12 or newer (CI uses 22, see `.nvmrc`)
- Windows 10/11 to run the installers. Development also works on macOS and Linux.

## Commands

| Command | What it does |
|---|---|
| `npm ci` | Install dependencies. Electron 44 downloads its binary the first time it runs |
| `npm start` | Install if needed, build if stale, open the app (what `Start Ready Up.cmd` runs) |
| `npm run dev` | Run the app with hot reload |
| `npm run typecheck` | Strict TypeScript checks. Pure packages compile with no DOM or Node types |
| `npm run lint` | ESLint, including the pure-package import boundary |
| `npm test` | Repository media check + unit and synthetic-movement tests (Vitest) |
| `npm run test:e2e` | Build, then drive the real Electron app with Playwright and Chromium's fake camera |
| `npm run test:e2e:linux` | Same, under `xvfb-run` for Linux machines without a display |
| CI (`.github/workflows/ci.yml`) | Linux checks + end-to-end, Windows end-to-end, unsigned installers as artifacts |
| `npm run dist:win` | Build unsigned Windows installers (x64 and arm64) into `release/` |
| `npm run assets` | Fetch and hash-check the bundled MediaPipe runtime and pose models (runs automatically before `dev` and `build`) |

Building Windows installers on Linux needs Wine (32-bit and 64-bit), because NSIS generates the uninstaller by running part of the installer.

## Layout

```
packages/pose-types   33-landmark pose types (no DOM, no Node)
packages/exercise     geometry, smoothing, side selection, position checks, rep state machine
packages/sim          synthetic skeleton generator and named movement presets
packages/session      routine, measured focus timer, sessions, history records, weekly stats
src/main              Electron main process: security, app:// protocol, settings, logs, system info
src/preload           the only bridge between UI and main (typed, minimal)
src/renderer          screens, session controller, camera service, pose worker (MediaPipe), engine
e2e                   end-to-end tests against the built app
site                  landing page (GitHub Pages)
scripts               asset preparation, notices, repository checks, icon
```

## Privacy and security

- No network access at runtime. The pose model and runtime are bundled and verified against `assets.lock.json`. A test records Chromium's network log across all processes and fails on any remote URL.
- Camera frames stay in memory and go to a worker as transferable bitmaps; they are never encoded or saved. A test scans app data for image or video files after a session.
- Exported diagnostics logs contain no images, and no pose landmarks unless you tick the option.
- Renderer is sandboxed with context isolation, a strict CSP with no remote origins, and navigation and new windows blocked. Packaged builds disable Electron's run-as-Node, `NODE_OPTIONS` and inspector fuses.

## Licenses

Third-party components and their licenses are listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) (generated by `scripts/notices.mjs`), which also ships inside the app.
