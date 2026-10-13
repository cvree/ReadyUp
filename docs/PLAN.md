# Ready Up: Build Plan

Status: **Draft for review. No application code has been written.**
Companion visual direction: `docs/design/visual-direction.html` (also published as a private page).

---

## 1. The product in one paragraph

Ready Up is a desktop commitment device for people who want to earn their game time. A session is a **ready check** with three slots: **Focus** (a measured study timer with a task you name), **Move** (camera-counted reps, 10 push-ups by default), and **Play** (a Launch button for your game that unlocks when the first two are done). It runs entirely on your computer. Video never leaves the device and is never written to disk.

What it is honest about:

- **The timer is measured; the study is self-reported.** Ready Up records how long the focus timer ran (excluding pauses and sleep). Whether you finished your task is something you confirm. The app never claims to prove you studied.
- **The game unlock is Ready Up's own button.** It does not block your game, your launcher, or your desktop shortcut. The copy says this plainly in setup.
- **Rep counts are camera estimates.** You can correct them (+1 / -1) and you can override the camera entirely (injury, accessibility, camera failure). History labels corrected and overridden sessions as such, without judgment.

---

## 2. Experience

### 2.1 Principles

1. **The next action is always the biggest thing on screen.** Every screen has one primary action, reachable with Enter.
2. **Encourage, never scold.** Feedback says what to change ("Go a little lower") instead of what went wrong ("Bad rep").
3. **Explain every count.** A rep that doesn't count always gets a reason, in plain language on the Move screen and in detail in Diagnostics.
4. **Calm during focus, energy during move, one big moment at the end.** Motion and color intensity rise through the session.
5. **Local and private by default.** No accounts, no network calls, no analytics.

### 2.2 The core loop

```
 Lobby ──Enter──▶ Focus (25:00) ──timer ends──▶ "Did you finish?" ──▶ Move
   ▲                                                                   │
   │                                                    camera setup (first time / if needed)
   │                                                                   ▼
   └──── "Not now" ◀── Ready! (Launch unlocked) ◀──10/10── Rep counting
```

### 2.3 Screen-by-screen flow

**First run (target: under 60 seconds, every step skippable)**

| Step | Screen | What it does | Primary action |
|---|---|---|---|
| 1 | Welcome | Name and one-line promise: "Study, move, then play." | Get started |
| 2 | Your routine | Prefilled: 25 min focus, 10 push-ups. Steppers for minutes and reps, exercise picker. | Looks good |
| 3 | Your game | Pick an app/executable, or paste a launcher link (e.g. `steam://rungameid/730`). Includes the honesty note. Test-launch button. | Save game / Skip for now |
| 4 | Camera check | Permission request with a reason shown *before* the OS prompt. Short placement preview. Can defer to first Move. | Check my camera / Later |
| 5 | Lobby | Lands on the main screen with the cursor in "What are you studying?" | Start focus |

**Main screens**

| Screen | Content | Primary action | Keyboard |
|---|---|---|---|
| **Lobby** (home) | The ready-check bar (Focus / Move / Play slots), task field, game name, one quiet line of progress ("4 ready checks this week"). | Start focus | Enter starts, `E` edits routine, `H` history |
| **Focus** | Very large timer, task name, slim progress line, Pause, End early. Calm palette; motion nearly off. OS notification when it ends. | Pause / Resume | Space pauses, Esc → "End early?" |
| **Focus complete** | "25:00 focused." Then "Did you finish *Chapter 4 problems*?" Yes / Partly / Not this time. All answers continue. | Continue to Move | 1/2/3 to answer |
| **Camera setup** | Live preview with ghost silhouette for the chosen exercise; four checks: In frame, Distance, Angle, Lighting. Each turns from hint → check. Camera switcher. Phone-camera help link. | I'm set | Tab cycles cameras |
| **Move** | Camera preview with a quiet skeleton overlay, huge rep count "4 / 10", depth gauge, one feedback line, -1 / +1 correction, "Can't use the camera?" override. | (none needed; reps drive it) | `-` / `+` correct, `O` override |
| **Ready** | The completion moment. Ready-check bar locks in, "READY" headline, session summary, Launch *Game*. | Launch *Game* | Enter launches |
| **History** | A week strip (one mark per completed ready check), this week's totals (focus time, reps), a short list of recent sessions with tags like "self-reported reps". No charts beyond that. | Back to lobby | |
| **Settings** | Routine, exercises & standards, camera, games, accessibility (reduced motion, sounds, text size), data (export, delete everything). | | |
| **Diagnostics** | See section 5. Reached from Settings or Ctrl+Shift+D. | | |

**Designed states (each gets real copy and art, not a generic error)**

| State | Treatment |
|---|---|
| Empty (no history) | Lobby shows "Your first ready check is waiting." History shows an empty week strip with today highlighted. |
| Model loading | "Warming up the tracker…" with a determinate bar (model is local, loads in ~1–3 s). |
| Permission denied | Explains why, with OS-specific steps and a button that opens the right settings pane (macOS Privacy & Security → Camera; Windows Settings → Privacy → Camera). Offers the override. |
| No camera found | Lists what to try, including the phone-camera guide. |
| Camera disconnected mid-set | Counting pauses, count is kept, "Camera disconnected. Reconnect it or pick another." Resumes automatically when the device returns. |
| Person not visible / partially visible | Names the body part: "I can't see your feet. Move the camera back about a step." |
| Low light / backlit | "It's a bit dark for tracking. Turn on a light in front of you." |
| Completed | The Ready screen; returning to the Lobby later shows "Ready. Launch *Game*" until a new session starts. |

### 2.4 Override and correction

- **Correction:** -1 / +1 on the Move screen and in Diagnostics. Each correction is logged with a timestamp. History shows "10 reps (1 corrected)".
- **Override:** "Can't use the camera?" opens a sheet with reasons: *Injury*, *Accessibility*, *Camera isn't working*, *Other*. Then: swap to a different exercise, enter reps yourself, or skip Move for today. Launch still unlocks (proposed default, see decisions). History labels it "Move: self-reported (injury)".

### 2.5 Phone as a camera (explained in-app, in Settings → Camera → "Use your phone")

Ready Up sees any camera the operating system exposes as a webcam. The guide offers the route that matches your devices:

| Your setup | Route | Install needed |
|---|---|---|
| iPhone + Mac | **Continuity Camera** (macOS 13+, iOS 16+). Same Apple ID, Wi-Fi and Bluetooth on. The iPhone appears in the camera list. | None |
| Android + Windows 11 | **Phone Link → "Use as a connected camera"** (Android 9+). | Phone Link app |
| Android 14+ phone, any computer | **USB webcam mode.** Plug in, choose "Webcam" in the USB notification. | None |
| Anything else | Third-party webcam apps (e.g. Camo, DroidCam, Iriun). We link to them; they have their own terms and privacy policies. | Their app on both devices |

Placement tips shown with a diagram: landscape orientation, phone on a stand or propped on the floor, 2–3 m away, side-on for push-ups and sit-ups, hip height.

**Direct phone pairing** (scan a QR code, stream from the phone's browser) is deferred. It needs a local HTTPS server with a certificate the phone trusts (browsers only allow camera access in secure contexts), WebRTC signaling, and LAN discovery. That is a substantial feature with its own failure modes, and the routes above already cover most users.

---

## 3. Visual direction: "The Ready Check"

The identity is built on one moment every player knows: the lobby ready check, where each slot lights up and the match is about to start. Ready Up turns that into the core UI.

- **Signature element:** the **ready-check bar**, three slanted slots (Focus, Move, Play). Slots fill as you progress; Play locks in gold on completion. It appears large on the Lobby and Ready screens and as a slim header elsewhere, so you always know where you are.
- **Palette ("lobby at dusk"):** blue-black ink base, slate surfaces, warm paper-white text. Each phase gets one restrained tint: **moonlight** (focus), **ember** (move), **lamp gold** (ready, the brand accent). No neon, no glow-everything; light is used like stage lighting, mostly on the one thing that matters.
- **Typography:** *Anybody* (variable width + weight) for display: wide and heavy for the timer and rep numerals, condensed for labels. Its width axis drives the completion moment (READY expands from condensed to wide as it locks in). *Instrument Sans* for body and UI text. *IBM Plex Mono* for Diagnostics data. All fonts are OFL-licensed and bundled locally.
- **Motion:** quiet by default. Three orchestrated moments only: a slot filling, a rep tick (number rolls, gauge pulses), and the lock-in (slots snap, a single light sweep across the Launch button, READY widens). With reduced motion enabled (OS setting or in-app toggle), these become short cross-fades and the information stays identical.
- **Sound:** optional, off by default (decision below). A soft tick per rep and one chord on lock-in.
- **Contrast:** body text ≥ 7:1 on the base, secondary text ≥ 4.5:1, focus rings 3 px gold with offset, never color-only state (every slot also has an icon and a label).

The mockups in `docs/design/visual-direction.html` show Lobby, Focus, Camera setup, Move, Ready, Diagnostics, and the error/empty states.

---

## 4. Rep counting

### 4.1 Evaluation of the reference (parhamsoltani/pushup_counter)

I read the repository's actual code (`pushup_counter.py`, `utils.py`, last commit Sep 2025).

**License.** MIT, "Copyright (c) 2025 parhamsoltani". Reuse is permitted if the notice is kept. The repo also contains `push_up.mp4` and `pu_counter.png` with no stated source. I don't want to assume the video's footage is the author's to license, so we will **not** redistribute it or commit it to this repo.

**What it actually does.**
- Python, OpenCV, MediaPipe's legacy `mp.solutions.pose` API (superseded by the Tasks API we would use).
- Computes left and right elbow angles (shoulder–elbow–wrist) in 2D pixel space and **averages them**.
- "Form" check: left shoulder–hip–knee angle > 160°; if it fails, counting is skipped for that frame.
- Counting: angle > 160° sets stage "up"; angle < 90° while "up" sets "down" and **increments the count at the bottom**.

**What's worth keeping.** The two-threshold idea (it acts as hysteresis), the standard three-point angle formula, and the angle-to-percentage progress bar, which becomes our depth gauge.

**Problems found, each of which our design addresses:**

| # | Problem in reference | Consequence | Our approach |
|---|---|---|---|
| 1 | Counts when reaching the bottom | A half rep (go down, never push back up) counts | Count only on return to the top after a valid bottom |
| 2 | No visibility/presence checks | In a side view the far arm is hidden; MediaPipe guesses its position. Averaging a real and a guessed angle corrupts the signal | Choose the camera-facing side by landmark visibility, with hysteresis; require visibility ≥ threshold |
| 3 | Alignment always uses the left side | Wrong when the right side faces the camera | Use the chosen side |
| 4 | No "in plank" check | Standing upright passes shoulder–hip–knee > 160°, so **standing arm curls count as push-ups** | Require torso near horizontal and wrists below shoulders |
| 5 | No smoothing or timing limits | Jitter and landmark jumps can create or miss transitions | One-Euro smoothing, minimum rep duration, minimum interval |
| 6 | Stage survives tracking loss | Walking out of frame and back can produce surprise counts | Tracking loss mid-rep voids that rep and resets to "waiting for top" |
| 7 | Form failure silently skips frames | User never learns why a rep didn't count | Every attempt produces a counted/rejected event with a reason |
| 8 | Bare `except` → "Position not detected" | Hides real errors | Typed results; errors surface in Diagnostics |

**Plan:** reimplement in TypeScript from scratch (different language and API). No code is copied, so the notice isn't strictly required, but we credit the project in `THIRD_PARTY_NOTICES.md`. If any code is ever ported directly, the full MIT notice goes in with it.

### 4.2 Our counting pipeline (all exercises)

```
camera frame ──▶ Pose Landmarker (worker) ──▶ 33 landmarks + visibility + world coords
     │                                              │
     │ (never stored)                               ▼
     │                                  Side selection (hysteresis)
     │                                  Smoothing (One-Euro filter)
     │                                  Geometry: joint angles, torso angle, bbox
     │                                              │
     │                                              ▼
     │                                  Gating: "are you in position?"
     │                                  (exercise-specific; outputs named failures)
     │                                              │
     │                                              ▼
     │                                  Rep state machine
     │                                  WAITING → TOP → DESCENDING → BOTTOM → ASCENDING → TOP(+1)
     │                                              │
     ▼                                              ▼
 Lighting estimate (luma only)          RepEvent { counted | rejected, reason, minAngle,
                                                   duration, side, confidence }
```

**Push-up v1 rules (all thresholds adjustable in Diagnostics; defaults to tune on your real recordings):**

- *In position:* torso (shoulder→hip) within ~35° of horizontal; body line shoulder–hip–ankle ≥ ~150°; wrist below shoulder; required joints on the chosen side visible ≥ 0.6.
- *Top:* elbow angle ≥ 150°. *Bottom:* elbow angle ≤ 100° (proposed "standard"; 90° = "strict"; see decisions).
- *Valid rep:* TOP → reached BOTTOM → back to TOP, within 0.5–10 s, with gating holding throughout (brief < 300 ms dropouts tolerated).
- *Rejection reasons* (examples of the user-facing copy):
  - `not_deep_enough` → "Go a little lower. Your elbows reached 112°; aim for 100°."
  - `no_lockout` → "Push all the way up to finish the rep."
  - `not_in_plank` → "Get into a plank to start."
  - `hips_sagging` / `hips_piking` → "Keep your hips in line with your shoulders."
  - `tracking_lost` → "I lost sight of your arm mid-rep, so that one didn't count. Try turning more side-on."
  - `too_fast` → "That was quicker than a real rep. Probably camera jitter, so I skipped it."

**Squats (milestone 5a):** knee angle (hip–knee–ankle), top ≥ 160°, bottom ≤ 100° or hip at/below knee height; standing gating; side or 45° view.

**Sit-ups (milestone 5b):** torso angle relative to the floor, from lying (≤ 20°) to up (≥ 70°), knees bent; side view. Pose models are trained mostly on upright people, so lying-down tracking is the riskiest part of the project. Sit-ups ship labeled **Beta** until they pass real-camera validation.

New exercises plug in as an `ExerciseDefinition` (required joints, gating rules, primary signal, thresholds, setup guide, copy) without touching the camera, pose, or UI layers.

### 4.3 Camera setup checks

Computed from landmarks plus a downscaled luminance estimate (pixels are read in memory and discarded):

| Check | Passes when | Hint when failing |
|---|---|---|
| In frame | All required joints visible ≥ 0.6 and inside a 3% margin | Names the missing part ("your feet") |
| Distance | Body spans ~50–85% of the frame in its long axis | "Move the camera back about a step" |
| Angle | Exercise-specific (side-on for push-ups: shoulders overlap horizontally) | "Turn so your side faces the camera" |
| Lighting | Mean luma above threshold and tracking confidence steady | "Turn on a light in front of you" / "There's a bright window behind you" |

---

## 5. Diagnostics (first-class from milestone 1)

A dev-grade Diagnostics view exists from the proof of concept, because it's how we tune counting. Milestone 6 turns it into a polished, documented screen.

**Layout:** video with skeleton on the left; panels on the right.

- **Camera:** device name, resolution, fps, state (live / disconnected / permission). One-click camera switcher.
- **Model:** variant (lite / full / heavy), delegate (GPU / CPU), load time, inference ms, effective fps.
- **Tracking:** all 33 landmarks with visibility bars; chosen side; joints toggle for labels on the video.
- **Exercise:** current phase, live angle trace over the last 10 s with threshold lines drawn, gating checks with pass/fail per rule.
- **Rep log:** every attempt, counted or rejected, with reason, min/max angle, duration, confidence. Click an entry to see its angle trace.
- **Controls:** reset session, -1 / +1, threshold sliders (marked "test values" with a one-click reset to defaults), model variant switch.
- **Input source:** Live camera · Video file · Pose recording · Simulated. Simulated has sliders for tempo, depth, noise, and dropout, driven by a parametric skeleton generator.
- **Record:** saves a pose recording (landmarks + timestamps only, no pixels) that becomes a regression test fixture.
- **Export logs:** JSON bundle with app/OS versions, settings, event log, rep log, and optionally pose recordings. **Never includes video or images.**

---

## 6. Architecture

### 6.1 Technical choices

| Area | Choice | Why / alternatives considered |
|---|---|---|
| Shell | **Electron** (current stable, pinned) | Bundles one known Chromium everywhere, so camera, WebGL/WebGPU and WASM behave the same on every OS. Tauri is smaller, but uses each OS's webview (WebKitGTK, WKWebView, WebView2) where getUserMedia, WebGL, and WASM SIMD vary, which is exactly where pose tracking breaks. Cost: ~100 MB installer. |
| UI | **React + TypeScript (strict)**, built with **electron-vite** | Mature, fast HMR, typed IPC end to end. |
| Pose | **MediaPipe Pose Landmarker** (`@mediapipe/tasks-vision`, Apache-2.0) in a **Web Worker** | Runs locally, 33 landmarks with visibility and 3D world coordinates, GPU delegate with CPU fallback. Model (`.task`) and WASM files are **bundled**, so it works offline with zero network calls. Variant auto-selected from measured fps (full by default, lite on slow machines). |
| Exercise logic | **Pure TypeScript package, no DOM or Electron imports** | Fully unit-testable from recorded landmark data. |
| State | Hand-written typed state machines for session and rep logic; **Zustand** for UI state | Transition tables are easy to read, test, and show in Diagnostics. |
| Motion | CSS + **Motion** (motion.dev) with reduced-motion handling | Used for the three signature moments only. |
| Storage | **Versioned JSON files** with atomic writes and schema validation (**zod**), behind a repository interface | Data is small (a few sessions a day). Avoids native-module packaging pain. Can move to SQLite later without touching callers. |
| Packaging | **electron-builder** | NSIS installer (Windows), DMG (macOS), AppImage/deb (Linux). CI builds on GitHub Actions runners for your OS. |
| Tests | **Vitest** (unit, trace replay), **Playwright for Electron** (end-to-end, fake camera fed from a video file), **axe-core** (accessibility) | See section 8. |

### 6.2 Modules and boundaries

```
src/
  main/                 Electron main process (Node)
    storage/            settings, sessions, history (JSON, atomic, migrations)
    launcher/           game shortcuts: validate, launch (no shell strings)
    diagnostics-log/    log files, export bundle
    platform/           camera permission status, open OS settings, notifications, sleep/resume
    ipc/                typed, zod-validated handlers
  preload/              contextBridge API (the only door between UI and Node)
  renderer/
    camera/             device list, stream lifecycle, disconnect detection, FrameSource
                        (live | video file | pose recording | simulated)
    pose/               PoseEstimator interface; MediaPipe worker implementation; fake estimator
    ui/                 design tokens, components, screens
    app/                routing, stores, wiring
  packages/
    exercise/           geometry, filters, side selection, gating, rep state machine,
                        ExerciseDefinition registry (pushup, squat, situp)
    session/            routine model, focus timer (measured time), session state machine
    pose-types/         shared landmark types and constants
    sim/                parametric skeleton generator for tests and Diagnostics
```

Boundary rules (enforced by ESLint import rules): `packages/*` import nothing from Electron, Node, or the DOM; `renderer` never imports `main`; everything crossing processes goes through typed IPC.

### 6.3 Security and privacy

- `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, strict Content-Security-Policy with no remote origins.
- Frames stay in renderer memory, are passed to the worker as transferable bitmaps, and are never written to disk or sent anywhere.
- The launcher only opens targets the user configured, uses argument arrays (never shell strings), and limits URL launches to an allowlist of game-launcher schemes (`steam://`, `com.epicgames.launcher://`, `battlenet://`, etc.), editable in settings.
- No network access at runtime. No telemetry. No auto-update in v1.

### 6.4 Focus timer as measured time

The timer stores `startedAt`, `accumulatedMs`, `runningSince`, `targetMs`, and a pause log, persisted on every state change and every 5 s. On restart: "You had 12:41 left in your focus session. Resume or discard?" System sleep counts as a pause (proposed default). History records measured focus time separately from the target.

---

## 7. Milestones

Each milestone ends with a pushed, reviewable set of commits on the working branch, a short changelog, and (from milestone 1) a CI-built app you can download and run. I stop after each milestone for your review.

### M1. Spec, visual direction, user flow, technical proof of concept

- **Build:** this plan (approved and amended); project scaffold (electron-vite, React, strict TS, ESLint, Prettier, Vitest, Playwright, CI); **proof of concept**: an Electron window with camera picker, live video, MediaPipe in a worker running fully offline, skeleton overlay, live elbow angle with chosen side, fps and inference time, a first push-up state machine with a reason log, and the landmark recorder.
- **You can try:** run the PoC, do push-ups, watch angles and the reason log, record pose traces.
- **I test:** unit tests for angle math, side selection and the state machine against synthetic sequences; MediaPipe loads with networking blocked; the pipeline runs on a sample video in a headless Chromium using a fake camera.
- **Needs your hands-on feedback:** approve or adjust the visual direction; does your camera open and track you; fps on your machine; record 3–5 short pose traces (full reps, half reps, standing around).

### M2. Onboarding and core interface

- **Build:** design tokens, bundled fonts, components (button, ready-check bar, timer numerals, fields, sheet, toast), app shell with full keyboard navigation, first-run flow, Lobby, Focus, Focus complete, Move, Ready (wired to a simulated session so the whole loop is clickable), the completion moment, reduced motion, empty states.
- **You can try:** first-run setup and the entire loop end to end, with simulated reps.
- **I test:** Playwright flows including a keyboard-only run; axe-core scans on every screen; screenshot snapshots with motion on and off; token contrast checks.
- **Needs your feedback:** look and feel at your screen size, copy, the completion moment.

### M3. Camera selection, pose tracking, dependable push-up counting

- **Build:** camera service (enumerate, remember choice, hot-plug, disconnect/reconnect, permission states per OS); Camera setup screen with ghost guide and the four checks; production pose worker (variant auto-select, GPU→CPU fallback); push-up counter v1 with feedback copy; -1/+1 correction; override flow; Diagnostics v1 (live panels, rep log, threshold sliders, recorder).
- **You can try:** real push-ups end to end with the real camera, the setup check, unplugging the camera mid-set.
- **I test:** trace-replay tests from your recordings with expected counts and expected rejection reasons; fault injection (jitter, dropouts, side flips, landmark jumps); full-pipeline tests on your labeled clips via fake camera; disconnect simulated by ending the media track.
- **Needs your hands-on feedback:** the real-camera protocol (section 8.3) for push-ups. Push-ups are labeled "dependable" only after this passes on your hardware.

### M4. Study timer, tasks, game shortcuts, local history

- **Build:** focus timer (measured time, pause, sleep handling, restart recovery, end notification); task entry and confirmation; routine editor; game shortcuts (app picker, launcher links, test launch); storage with migrations and corruption recovery; History screen.
- **You can try:** a complete real session ending in your actual game launching. **This is v0.1** (see section 9).
- **I test:** timer tests with a fake clock (pause, sleep, restart); kill-and-relaunch tests mid-focus and mid-move (no lost time, no duplicate sessions); storage corruption tests; launcher tests with a mocked shell.
- **Needs your feedback:** does your game launch correctly; is History calm and useful.

### M5. Squats, then sit-ups (each validated separately)

- **Build:** 5a squat definition, setup guide, copy, tests, then validation. 5b sit-ups through the same steps, starting as Beta.
- **You can try:** each exercise in a full session.
- **I test:** synthetic and trace-replay suites per exercise, including movements that must *not* count (e.g. bending to pick something up for squats, sitting up to reach the keyboard for sit-ups).
- **Needs your hands-on feedback:** a separate real-camera protocol session per exercise.

### M6. Diagnostics, accessibility, error recovery, polish

- **Build:** Diagnostics polished into a documented screen with simulated input, video-file input, pose-recording playback, and log export; accessibility pass (screen-reader labels, live announcements like "Rep 4 of 10", focus order, text scaling, reduced motion); every error and recovery state; optional sound; light theme if wanted.
- **You can try:** Diagnostics end to end; breaking things on purpose.
- **I test:** axe-core plus a manual screen-reader pass on your OS; error states driven by fault injection; export bundle checked to contain no image data.
- **Needs your feedback:** is Diagnostics easy to understand while testing.

### M7. Automated checks, real-camera testing, packaged installer

- **Build:** CI running typecheck, lint, unit, trace replay, end-to-end, and the pipeline regression suite; installer for your OS (signed if you have certificates); `docs/VALIDATION.md` with the real-camera results per exercise; release checklist.
- **You can try:** installing from the installer on a clean user account.
- **I test:** install/uninstall, first launch, permission prompts, data survives upgrade.
- **Needs your hands-on feedback:** the final real-camera protocol run and install on your machine.

---

## 8. Verification

### 8.1 Test tiers

| Tier | Runs | Input | Proves |
|---|---|---|---|
| Unit | Every push | Hand-written values | Geometry, filters, timer, storage, launcher argument building are correct |
| Synthetic | Every push | Generated skeletons (tempo, depth, noise, dropout) | State machine logic handles edge cases. **Does not prove accuracy.** |
| Trace replay | Every push | Pose recordings from real people (you), labeled | Counting logic on real landmark noise |
| Pipeline | Every push (CPU delegate) | Your labeled video clips fed as a fake webcam | Camera → MediaPipe → counter works end to end. Asserts counts, not exact landmark values |
| End-to-end UI | Every push | Electron + fake camera | Flows, keyboard, states, restart recovery |
| Real camera | Each counting milestone | You, live | Actual accuracy on your hardware, room, and body |

Videos of you stay out of the repo unless you decide otherwise (decision below). Pose recordings contain no pixels and can be committed.

### 8.2 Scenario matrix (each exercise)

| Category | Scenarios | Expected |
|---|---|---|
| Full reps | Normal, slow (4 s), fast (< 1 s), pause at bottom, pause at top | All count |
| Partial reps | Half depth, top-only bounces, no lockout, down-and-stay | None count; correct reason shown |
| Double counts | Jitter at thresholds, side flip mid-rep, landmark jumps, wobble at bottom | Exactly one count per real rep |
| Not exercising | Standing arm curls, kneeling, reaching for keyboard, walking past | Zero counts |
| Occlusion | Walk out mid-rep, hand over lens, feet out of frame, second person walks by | Mid-rep loss voids that rep only; clear message; resumes cleanly |
| Camera | Unplug mid-set, reconnect, switch camera mid-set, permission revoked | Count kept, counting paused, recovers |
| Restart | Quit/kill mid-focus, mid-move, on Ready screen | State restored; no duplicate sessions; no lost reps |
| Conditions | Dim light, backlit window, too close, too far, loose clothing | Setup check catches it or counting stays correct |

### 8.3 Real-camera protocol (your part)

For each exercise, on your machine and camera:

1. Three sets of 10 full reps from three positions (ideal, slightly off-angle, farther).
2. One set mixing 5 full and 5 partial reps, called out loud or noted.
3. 60 seconds of not exercising in frame (walking, sitting, stretching).
4. One set with an interruption: walk out mid-set, unplug the camera, come back.

Each run is recorded as a pose trace (and, if you choose, a local video). I report true reps vs. counted, false counts, missed reps, and rejected reasons. **Proposed bar for "dependable":** zero counts during non-exercise movement, zero partial reps counted, at most 1 missed full rep per 30 in the ideal position. Synthetic tests passing never earns an exercise this label.

---

## 9. Recommendation: the smallest impressive first version (v0.1)

**v0.1 "First Ready Check" = milestones 1–4.**

- First-run setup in under a minute.
- The Lobby with the ready-check bar.
- A real focus timer with a task you confirm.
- Camera setup with live checks.
- Camera-counted push-ups with explained counts, correction, and override.
- The completion moment and your actual game launching.
- A calm History.
- A dev-grade Diagnostics view.
- Packaged for your OS.

It leaves out squats, sit-ups, polished Diagnostics extras (simulated input UI, video-file input), sound, light theme, and phone pairing. That keeps the first build focused on the one loop that has to feel magical, and gets push-up accuracy validated on real data before more exercises copy its patterns.

---

## 10. Risks

| Risk | Mitigation |
|---|---|
| Side-view tracking quality varies with clothing, lighting, floor clutter | Setup checks, confidence gating, explained rejections, override |
| Lying-down sit-ups track poorly | Beta label; camera placement guidance; validated separately |
| GPU delegate misbehaves on some drivers | Automatic CPU fallback; model variant switch |
| macOS camera permission and Gatekeeper | `NSCameraUsageDescription` + camera entitlement; signing if you have an Apple Developer account, otherwise documented "Open anyway" steps |
| Store-managed games (Xbox app, some Epic titles) need special launch targets | Support launcher URLs first; Windows AppUserModelID targets later |
| I can't use a real camera from my build environment | Pipeline tests with fake cameras and your recorded clips; your real-camera protocol at each counting milestone |

---

## 11. Decisions I need from you

1. **Your operating system** (and version), and your phone if you'll use it as a camera. This sets the installer, the permission flow, and the phone guide I test first.
2. **Electron + React + TypeScript + MediaPipe:** approve, or tell me if bundle size (~100 MB) matters enough to revisit Tauri.
3. **Push-up standard:** bottom at elbow ≤ 100° (recommended) or strict ≤ 90°? Allow knee push-ups as a separate exercise?
4. **Override policy:** should overriding Move still unlock Launch? (Recommended: yes, labeled in history.)
5. **Sit-up definition:** full sit-up (torso to ~70°+) or crunch? OK to ship as Beta first?
6. **Games:** which launchers or games do you want working first (Steam, Epic, Battle.net, a specific .exe)?
7. **Test recordings:** are you willing to record short clips of yourself for testing? Should videos stay only on your machine (recommended), or go in the repo via Git LFS? Pose-only recordings (no pixels) would be committed.
8. **Visual direction:** approve the "Ready Check" concept, palette, and type, or redirect. Dark only for v1 (recommended), or a light theme too?
9. **Sound:** completion sound on or off by default? (Recommended: off.)
10. **Code signing:** do you have an Apple Developer account or Windows signing certificate? Without one, installers work but show OS warnings.
11. **Review cadence:** commits per milestone on this branch (current setup), or a pull request per milestone?
