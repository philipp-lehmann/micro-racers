# MICRO RACERS

A self-contained browser racing game. No build step, no dependencies — open `index.html` in any modern browser and race.

## Play

```
open index.html
```

Up to 4 players share one keyboard. Use the start screen to pick player count, track, and number of laps.

## Controls

### Menu (start screen)
| Key | Action |
|-----|--------|
| `↑` / `↓` | Select row |
| `←` / `→` | Change value |
| `Enter` | Start race |

### In race

| | P1 | P2 | P3 | P4 |
|---|---|---|---|---|
| **Drive** | `↑ ↓ ← →` | `W A S D` | `I J K L` | `Num 8 4 2 6` |
| **Retire** | `Backspace` | `Q` | `U` | `5` |
| **Honk** | `-` | `E` | `O` | `0` |

## Features

- 1–4 local players on one keyboard
- 4 tracks with variable-width roads
- AI opponents fill remaining slots
- Lap timer, best lap, and finish-time tracking
- Three race-end conditions: all finish · all retired (+ 5 s) · humans done (+ 10 s for AI)
- Particle effects: skids, finish bursts, honk beacons
- Isometric camera that follows the human players and zooms to cover their spread

## Tracks

| Name | Type |
|------|------|
| Little | Demo loop |
| Billiard Table | Figure-8 |
| Breakfast Table | Oval circuit |
| Work Desk | Technical track |

## Project structure

```
index.html        # Shell — canvas + script tags
micro-racers.css  # Three rules (reset, body, canvas)
micro-racers.js   # All game logic
tracks.js         # Track definitions (loaded before the main script)
```

### Adding a track

Edit `tracks.js` and append an entry to `TRACK_DEFS`:

```js
{
  name: 'MY TRACK',
  sub:  'SHORT DESCRIPTION',
  col:  '#ff0088',          // edge colour and UI accent
  pts: [
    [x, y, w],              // control points: position + road width (px)
    // …closed loop, minimum 3 points
  ],
},
```

Control points are fed into a Catmull-Rom spline. `w` (road width, typically 70–150 px) is interpolated smoothly along the spline so the road can widen and narrow between corners.

## Architecture

The game runs as a state machine driven by `requestAnimationFrame`:

```
'start' → 'countdown' → 'race' → 'results'
```

| Subsystem | Entry points |
|-----------|-------------|
| Track geometry | `buildSpline()`, `buildEdges()` |
| Car state | `makeCar()`, `updateCar()` |
| AI | Waypoint follower inside `updateCar` |
| Particles | `spawnSkid()`, `spawnBurst()`, `spawnHonk()` |
| Rendering | `drawBg()`, `drawTrack()`, `drawCar()`, `drawHUD()`, … |
| Camera | `updateCamera()` — follows human-player centroid, zooms to spread |

Physics constants (`MAX_SPEED`, `ACCEL`, `BRAKE`, `FRICTION`, `TURN_RATE`) and the colour palette (`COLORS`) are defined near the top of `micro-racers.js`.
