# Ready Up: Build Plan

Version 2 · 13 October 2026 · **Decisions approved. Milestone 1 acceptance criteria awaiting sign-off. No application code written yet.**
Visual direction (approved): `docs/design/visual-direction.html`.

---

## 0. Approved decisions

| # | Topic | Decision |
|---|---|---|
| 1 | Platform | **Windows first.** The app detects and reports the exact Windows version, build and architecture at runtime (see §6.5). Start with the desktop webcam. Support any phone camera Windows presents as a webcam. iPhone support is not a v0.1 blocker. |
| 2 | Stack | Electron + React + TypeScript + local MediaPipe. ~100 MB installer is acceptable. Startup and camera performance must stay responsive (targets in §6.4). |
| 3 | Push-up standard | Elbow ≤ 100° is a **provisional counting threshold**, not a definition of good form. A rep needs a visible top → bottom → top cycle, a plausible push-up body position, and adequate landmark visibility. Thresholds are inspectable and adjustable in Diagnostics and get revised after real-camera tests. **Knee push-ups** are a separate, clearly named exercise, never treated as failed standard push-ups. |
| 4 | Override & corrections | An override or manual alternative **may unlock Launch**, recorded honestly as an override. Unobserved movement is **never** added to the camera-counted total. Manual ±1 corrections are stored and shown separately in session details. |
| 5 | Sit-ups | Full sit-ups as their own exercise, labeled **Beta** until real-camera testing supports it. Crunches may come later as a separate exercise; the two are never counted as the same movement. |
| 6 | Games | **Overwatch 2** and **Marvel Rivals** first. You pick the installed shortcut or launcher during setup; the app assumes nothing about install locations. A launch counts as one *Ready Up game session*, not a match. Matches can be logged manually. |
| 7 | Test data | You run real-camera tests from a short script; no video recording required. Development uses synthetic movement fixtures and footage with clear reuse rights. **Your video and pose data never go in the repository.** |
| 8 | Visual | "The Ready Check" direction and mockups approved, including Diagnostics and error states. Dark theme only for v1. |
| 9 | Sound | Completion sound off by default, optional setting to enable it. |
| 10 | Signing | No certificate. Unsigned installer for development; signing never blocks the prototype. Public-release requirements are listed in §11. |
| 11 | Review | A commit at each completed milestone on the dedicated project branch. No pull requests, no merges, no releases. You review each milestone before the next starts. |

**Branch note.** The project branch is `claude/friendly-galileo-0oqqd3`. My build environment is a temporary cloud container that is deleted when idle, so a commit that exists only inside it would be lost. I therefore **push each milestone commit to that branch** so you can review it. That is a branch push only: no pull request, merge, tag, or release. If you'd rather I keep commits unpushed, tell me and I'll stop pushing, with the risk that work can be lost.

---

## 1. The product

Ready Up is a Windows desktop commitment device for earning game time. A session is a **ready check** with three slots: **Focus** (a measured study timer with a task you name), **Move** (camera-counted reps, 10 push-ups by default), and **Play** (a Launch button for your game that unlocks when Focus and Move are done). Everything runs locally. Video never leaves the computer and is never written to disk.

What it is honest about:

- **The timer is measured; the study is self-reported.** Ready Up records how long the focus timer ran (excluding pauses and sleep). Whether you finished your task is something you confirm.
- **The game unlock is Ready Up's own button.** It doesn't block your game, launcher or desktop shortcut. Setup says so plainly.
- **Rep counts are camera estimates.** Camera-counted reps, your manual corrections, and self-reported overrides are stored and shown as three separate things.
- **A launch is a game session, not a match.** Ready Up records that it opened your game. It can't see matches; you can log them yourself.

---

## 2. Experience

### 2.1 Principles

1. The next action is always the biggest thing on screen, reachable with Enter.
2. Encourage, never scold. Feedback says what to change next.
3. Every rep that doesn't count gets a reason.
4. Calm during focus, energy during move, one brief moment at the end.
5. Local and private: no accounts, no network calls, no analytics.

### 2.2 Core loop

```
 Lobby ──Enter──▶ Focus (25:00) ──timer ends──▶ "Did you finish?" ──▶ Move
   ▲                                                                   │
   │                                                    camera setup (first time / if needed)
   │                                                                   ▼
   └──── "Not now" ◀── Ready! (Launch unlocked) ◀──10/10── Rep counting
```

### 2.3 Screens

**First run (under a minute, every step skippable)**

| Step | Screen | What it does | Primary action |
|---|---|---|---|
| 1 | Welcome | "Study, move, then play." | Get started |
| 2 | Your routine | Prefilled 25 min + 10 push-ups. Steppers; exercise picker. | Looks good |
| 3 | Your games | "Choose the shortcut you use to start Overwatch 2 / Marvel Rivals." File picker accepting `.lnk`, `.url`, `.exe`, or paste a launcher link. Shows exactly what was chosen. **Test launch** button. Honesty note about the unlock. | Save / Skip for now |
| 4 | Camera check | Why we ask, then Windows' prompt if needed. Short placement preview. Can defer. | Check my camera / Later |
| 5 | Lobby | Cursor in "What are you studying?" | Start focus |

**Main screens** (unchanged from v1; mockups in the visual direction page)

| Screen | Content | Primary action | Keys |
|---|---|---|---|
| Lobby | Ready-check bar, task field, chosen game, one quiet progress line | Start focus | Enter, `E` edit routine, `H` history |
| Focus | Large timer, task, slim progress line, Pause, End early | Pause/Resume | Space, Esc |
| Focus complete | "Did you finish *task*?" Yes / Partly / Not this time; all continue | Continue | 1/2/3 |
| Camera setup | Live preview, ghost silhouette, checks: In frame, Distance, Angle, Lighting; camera switcher | I'm set | Tab cycles cameras |
| Move | Preview, quiet skeleton, count "4 / 10", depth gauge, feedback line, −1/+1, "Can't use the camera?" | (reps drive it) | `-` `+` `O` |
| Ready | Lock-in moment, honest summary, Launch *game* | Launch | Enter |
| History | Week strip, weekly totals, recent sessions with tags | Back | |
| Session details | Focus time, task answer, camera-counted reps, corrections (each with time), override reason, game launched, matches logged | Log a match | |
| Settings | Routine, exercises, camera, games, accessibility, sound, data | | |
| Diagnostics | §5 | | Ctrl+Shift+D |

**Designed states:** empty, model loading, permission denied (Windows: Settings → Privacy & security → Camera, with "Let desktop apps access your camera"), no camera, camera disconnected mid-set, person partly visible (names the body part), head not visible, too far (> ~4 m), low light/backlit, completed.

### 2.4 Rep records, corrections and overrides

Each Move phase stores separate fields, never merged:

| Field | Source | Shown as |
|---|---|---|
| `cameraCounted` | Rep state machine only | "8 push-ups, camera-counted" |
| `corrections[]` | −1/+1 presses, each with timestamp and the camera count at that moment | "+2 manual corrections" |
| `override` | Reason (injury / accessibility / camera not working / other), choice (other exercise, self-reported reps, skipped), self-reported count | "Move: override (camera not working), 10 reps self-reported" |

- Move is complete when `cameraCounted + net corrections ≥ target`, or an override is confirmed.
- Lifetime and weekly "camera-counted push-ups" totals include only `cameraCounted`.
- Overrides unlock Launch and are labeled in History and Session details without judgment.

### 2.5 Games

- **Setup:** you choose the shortcut you already use for each game: a desktop or Start-menu shortcut (`.lnk`), an internet shortcut (`.url`, which is what Steam creates), a launcher executable, or a launcher link you paste (e.g. a `steam://` or `battlenet://` link). Ready Up stores exactly that target and shows it back to you. It never scans or guesses install locations.
- **Launch:** Ready Up asks Windows to open that shortcut (the same as double-clicking it). It does not interact with the game process, so it never touches anti-cheat.
- **Recording:** each launch creates a *game session* record linked to the ready check. A "Log a match" button in Session details lets you add matches manually.
- **Allowlist:** pasted links are limited to known launcher schemes (Steam, Battle.net, Epic), editable in Settings.

### 2.6 Phone camera (not a v0.1 blocker)

Ready Up uses any camera Windows lists as a webcam. iPhone + Windows has no built-in route (Continuity Camera is Mac-only), so it needs a third-party webcam app on both devices (e.g. Camo, iVCam, DroidCam). The in-app guide will link to these without endorsing them and give placement tips. Android 14+ phones can act as a USB webcam with no app, and Windows 11 Phone Link supports Android phones as connected cameras. Direct phone pairing stays deferred.

---

## 3. Visual direction: "The Ready Check" (approved)

- **Signature:** the ready-check bar, three slots (Focus, Move, Play).
- **Palette:** ink, slate, paper text; one tint per phase: moonlight → ember → lamp gold.
- **Type:** Anybody (display, variable width/weight), Instrument Sans (UI), IBM Plex Mono (Diagnostics). OFL, bundled.

**Level-content rule.** Only the slot *edges* are slanted (a clip-path on the slot background). Text, numerals, icons, buttons, form fields and every camera-guidance overlay stay level and unskewed. Focus rings follow the element's real rectangle, not the slant.

**Completion moment: brief.**

| | Full motion | Reduced motion |
|---|---|---|
| Duration | ≤ 1.1 s total | ≤ 0.4 s total |
| Slots | Snap into place, 60 ms stagger | Already filled; fade in together |
| READY | Widens from condensed to full width (font width axis) | Appears at full width with a soft fade |
| Launch button | One light sweep crosses it once | Rendered already "lit": a still gold highlight band, no movement |
| Sound | Optional chord (off by default) | Same, if enabled |
| Input | Enter works immediately; animation never blocks the button | Same |

Reduced motion follows Windows' "Animation effects" setting and an in-app toggle. Both versions show identical information.

---

## 4. Rep counting

### 4.1 Reference evaluation (unchanged)

`parhamsoltani/pushup_counter`: MIT, © 2025 parhamsoltani. Python on MediaPipe's legacy API. It counts at the bottom (so half reps count), averages a visible arm with a hidden one, uses only the left side for alignment, has no plank check (standing arm curls count), and has no smoothing, timing limits or explanations. We reimplement in TypeScript without copying code and credit the project in `THIRD_PARTY_NOTICES.md`. Its sample video has no stated source and is not used or redistributed.

### 4.2 Pose model facts that shape the design

From Google's model card for the BlazePose GHUM 3D model behind Pose Landmarker (**Apache-2.0**, verified):

- **Tracks one person.** If two people are in view, it tracks only one. Setup says so.
- **Out of scope when the head isn't visible** or the person is **farther than ~4 m (14 ft)**. These become explicit setup checks.
- **Accuracy degrades in low light, noise and motion.** Hence the lighting check and confidence gating.

### 4.3 Pipeline (all exercises)

```
camera frame ─▶ Pose Landmarker (worker, local) ─▶ 33 landmarks + visibility + world coords
   (never stored)        │
                         ▼
        side selection (hysteresis) → One-Euro smoothing → angles, torso angle, framing
                         ▼
        gating: plausible body position? adequate visibility?  (named failures)
                         ▼
        rep state machine: WAITING → TOP → DESCENDING → BOTTOM → ASCENDING → TOP (+1)
                         ▼
        RepEvent { counted | rejected | voided, reason, minAngle, maxAngle, duration, side, confidence }
```

### 4.4 Exercise definitions

All thresholds below are **provisional starting values**, shown and adjustable in Diagnostics, to be revised after real-camera tests.

| Exercise | Primary signal | Position gate | Top | Bottom | Status |
|---|---|---|---|---|---|
| **Push-up** | Elbow angle (camera-facing side) | Torso within ~35° of horizontal; shoulder–hip–ankle ≥ ~150°; wrist below shoulder | ≥ 150° | ≤ 100° | M3, validated by your tests |
| **Knee push-up** | Elbow angle | Torso near horizontal; knees on floor (knee near floor line); shoulder–hip–knee ≥ ~150° | ≥ 150° | ≤ 100° | M5, separate exercise |
| **Squat** | Knee angle | Standing start, torso upright-ish, feet visible | ≥ 160° | ≤ 100° or hip at knee height | M5 |
| **Sit-up (full)** | Torso angle to floor | Lying start, knees bent | ≥ 70° | ≤ 20° | M5, **Beta** |

A rep counts only on a complete **top → bottom → top** cycle within 0.5–10 s, with the position gate and visibility (≥ 0.6 on required joints, brief < 300 ms dropouts tolerated) holding throughout. Losing tracking mid-rep **voids** that rep and returns to WAITING, which prevents surprise counts. A movement that fits a different exercise is rejected with a reason (e.g. "That looked like a knee push-up. Switch exercise if that's what you're doing."), never counted as the other exercise.

### 4.5 Camera setup checks

| Check | Passes when | Hint |
|---|---|---|
| In frame | Head and all required joints visible ≥ 0.6 inside a 3% margin | Names the missing part |
| Distance | Body spans ~50–85% of the frame; estimated distance < 4 m | "Move the camera back about a step" / "Move closer" |
| Angle | Exercise-specific (side-on for push-ups) | "Turn so your side faces the camera" |
| Lighting | Mean luminance above threshold, confidence steady | "Turn on a light in front of you" |
| One person | Only one person visible (heuristic) | "Only one person can be tracked" |

---

## 5. Diagnostics

Dev-grade from M1 (it's how we tune counting), polished in M6.

- **System:** Windows edition, version (e.g. 24H2), build, architecture, whether the app runs natively or under emulation, Electron/Chromium versions, GPU.
- **Camera:** device, resolution, fps, state; one-click switcher.
- **Model:** variant, delegate (GPU/CPU), load time, inference ms, fps.
- **Tracking:** 33 landmarks with visibility; chosen side; joint labels on the video.
- **Exercise:** phase, live angle trace with threshold lines, gate checks pass/fail.
- **Rep log:** every attempt (counted/rejected/voided) with reason and metrics.
- **Controls:** reset session, −1/+1 (logged as corrections), threshold sliders (marked "test values", reset to defaults).
- **Input:** Live camera · Simulated (M1); Video file and Pose recording (M3+).
- **Record:** pose recording to your local app-data folder only.
- **Export log:** JSON with system info, settings, events and rep metrics. **Never video or images. Excludes pose landmarks unless you tick "include pose data".**

---

## 6. Architecture

### 6.1 Choices

| Area | Choice |
|---|---|
| Shell | Electron (current stable, pinned) |
| UI | React + strict TypeScript, electron-vite |
| Pose | `@mediapipe/tasks-vision` Pose Landmarker in a Web Worker; model + WASM bundled; GPU with CPU fallback |
| Logic | Pure TypeScript packages (`exercise`, `session`, `sim`), no DOM/Node imports |
| State | Typed state machines; Zustand for UI |
| Motion | CSS + Motion (motion.dev), reduced-motion aware |
| Storage | Versioned JSON, atomic writes, zod validation, behind an interface |
| Packaging | electron-builder, NSIS installer, unsigned for development |
| Tests | Vitest, Playwright for Electron, axe-core |

### 6.2 Modules

```
src/main/       storage/ launcher/ diagnostics-log/ platform/ (windows-info, permissions) ipc/
src/preload/    typed contextBridge API
src/renderer/   camera/ pose/ ui/ app/
packages/       exercise/ session/ sim/ pose-types/
```

Boundaries are enforced by lint rules: `packages/*` import nothing from Electron, Node or the DOM; the renderer never imports `main`; all cross-process traffic goes through typed, validated IPC.

### 6.3 Security and privacy

`contextIsolation`, `sandbox`, no `nodeIntegration`, strict CSP with no remote origins, no runtime network access, no telemetry, no auto-update. Frames live only in memory. The launcher opens only targets you chose, with argument arrays (never shell strings).

### 6.4 Performance targets (measured on your PC, reported honestly)

| Measure | Target |
|---|---|
| Window visible after launch | ≤ 2 s |
| Camera preview after selecting a camera | ≤ 1 s |
| Pose tracking ready (model loaded) | ≤ 3 s |
| Tracking rate, full model | ≥ 20 fps (auto-switch to lite model below 15 fps) |
| UI responsiveness during tracking | No main-thread task > 50 ms caused by pose work |

### 6.5 Windows version and architecture: detected, not guessed

My build environment is **Linux x86_64 (Ubuntu 24.04.5 LTS, Node 22.22.0)**. It has no access to your PC, so **I cannot see your Windows version or architecture from here.** Instead:

- The app reads them at runtime and shows them in Diagnostics → System. It uses the Windows registry (edition, `DisplayVersion` such as 24H2, build and revision), maps build ≥ 22000 to Windows 11 (the registry's ProductName still says "Windows 10" on 11), and reports the processor architecture plus whether the app runs natively or emulated (an x64 build on an ARM PC runs emulated).
- Until you've run it once, M1 ships **both x64 and arm64 installers**. Diagnostics tells you which one matches your PC. After that, I build only your architecture.
- If you'd like to tell me sooner: Settings → System → About → "System type" and "Windows specifications".

---

## 7. Milestones

A commit (pushed to the project branch, see §0) at the end of each milestone, then a stop for your review.

| # | Milestone | You can try | I test | Needs your hands-on |
|---|---|---|---|---|
| **1** | Spec, visual direction, flow, technical proof of concept | The PoC app on Windows: camera, live skeleton, provisional push-up counting with reasons, Diagnostics | §8.1 automated criteria | M1 test script (§9) |
| **2** | Onboarding and core interface | First-run setup and the whole loop with simulated reps, completion moment in both motion modes | Playwright flows (incl. keyboard-only), axe-core, screenshots, contrast | Look, copy, completion moment |
| **3** | Camera, pose tracking, dependable push-ups | Real push-ups end to end, camera setup checks, disconnects, corrections, overrides | Synthetic + fault-injection suites, licensed-footage pipeline tests | Push-up test script; thresholds revised from your results |
| **4** | Timer, tasks, games, history | A full session ending in Overwatch 2 or Marvel Rivals launching; Session details; manual match logging | Fake-clock timer tests, kill-and-relaunch tests, storage corruption, mocked launcher | Choose your real shortcuts; confirm both games launch |
| **5** | Knee push-ups → squats → sit-ups (Beta), each separately | Each exercise in a full session | Per-exercise suites incl. movements that must not count, cross-exercise rejection | A short script per exercise |
| **6** | Diagnostics, accessibility, error recovery, polish | Polished Diagnostics (video/recording inputs), optional sound, every error state | axe-core + screen-reader pass (Narrator), fault injection, export contains no images | Diagnostics usability |
| **7** | Automated checks, real-camera testing, installer | Final unsigned installer | Full suite; install/upgrade/uninstall | Final script; clean install |

**v0.1 = milestones 1–4.**

---

## 8. Verification

### 8.1 Test tiers

| Tier | Input | Proves |
|---|---|---|
| Unit | Hand-written values | Math, timer, storage, launcher arguments |
| Synthetic | Generated skeletons (tempo, depth, noise, dropout, side flips) | State-machine logic. **Not accuracy.** |
| Pipeline | Footage with clear reuse rights, fed as a fake webcam | Camera → MediaPipe → counter works end to end |
| End-to-end | Electron + fake camera | Flows, states, restart recovery |
| Real camera | You, live, from a script | Accuracy on your PC, room and body |

No exercise is labeled dependable from synthetic or footage tests alone.

### 8.2 Test footage policy

- Only footage whose license I've verified on its source page (CC0, CC-BY or public domain preferred) is used. Each clip gets a manifest entry: source URL, license, author, attribution text and my hand-labeled rep count.
- Footage is downloaded by script into a git-ignored cache. It is **not committed**, even when its license would allow it, which keeps the repo small and clean.
- **Blocker found:** this environment's network policy denies `commons.wikimedia.org`, `upload.wikimedia.org` and `www.pexels.com`. To use licensed footage, either allow `commons.wikimedia.org` and `upload.wikimedia.org` in the environment's network settings (environment menu → Edit → Network access → Allowed domains), or point me to a clip whose license you've checked. Until then, pipeline tests only verify that the model loads and runs offline. Detection quality is verified by your real-camera script.
- Your video and pose data are never committed. Diagnostics recordings and exports stay in your local app-data folder.

### 8.3 Scenario matrix (each exercise)

Full reps (normal/slow/fast/pauses) all count. Partial reps (half depth, top bounces, no lockout, down-and-stay) never count and show the right reason. Jitter, side flips and landmark jumps give exactly one count per rep. Not exercising (arm curls, kneeling, reaching, walking past) gives zero. Occlusion mid-rep voids only that rep. Camera unplug/reconnect/switch keeps the count. Restarts restore state with no duplicates.

---

## 9. Milestone 1: acceptance criteria (for your sign-off)

M1 delivers the project foundation and a **proof of concept**, not the designed app. The PoC is a single Diagnostics-style window using the approved tokens and fonts but not the final screens (those are M2). Counting in M1 is provisional and explicitly labeled *"Logic tested on synthetic data. Accuracy not yet measured."*

### A. Foundation

- A1. From a clean clone: `npm ci`, `npm run typecheck`, `npm run lint`, `npm test` and `npm run build` all pass in my environment. Node version pinned.
- A2. TypeScript strict mode on, with no `any` escapes in `packages/`.
- A3. Lint rule plus a test that fails if `packages/exercise`, `packages/sim` or `packages/pose-types` import Electron, Node built-ins or DOM APIs.
- A4. Electron hardening verified by a test: `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, CSP with no remote origins, navigation and new windows blocked.
- A5. `THIRD_PARTY_NOTICES.md` lists Electron (MIT), MediaPipe tasks-vision (Apache-2.0), the pose model (Apache-2.0, per model card), the three fonts (OFL), and credits `parhamsoltani/pushup_counter` (MIT, used as reference only, no code copied).
- A6. `.gitignore` excludes footage cache, recordings, exports and build output. A repo check fails if any video/image test media or `*.pose.json` outside `packages/sim/fixtures/` (synthetic only) is committed.

### B. Offline pose pipeline

- B1. The model (`pose_landmarker_full.task` and `_lite`) and the MediaPipe WASM files are bundled in the app. Source URLs and SHA-256 hashes are recorded.
- B2. An automated test launches the built app with all network requests intercepted and passes only if it makes **zero** non-local requests while loading the model and processing frames.
- B3. Pose estimation runs in a Web Worker. Frames are transferred as bitmaps and never encoded or written anywhere.
- B4. GPU delegate is tried first with automatic CPU fallback. The active delegate is shown in Diagnostics, and the fallback path is covered by a test.
- B5. Automated test in headless Chromium: the model loads and processes frames from a fake camera, reporting load time and inference time. (Detection quality on real people is not claimed here; see §8.2.)

### C. Camera

- C1. Lists every video input Windows exposes, including phone-webcam apps if installed. The chosen camera is remembered across restarts by device ID with a label fallback.
- C2. Permission denied shows a clear message with the Windows settings path and a button that opens it (`ms-settings:privacy-webcam`).
- C3. Unplugging the camera shows "Camera disconnected" within 2 s and keeps the count. Reconnecting or choosing another camera resumes. Covered by an automated test that ends the media track, and by your script.
- C4. No camera frames are written to disk. An automated test scans the app-data folder after a session for image/video files and expects none.

### D. Push-up counter (provisional)

- D1. Implemented as a pure TypeScript module: camera-facing side selection with hysteresis, One-Euro smoothing, position gate (torso near horizontal, body line, wrist below shoulder), visibility threshold, top → bottom → top cycle, 0.5–10 s rep duration, mid-rep tracking loss voids the rep.
- D2. Provisional defaults: top ≥ 150°, bottom ≤ 100°, body line ≥ 150°, visibility ≥ 0.6. All live-adjustable in Diagnostics, with a reset to defaults.
- D3. Every attempt emits a `counted`, `rejected` or `voided` event with a reason code, a plain-language message, and metrics (min/max angle, duration, side, mean visibility).
- D4. Synthetic fixture suite passes, with each case asserting the exact count *and* the expected reason:

  | Case | Expected |
  |---|---|
  | 10 full reps at normal, slow (4 s) and fast (0.7 s) tempo | 10 each |
  | Pause 3 s at bottom / at top | Counts normally |
  | Half reps (bottom 120°) | 0, `not_deep_enough` |
  | Down and stay, then leave | 0 |
  | No lockout at top (135°) | 0, `no_lockout` |
  | Noise ±6° around both thresholds | No double counts |
  | Standing arm curls | 0, `not_in_push_up_position` |
  | Hips sagging through rep | 0, `body_line` |
  | Tracking lost 500 ms mid-rep | That rep voided, next rep counts |
  | Far-side arm low visibility | Uses near side; counts correctly |
  | Side flip mid-set | No spurious count |
  | Knee push-up motion | 0, with a message suggesting the knee push-up exercise |

- D5. Corrections: −1/+1 are stored as separate correction events and never change `cameraCounted`. The display shows both.

### E. Diagnostics (dev-grade)

- E1. Panels: System (Windows edition, version, build, architecture, native vs emulated), Camera, Model, Tracking (33 landmarks with visibility, chosen side), Exercise (phase, 10 s angle trace with threshold lines, gate checks), Rep log, Controls.
- E2. Simulated input: a synthetic skeleton (tempo, depth, noise, dropout sliders, plus presets such as "half reps" and "arm curls") drives the same counter as the camera.
- E3. Export log writes JSON to a folder you choose. A test asserts it contains no image data, no data URIs and, by default, no landmarks.
- E4. Reset session clears counts, corrections and the rep log, but keeps camera and threshold choices.

### F. Windows build

- F1. Unsigned NSIS installers for **Windows x64 and arm64**, built in my environment and sent to you here.
- F2. Install, launch and uninstall work without admin rights (per-user install). App data lives in `%APPDATA%\Ready Up`.
- F3. Instructions for the unsigned-app warning: SmartScreen → "More info" → "Run anyway".
- F4. Known M1 limitation: without Windows tooling in my environment, the `.exe` may show the default Electron icon and file details. The branded icon arrives by M7.

### G. Performance (measured on your PC by the test script; reported, not hidden)

- G1. Diagnostics shows window-ready time, camera-start time, model-load time, fps and inference ms. Targets are in §6.4. If your PC misses them, I report the numbers and options rather than declaring a pass.

### H. Done means

- **Ready for your review:** A–F pass in my environment, installers delivered, results and known limitations written in `docs/milestones/M1.md`, commit pushed to the project branch.
- **Accepted:** you've run the M1 test script, I've recorded the summarized results (counts and timings only, no video or pose data) in `docs/milestones/M1.md`, and you approve moving to M2.

**Not in M1:** final screens, onboarding, timer, games, history, other exercises, video-file and recording inputs, sound.

### M1 test script (about 10 minutes, no recording needed)

1. Install with the installer Diagnostics will confirm matches your PC (start with x64 if unsure). Get past SmartScreen with "More info" → "Run anyway". Launch it.
2. Diagnostics → System: note the Windows edition, version, build and architecture, and whether it says "native".
3. Allow the camera and pick your webcam. Note the camera-start time, model-load time, fps and inference ms.
4. Place the camera side-on, about hip height, 2–3 m away, with your whole body and head in view.
5. Do **5 full push-ups**. Expected: 5.
6. Do **3 half push-ups** (stop halfway down). Expected: still 5, with "not deep enough" in the rep log.
7. Go down and **stay down for 5 seconds**, then get up without pushing. Expected: no count.
8. Stand side-on and do **5 arm curls**. Expected: no count, with "not in push-up position".
9. Start a push-up and **walk out of frame** halfway. Expected: that rep voided.
10. **Unplug the webcam** while tracking, then plug it back in. Expected: "Camera disconnected", count kept, resumes.
11. Press **+1, then −1**. Expected: shown as corrections, camera count unchanged.
12. Switch input to **Simulated**, try the "half reps" preset. Expected: no counts.
13. **Export log**, quit, relaunch. Expected: your camera choice is remembered.
14. Send me: the numbers from steps 2–3, actual vs expected counts for steps 5–12, anything confusing, and the exported log if you're comfortable (it contains no video or images).

---

## 10. Risks

| Risk | Mitigation |
|---|---|
| Side-view tracking varies with clothing, light, clutter | Setup checks, confidence gating, explained rejections, override |
| Lying-down sit-ups track poorly | Beta label, separate validation |
| GPU driver issues | CPU fallback, lite model |
| No licensed footage reachable from my environment | §8.2: allow the hosts or provide a vetted clip; your real-camera scripts remain the accuracy authority |
| Unsigned installer warnings | Documented SmartScreen steps; signing before public release (§11) |
| I can't run a real camera or Windows here | Fake cameras, headless Chromium, your scripts each milestone |

---

## 11. Before a public release (not needed for the prototype)

1. **Code signing.** Either an OV/EV code-signing certificate from a certificate authority or Microsoft's Trusted Signing service. Without signing, SmartScreen warns every user, and reputation builds slowly even after signing.
2. **Windows build tooling.** Build on Windows (a Windows CI runner or your PC) for proper icon, version info and signing.
3. **Update strategy.** Auto-update (needs signed builds and a hosting location) or manual downloads.
4. **Privacy statement.** Plain-language page: no network, no telemetry, camera processed locally, where data lives, how to delete it.
5. **Licenses.** Final `THIRD_PARTY_NOTICES.md` shipped inside the app (Apache-2.0 NOTICE requirements included).
6. **Name check.** A trademark search for "Ready Up" before public distribution.
7. **Accessibility and validation sign-off.** `VALIDATION.md` with real-camera results per exercise and a Narrator pass.
8. **Crash reporting decision.** Off by default; any reporting would be opt-in and local-first.
