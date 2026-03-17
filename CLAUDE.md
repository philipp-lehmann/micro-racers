# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MICRO RACERS is a browser racing game with no build system or package manager. Open `index.html` directly in any modern browser to run it.

## File Structure

Scripts are loaded in dependency order in `index.html`:

| File | Contents |
|------|----------|
| `music.js` | Strudel-based soundtrack. Exposes `setMusicMode(mode)` and `setMusicMuted(bool)` as globals. Modes: `'beat'` (start/menu), `'race'` (full stack), `'results'` (bass + synth only). |
| `geometry.js` | Spline math (`buildSpline`, `buildEdges`, `clipEdgeFolds`), track queries (`nearestTrackPoint`, `nearestTrackPointLocal`, `trackProgress`, `trackProgressLocal`), and utility helpers (`muteColor`, `formatTime`, `inBox`, `distToSegment`). |
| `tracks.js` | `TRACK_DEFS` array — read-only built-in track control points. |
| `cars.js` | Physics constants (`CAR_RADIUS`, `MAX_SPEED`, `MAX_REVERSE`, `BOOST_DRAIN`, `BOOST_REFILL`, `GRAVEL_ZONE`), `CAR_PRESETS`, `makeCarImage()`, `makeCar()`, `updateCar()`, `resolveCarCollisions()`, `drawCar()`. |
| `obstacles.js` | `obstacles` global array, `generateObstacles()`, `drawObstacles()`, `resolveObstacleCollisions()`. |
| `micro-racers.js` | Canvas setup, color palette, track building (`buildTrackObj`), user track/settings/highscore persistence, input handling, game state globals, camera, particles, `initRace()`, background/track/HUD drawing, main `loop()`. |
| `screens/start.js` | `drawStart()` and `drawCountdown()`. |
| `screens/pause.js` | `drawPause()`. |
| `screens/results.js` | `drawResults()` and the `RES` layout-constants object. |
| `screens/tracks.js` | `drawTracksScreen()` and `drawMiniTrackPreview()`. |
| `screens/editor.js` | `drawEditor()` and `rebuildEditorPreview()`. |
| `micro-racers.css` | Three rules only (reset, body, canvas). |
| `tests.html` | In-browser test runner. Open in a browser to run all unit tests. |
| `assets/cars/` | SVG source files for car shapes (`classic.svg`, `fast.svg`, `tank.svg`). The in-game images are generated at runtime from `svgTemplate` strings embedded in `CAR_PRESETS`. |

All files communicate via globals — there is no module system.

## Screen State Machine

```
'start' → 'countdown' → 'race' → 'results'
               ↕                       ↕
           'tracks'  ←→  'editor'
```

The current screen is the `screen` variable in `micro-racers.js`. The `'pause'` state is an overlay (not a separate screen value): the `paused` boolean is set while `screen === 'race'` and `drawPause()` is called on top of the frozen race frame.

The main `loop()` function dispatches to per-screen draw/update functions. Button click handling for the results screen happens in the main loop (not inside `drawResults`), using the `RES` constants object for layout.

## Key Architecture Points

**Track geometry** (`micro-racers.js` + `geometry.js`): `buildTrackObj(def, isUser)` in `micro-racers.js` converts raw `[x, y, w]` control points into a pre-computed object with `spline`, `edges`, `cumulativeLengths`, and `totalLength`. The spline and edge math lives in `geometry.js`. The mutable `TRACKS` array combines built-in (`TRACK_DEFS`) and user tracks (persisted in `localStorage` under `mrUserTracks`).

**Car physics** (`cars.js`): Acceleration uses a quadratic-drag model — `dv/dt = accel·(1-(v/topSpeed)²)` — which reaches ~90% top speed in ~2 s and asymptotes to 100% over ~10 s. Off-track penalty is a gradient: `offFraction` (0–1) ramps linearly over `GRAVEL_ZONE = 40px` past the track edge, scaling both the top-speed cap and exponential speed decay. All per-car physics params live in `CAR_PRESETS`; each car holds a `stats` reference.

**Car presets** (`cars.js`): `CAR_PRESETS` is the extension point for different car types. Each preset has `name`, `svgTemplate` (inline SVG with `CARCOLOR` placeholder), `topSpeed`, `accel`, `brake`, `friction`, `turnRate`, `boostFactor`, `reverseMax`. Car images are generated at runtime via `makeCarImage(preset, color)`, which replaces `CARCOLOR` and creates a data-URI `Image`.

**Obstacles** (`obstacles.js`): `generateObstacles(track)` fills the `obstacles` array with 10 randomly-placed square blocks, using a deterministic LCG seeded from the track name. Tracks can also carry hand-placed `obstacles` in their definition (used by the editor). `resolveObstacleCollisions()` handles circle-vs-rotated-AABB collision between cars (`CAR_RADIUS = 14`) and blocks.

**Rendering**: The game uses an isometric transform applied via `ctx.transform()` each frame. `worldToScreen()` converts world coords for HUD elements drawn outside the transform. `drawCar()` and `drawObstacles()` operate in world space (inside the iso save/restore).

**Camera** (`micro-racers.js:updateCamera`): Smooth-follows the centroid of human players. Zoom is driven by two factors multiplied together — speed (`1.5` at rest → `0.75` at max speed) and player spread (`560 / (spread + 560)`), clamped to a minimum of `0.35`.

**Music** (`music.js`): `initStrudel()` is called synchronously (returns `undefined`, not a Promise). All drum synthesis uses Web Audio oscillators (`s("sine/square/triangle/sawtooth")`) — no sample files. The `'beat'` mode plays an 8-beat kick intro before the full pattern drops (via `setTimeout`). The `'results'` mode plays bass + synth only.

**Game modes**: `gameMode` is `'race'` (fixed laps, `LAPS` selectable 1–9) or `'elimination'` (last-place car is eliminated after falling `ELIM_DISTANCE = 200px` behind the leader; first to `POINTS_TO_WIN` championship points wins). Elimination tracks per-slot points in `scores[0–3]` and carries `elimStartProgress` / `elimGridOrder` between rounds.

**Win conditions** (race mode): The race ends when any of these is true:
1. All cars have crossed the finish line.
2. All cars are out (done or DNF) for 5 s.
3. All human players finished 10 s ago.
4. Elimination: only 1 car remains for 3 s.

**Color conventions**: `COLORS` object for the palette. Append `BTN_DIM` (`'1a'`) to any 6-digit hex for a 10%-opacity idle button background. `muteColor(hex, factor)` (in `geometry.js`) derives AI car colors. `COLORS.danger` is used for all destructive actions.

**Input**: `keys` object (keydown/keyup), `mouse` object (reset each frame by the main loop). `CONTROLS[0–3]` maps player index to key bindings including `boost`. Mouse coordinates are always in logical canvas space (1600×1140).

**LocalStorage keys**:
- `mrUserTracks` — array of user-created track definitions (pts, obstacles, name, etc.)
- `mrSettings` — last-used playerSlots, selectedTrack, gameMode, LAPS, POINTS_TO_WIN, musicMuted
- `mrHighscores` — object keyed `"trackName:laps"` → `{ finishTime, bestLap }` records

## Adding a Track

Append to `TRACK_DEFS` in `tracks.js`:
```js
{ name: 'MY TRACK', sub: 'SUBTITLE', col: '#rrggbb', pts: [[x, y, w], …] }
```
`pts` is a closed loop of `[x, y, w]` control points fed into Catmull-Rom. `w` is road width in pixels (typically 70–150). The game world is 1600×1140 px. Optionally add `obstacles: [{x, y, size, angle}, …]` for hand-placed blocks (skips random generation).

## Adding a Car Type

1. Append an entry to `CAR_PRESETS` in `cars.js`. Required fields: `name`, `svgTemplate` (copy an existing one and adjust shapes; use `CARCOLOR` as the color placeholder), `topSpeed`, `accel`, `brake`, `friction`, `turnRate`, `boostFactor`, `reverseMax`.
2. Add a matching SVG source to `assets/cars/` for reference (optional — the game uses the inline `svgTemplate`).

## Running Tests

Open `tests.html` in a browser. It loads `geometry.js` and `cars.js` with lightweight mocks and reports pass/fail for all unit tests inline.
