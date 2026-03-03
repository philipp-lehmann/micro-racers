# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MICRO RACERS is a self-contained browser racing game in a single file: `micro-racers.html`. There is no build system, package manager, or dependencies — open the file directly in any modern browser to run it.

## Architecture

The entire game lives in `micro-racers.html` as embedded JavaScript and CSS. It is structured as a state machine with a `requestAnimationFrame` game loop:

**Screen states**: `'start'` → `'countdown'` → `'race'` → `'results'`

**Key subsystems and their entry points:**
- **Track**: `buildSpline()` / `buildEdges()` generate geometry from control point definitions in `TDEFS`; `trackProg()` computes 0–1 lap progress; `nearDist()` checks if a car is on-track
- **Cars**: `makeCar(id, isAI, col)` creates car state; `updateCar(car, dt)` runs per-frame physics (acceleration, braking, friction, turning, off-track slowdown)
- **AI**: simple waypoint-following inside `updateCar` — targets the nearest track spline point ahead and adjusts steering/throttle accordingly
- **Particles**: `spawnSkid()` / `spawnBurst()` push into a `parts[]` array; `updateParticles(dt)` ticks them
- **Rendering**: `drawBg()`, `drawTrack()`, `drawCar()`, `drawParticles()`, `drawHUD()` — all draw to a single `<canvas>` via 2D context
- **Input**: 4 hardcoded keyboard schemes (arrows / WASD / IJKL / numpad) read from a `keys` object populated by `keydown`/`keyup` listeners
- **Main loop**: `loop(ts)` — delta-time capped at 50 ms, calls physics then rendering each frame

**Physics constants** (top of `<script>`): `MAX_SPD`, `MAX_REV`, `ACCEL`, `BRAKE`, `FRIC`, `TURN_R`

**Color palette**: `P` object — change values here to retheme the entire game.

**Tracks**: defined in `TDEFS` as arrays of `{x, y}` control points plus a `w` (width) property.
