// ── TRACK DEFINITIONS ─────────────────────────────
// Each track is a closed loop of [x, y, w] control points fed into a Catmull-Rom
// spline. w is the road width at that point (pixels); it is interpolated smoothly
// along with x and y so the track can widen and narrow between corners.
const TRACK_DEFS = [

  {
    name: 'LITTLE',
    sub:  'DEMO',
    col:  '#bd849c',
    pts: [
      [800, 370, 100], [1000, 570, 100], [800, 770, 100],  [600, 570, 100],
    ],
    // Between pts[0]→[1] and pts[2]→[3]
    obstacles: [
      { x: 930, y: 500, size: 20, angle:  0 },
      { x: 890, y: 770, size: 20, angle: 0 },
      { x: 670, y: 640, size: 20, angle: 0 },
    ],
  },
  {
    name: 'BILLIARD TABLE',
    sub:  'FIGURE 8 LOOP',
    col:  '#abbbff',
    pts: [
      [400, 560, 80], [426, 460, 80], [499, 386, 80], [600, 360, 80], [699, 386, 80], [773, 459, 100],
      [800, 550, 120], [826, 660, 100], [900, 733, 80], [1000, 760, 80], [1100, 733, 80], [1173, 660, 80],
      [1200, 560, 80], [1173, 459, 80], [1099, 386, 80], [1000, 360, 80], [899, 386, 71], [826, 460, 100],
      [800, 550, 120], [773, 660, 100], [700, 733, 80], [600, 760, 80], [500, 733, 80], [426, 660, 80],
    ],
    // Upper-right loop and lower-left loop
    obstacles: [
      { x: 1080, y: 408, size: 50, angle:  0.52 },
      { x:  582, y: 732, size: 46, angle: -3.14 },
    ],
  },
  {
    name: 'BREAKFAST TABLE',
    sub:  'OVAL CIRCUIT',
    col:  '#00ff88',
    pts: [
      [800, 88,   98], [1090, 104,  92], [1316, 224, 78], [1410, 510, 72], [1384, 796, 146], [1194, 976,  82],
      [800, 1016, 129], [406,  976,  84], [216,  796, 76], [190,  510, 151], [284,  224, 107], [510,  104,  91],
    ],
    // Top-right straight and bottom-left straight
    obstacles: [
      { x: 1205, y: 162, size: 52, angle:  0.49 },
      { x:  308, y: 882, size: 48, angle: -2.38 },
    ],
  },
  {
    name: 'WORK DESK',
    sub:  'TECHNICAL TRACK',
    col:  '#ff8822',
    pts: [
      [800, 100,  96], [1080, 100,  88], [1276, 200, 78], [1320, 390, 71], [1256, 530, 70], [1010, 540, 75],
      [1010, 716, 82], [1136, 836,  74], [1236, 930, 108], [800,  980, 95], [364,  930, 79], [464,  836, 73],
      [590,  716, 83], [590,  540,  104], [344,  530, 70], [280,  390, 72], [324,  200, 97], [520,  100, 89],
    ],
    // Top straight and bottom straight
    obstacles: [
      { x: 940, y: 100, size: 50, angle:  0.0  },
      { x: 600, y: 962, size: 46, angle: -3.03 },
    ],
  },
];
