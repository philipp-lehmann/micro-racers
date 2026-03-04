# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MICRO RACERS is a browser racing game with no build system or package manager. Open `index.html` directly in any modern browser to run it.

## File Structure

Scripts are loaded in dependency order in `index.html`:

| File | Contents |
|------|----------|
| `music.js` | Strudel-based soundtrack. Exposes `setMusicMode(mode)` and `setMusicMuted(bool)` as globals. Modes: `'beat'` (start/results), `'race'` (full stack). |
| `tracks.js` | `TRACK_DEFS` array — read-only built-in track control points. |
| `cars.js` | Physics constants, `CAR_PRESETS`, `makeCar()`, `updateCar()`, `resolveCarCollisions()`, `drawCar()`. |
| `micro-racers.js` | Everything else: canvas setup, geometry helpers, input, game state, particles, camera, all screen draw functions, main loop. |
| `micro-racers.css` | Three rules only (reset, body, canvas). |

`cars.js` and `tracks.js` are loaded before `micro-racers.js` and communicate via globals — there is no module system.

## Screen State Machine

```
'start' → 'countdown' → 'race' → 'results'
               ↕                       ↕
           'tracks'  ←→  'editor'
```

The current screen is the `screen` variable. The main `loop()` function dispatches to per-screen draw/update functions. Button click handling for the results screen happens in the main loop (not inside `drawResults`).

## Key Architecture Points

**Track geometry** (`micro-racers.js`): `buildTrackObj(def, isUser)` converts raw `[x, y, w]` control points into a pre-computed object with `spline`, `edges`, `cumulativeLengths`, and `totalLength`. The mutable `TRACKS` array combines built-in (`TRACK_DEFS`) and user tracks (persisted in `localStorage` under `mrUserTracks`).

**Car physics** (`cars.js`): Acceleration uses a quadratic-drag model — `dv/dt = accel·(1-(v/topSpeed)²)` — which reaches ~90% top speed in ~2 s and asymptotes to 100% over ~10 s. Off-track penalty is a gradient: `offFraction` (0–1) ramps linearly over `GRAVEL_ZONE = 40px` past the track edge, scaling both the top-speed cap and exponential speed decay. All per-car physics params live in `CAR_PRESETS`; each car holds a `stats` reference.

**Car presets** (`cars.js`): `CAR_PRESETS` is the extension point for different car types. Each preset has `topSpeed`, `accel`, `brake`, `friction`, `turnRate`, `boostFactor`, `reverseMax`.

**Rendering**: The game uses an isometric transform applied via `ctx.transform()` each frame. `worldToScreen()` converts world coords for HUD elements drawn outside the transform. `drawCar()` operates in world space (before the iso restore).

**Camera** (`micro-racers.js:updateCamera`): Smooth-follows the centroid of human players. Zoom is driven by two factors multiplied together — speed (`1.5` at rest → `0.75` at max speed) and player spread (`560 / (spread + 560)`), clamped to a minimum of `0.35`.

**Music** (`music.js`): `initStrudel()` is called synchronously (returns `undefined`, not a Promise). All drum synthesis uses Web Audio oscillators (`s("sine/square/triangle/sawtooth")`) — no sample files. The `'beat'` mode plays an 8-beat kick intro before the full pattern drops (via `setTimeout`).

**Color conventions**: `COLORS` object for the palette. Append `BTN_DIM` (`'1a'`) to any 6-digit hex for a 10%-opacity idle button background. `muteColor(hex, factor)` derives AI car colors. `COLORS.danger` is used for all destructive actions.

**Input**: `keys` object (keydown/keyup), `mouse` object (reset each frame by the main loop). `CONTROLS[0–3]` maps player index to key bindings including `boost`.

## Adding a Track

Append to `TRACK_DEFS` in `tracks.js`:
```js
{ name: 'MY TRACK', sub: 'SUBTITLE', col: '#rrggbb', pts: [[x, y, w], …] }
```
`pts` is a closed loop of `[x, y, w]` control points fed into Catmull-Rom. `w` is road width in pixels (typically 70–150). The game world is 1600×1140 px.

## Adding a Car Type

Append to `CAR_PRESETS` in `cars.js` and update `makeCar` (or the race setup in `initRace`) to select the preset by index.
