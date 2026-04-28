// Board: 19×19 CSS grid
// Outer ring: perimeter of 19×19 (72 cells, clockwise)
// Inner ring: perimeter of 13×13 area at rows 3-15, cols 3-15 (48 cells, clockwise)
// Margin (rows 1-2, 16-17, cols 1-2, 16-17): HOME areas
// Inside inner ring (rows 4-14, cols 4-14): finish lanes + center

// --- Outer path (72 cells, clockwise starting [0,0]) ---
function buildOuterPath() {
  const path = [];
  // Top: left → right (row 0, col 0..18)
  for (let c = 0; c <= 18; c++) path.push({ r: 0, c });
  // Right: top → bottom (col 18, row 1..18)
  for (let r = 1; r <= 18; r++) path.push({ r, c: 18 });
  // Bottom: right → left (row 18, col 17..0)
  for (let c = 17; c >= 0; c--) path.push({ r: 18, c });
  // Left: bottom → top (col 0, row 17..1)
  for (let r = 17; r >= 1; r--) path.push({ r, c: 0 });
  return path; // 72 cells (indices 0-71)
}

// --- Inner path (48 cells, clockwise starting [3,3]) ---
function buildInnerPath() {
  const path = [];
  // Top: left → right (row 3, col 3..15)
  for (let c = 3; c <= 15; c++) path.push({ r: 3, c });
  // Right: top → bottom (col 15, row 4..15)
  for (let r = 4; r <= 15; r++) path.push({ r, c: 15 });
  // Bottom: right → left (row 15, col 14..3)
  for (let c = 14; c >= 3; c--) path.push({ r: 15, c });
  // Left: bottom → top (col 3, row 14..4)
  for (let r = 14; r >= 4; r--) path.push({ r, c: 3 });
  return path; // 48 cells (indices 0-47)
}

export const OUTER_PATH = buildOuterPath();
export const INNER_PATH = buildInnerPath();

// Helper: get path index for a given cell on a path
export function getOuterIndex(r, c) {
  return OUTER_PATH.findIndex(p => p.r === r && p.c === c);
}
export function getInnerIndex(r, c) {
  return INNER_PATH.findIndex(p => p.r === r && p.c === c);
}

// Advance index clockwise by `steps` on a path of length `len`
export function advanceCW(idx, steps, len) {
  return (idx + steps) % len;
}
// Advance index counter-clockwise (REWIND)
export function advanceCCW(idx, steps, len) {
  return (idx - steps + len) % len;
}

// --- Player definitions ---
// exitOuter / exitInner: index on path where figure appears when leaving HOME
// innerFinishEntryIdx: index on INNER_PATH one step before the finish lane
//   (when a figure is HERE and rolls, next step goes into finishCells[0])
// outerFinishEntryIdx: same but on OUTER_PATH
// finishCells: [{r,c}] length 4, index 0 = slot closest to path (slot 4), index 3 = deepest (slot 1)
// homeCells: [{r,c}] the 4 cells in HOME area
// color: CSS hex
// mostPairs: [{outerIdx, innerIdx}] — pairs of (outer path index, inner path index)
//   that are geometrically parallel (1 cell apart) — natural MOST bridge positions

export const PLAYERS = {
  red: {
    color: '#e53935',
    colorVar: '--color-red',
    homeCells: [{ r: 1, c: 1 }, { r: 1, c: 2 }, { r: 2, c: 1 }, { r: 2, c: 2 }],
    exitOuter: 1,           // outer[1]  = [0,1]
    exitInner: 1,           // inner[1]  = [3,4]
    outerFinishEntryIdx: 71, // outer[71] = [1,0]  → enters outerFinishCells
    innerFinishEntryIdx: 47, // inner[47] = [4,3]  → enters innerFinishCells
    // outer finish lane: row 2, cols 3-6 (between rings, top-left)
    outerFinishCells: [{ r: 2, c: 3 }, { r: 2, c: 4 }, { r: 2, c: 5 }, { r: 2, c: 6 }],
    // inner finish lane: row 4, cols 4-7 (inside inner ring)
    innerFinishCells: [{ r: 4, c: 4 }, { r: 4, c: 5 }, { r: 4, c: 6 }, { r: 4, c: 7 }],
    mostPairs: [{ outerIdx: 71, innerIdx: 47 }, { outerIdx: 0, innerIdx: 0 }],
  },
  yellow: {
    color: '#fdd835',
    colorVar: '--color-yellow',
    homeCells: [{ r: 1, c: 9 }, { r: 1, c: 10 }, { r: 2, c: 9 }, { r: 2, c: 10 }],
    exitOuter: 9,
    exitInner: 7,           // inner[7] = [3,10]
    outerFinishEntryIdx: 8,
    innerFinishEntryIdx: 6, // inner[6] = [3,9]
    outerFinishCells: [{ r: 2, c: 7 }, { r: 2, c: 8 }, { r: 2, c: 9 }, { r: 2, c: 10 }],
    innerFinishCells: [{ r: 4, c: 9 }, { r: 5, c: 9 }, { r: 6, c: 9 }, { r: 7, c: 9 }],
    mostPairs: [{ outerIdx: 8, innerIdx: 6 }, { outerIdx: 9, innerIdx: 7 }],
  },
  blue: {
    color: '#1e88e5',
    colorVar: '--color-blue',
    homeCells: [{ r: 1, c: 16 }, { r: 1, c: 17 }, { r: 2, c: 16 }, { r: 2, c: 17 }],
    exitOuter: 17,
    exitInner: 11,          // inner[11] = [3,14]
    outerFinishEntryIdx: 16,
    innerFinishEntryIdx: 10,
    outerFinishCells: [{ r: 2, c: 12 }, { r: 2, c: 13 }, { r: 2, c: 14 }, { r: 2, c: 15 }],
    innerFinishCells: [{ r: 4, c: 14 }, { r: 5, c: 14 }, { r: 6, c: 14 }, { r: 7, c: 14 }],
    mostPairs: [{ outerIdx: 16, innerIdx: 10 }, { outerIdx: 17, innerIdx: 11 }],
  },
  magenta: {
    color: '#d81b60',
    colorVar: '--color-magenta',
    homeCells: [{ r: 9, c: 16 }, { r: 9, c: 17 }, { r: 10, c: 16 }, { r: 10, c: 17 }],
    exitOuter: 27,          // outer[27] = [9,18]
    exitInner: 19,          // inner[19] = [10,15]
    outerFinishEntryIdx: 26,
    innerFinishEntryIdx: 18, // inner[18] = [9,15]
    outerFinishCells: [{ r: 7, c: 16 }, { r: 7, c: 17 }, { r: 8, c: 16 }, { r: 8, c: 17 }],
    innerFinishCells: [{ r: 9, c: 14 }, { r: 9, c: 13 }, { r: 9, c: 12 }, { r: 9, c: 11 }],
    mostPairs: [{ outerIdx: 26, innerIdx: 18 }, { outerIdx: 27, innerIdx: 19 }],
  },
  orange: {
    color: '#fb8c00',
    colorVar: '--color-orange',
    homeCells: [{ r: 16, c: 16 }, { r: 16, c: 17 }, { r: 17, c: 16 }, { r: 17, c: 17 }],
    exitOuter: 37,          // outer[37] = [18,17]
    exitInner: 25,          // inner[25] = [15,14]
    outerFinishEntryIdx: 36,
    innerFinishEntryIdx: 24, // inner[24] = [15,15]  ← corner; figure turns left
    outerFinishCells: [{ r: 16, c: 14 }, { r: 16, c: 13 }, { r: 16, c: 12 }, { r: 16, c: 11 }],
    innerFinishCells: [{ r: 14, c: 14 }, { r: 14, c: 13 }, { r: 14, c: 12 }, { r: 14, c: 11 }],
    mostPairs: [{ outerIdx: 36, innerIdx: 24 }, { outerIdx: 37, innerIdx: 25 }],
  },
  purple: {
    color: '#8e24aa',
    colorVar: '--color-purple',
    homeCells: [{ r: 16, c: 9 }, { r: 16, c: 10 }, { r: 17, c: 9 }, { r: 17, c: 10 }],
    exitOuter: 45,          // outer[45] = [18,9]
    exitInner: 31,          // inner[31] = [15,8]
    outerFinishEntryIdx: 44,
    innerFinishEntryIdx: 30, // inner[30] = [15,9]
    outerFinishCells: [{ r: 16, c: 8 }, { r: 16, c: 9 }, { r: 16, c: 10 }, { r: 16, c: 11 }],
    innerFinishCells: [{ r: 14, c: 9 }, { r: 13, c: 9 }, { r: 12, c: 9 }, { r: 11, c: 9 }],
    mostPairs: [{ outerIdx: 44, innerIdx: 30 }, { outerIdx: 45, innerIdx: 31 }],
  },
  cyan: {
    color: '#00acc1',
    colorVar: '--color-cyan',
    homeCells: [{ r: 16, c: 1 }, { r: 16, c: 2 }, { r: 17, c: 1 }, { r: 17, c: 2 }],
    exitOuter: 55,          // outer[55] = [17,0]
    exitInner: 37,          // inner[37] = [14,3]
    outerFinishEntryIdx: 54,
    innerFinishEntryIdx: 36, // inner[36] = [15,3]
    outerFinishCells: [{ r: 16, c: 3 }, { r: 16, c: 4 }, { r: 16, c: 5 }, { r: 16, c: 6 }],
    innerFinishCells: [{ r: 14, c: 4 }, { r: 13, c: 4 }, { r: 12, c: 4 }, { r: 11, c: 4 }],
    mostPairs: [{ outerIdx: 54, innerIdx: 36 }, { outerIdx: 55, innerIdx: 37 }],
  },
  green: {
    color: '#43a047',
    colorVar: '--color-green',
    homeCells: [{ r: 9, c: 1 }, { r: 9, c: 2 }, { r: 10, c: 1 }, { r: 10, c: 2 }],
    exitOuter: 63,          // outer[63] = [9,0]
    exitInner: 43,          // inner[43] = [8,3]
    outerFinishEntryIdx: 62,
    innerFinishEntryIdx: 42, // inner[42] = [9,3]
    outerFinishCells: [{ r: 8, c: 1 }, { r: 8, c: 2 }, { r: 7, c: 1 }, { r: 7, c: 2 }],
    innerFinishCells: [{ r: 9, c: 4 }, { r: 9, c: 5 }, { r: 9, c: 6 }, { r: 9, c: 7 }],
    mostPairs: [{ outerIdx: 62, innerIdx: 42 }, { outerIdx: 63, innerIdx: 43 }],
  },
};

export const PLAYER_ORDER = ['red', 'yellow', 'blue', 'magenta', 'orange', 'purple', 'cyan', 'green'];

// Build a fast lookup: "r,c" -> cell descriptor
function buildGrid() {
  const grid = Array.from({ length: 19 }, () =>
    Array.from({ length: 19 }, () => ({ type: 'empty' }))
  );

  // Outer path cells
  OUTER_PATH.forEach(({ r, c }, idx) => {
    grid[r][c] = { type: 'outer-path', outerIdx: idx };
  });

  // Inner path cells
  INNER_PATH.forEach(({ r, c }, idx) => {
    grid[r][c] = { type: 'inner-path', innerIdx: idx };
  });

  // Center area (inside inner ring, not finish)
  for (let r = 4; r <= 14; r++) {
    for (let c = 4; c <= 14; c++) {
      if (grid[r][c].type === 'empty') {
        grid[r][c] = { type: 'center' };
      }
    }
  }

  // Player HOME cells, finish cells
  Object.entries(PLAYERS).forEach(([colorKey, p]) => {
    p.homeCells.forEach(({ r, c }) => {
      grid[r][c] = { type: 'home', color: colorKey };
    });
    p.outerFinishCells.forEach(({ r, c }, slot) => {
      grid[r][c] = { type: 'outer-finish', color: colorKey, slot: slot + 1 };
    });
    p.innerFinishCells.forEach(({ r, c }, slot) => {
      grid[r][c] = { type: 'inner-finish', color: colorKey, slot: slot + 1 };
    });
  });

  return grid;
}

export const GRID = buildGrid();

// Helper: check if a position is the finish entry for a player on a given ring
export function isFinishEntry(ring, idx, colorKey) {
  const p = PLAYERS[colorKey];
  if (ring === 'outer') return idx === p.outerFinishEntryIdx;
  if (ring === 'inner') return idx === p.innerFinishEntryIdx;
  return false;
}

// Calculate the number of steps between two path indices (clockwise)
export function stepsBetween(fromIdx, toIdx, pathLen) {
  return (toIdx - fromIdx + pathLen) % pathLen;
}

// Special square types
export const SPECIAL_TYPES = ['most', 'kocka', 'rewind', 'bomba', 'stop', 'zamjena'];

// Distribute specials: floor(8 / numPlayers) of each type per player
export function distributeSpecials(numPlayers) {
  const perPlayer = Math.floor(8 / numPlayers);
  const hand = [];
  SPECIAL_TYPES.forEach(type => {
    for (let i = 0; i < perPlayer; i++) hand.push(type);
  });
  return hand;
}

// Check if a cell can receive a special square (rule 9b)
// cell: {type, color, ...}; ring: 'outer'|'inner'; idx: number; playerColor: string
export function canPlaceSpecial(ring, idx, playerColor) {
  const { r, c } = ring === 'outer' ? OUTER_PATH[idx] : INNER_PATH[idx];
  const cell = GRID[r][c];
  // Must be a plain path cell (no existing special, no finish entry for anyone)
  if (cell.type !== 'outer-path' && cell.type !== 'inner-path') return false;
  // Not a finish entry for any color
  for (const [, p] of Object.entries(PLAYERS)) {
    if (ring === 'outer' && idx === p.outerFinishEntryIdx) return false;
    if (ring === 'inner' && idx === p.innerFinishEntryIdx) return false;
    if (ring === 'outer' && idx === p.exitOuter) return false;
    if (ring === 'inner' && idx === p.exitInner) return false;
  }
  return true;
}