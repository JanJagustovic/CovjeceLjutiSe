import { useReducer, useCallback } from 'react';
import {
  OUTER_PATH, INNER_PATH, PLAYERS,
  advanceCW, advanceCCW,
  distributeSpecials, canPlaceSpecial, canPlaceMost, getBridgeParallel,
} from '../data/boardLayout.js';

const OUTER_LEN = OUTER_PATH.length; // 72
const INNER_LEN = INNER_PATH.length; // 48

function rollD6() {
  return Math.floor(Math.random() * 6) + 1;
}

function initFigures() {
  return [
    { id: 0, pos: 'home', rewindNext: false, stopActive: false, bombActive: null },
    { id: 1, pos: 'home', rewindNext: false, stopActive: false, bombActive: null },
    { id: 2, pos: 'home', rewindNext: false, stopActive: false, bombActive: null },
    { id: 3, pos: 'home', rewindNext: false, stopActive: false, bombActive: null },
  ];
}

function initState(setupPlayers) {
  return {
    players: setupPlayers.map(sp => ({
      color: sp.color,
      name: sp.name,
      figures: initFigures(),
      specialsHeld: distributeSpecials(setupPlayers.length),
    })),
    currentPlayerIndex: 0,
    diceValue: null,
    secondDiceValue: null,
    rollsLeft: 1,
    bonusRoll: false,
    phase: 'initial-roll',
    specialsOnBoard: {},
    bridgesOnBoard: {},
    duelState: null,
    specialTrigger: null,
    exitChoice: null,
    winner: null,
    log: [],
    // Initial roll state (rule 2)
    initialRollOrder: setupPlayers.map(sp => sp.color),
    initialRolls: {},     // colorKey → value rolled this round
    initialRollIdx: 0,    // index into initialRollOrder of who rolls next
    initialRollWinner: null,  // set when one player wins
    initialRollTied: false,   // set when round ends in a tie
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────

function pathLen(ring) {
  return ring === 'outer' ? OUTER_LEN : INNER_LEN;
}


function playerDef(color) {
  return PLAYERS[color];
}

function figureOnPath(pos, ring, idx) {
  return typeof pos === 'object' && pos.ring === ring && pos.idx === idx;
}

function figureInFinish(pos, colorKey, lane, slot) {
  return typeof pos === 'object' && pos.lane === lane && pos.color === colorKey && pos.slot === slot;
}

function isAllStuck(player) {
  const figs = player.figures;
  const atHome = figs.filter(f => f.pos === 'home').length;
  if (atHome === 4) return true;
  const finishFigs = figs.filter(f => typeof f.pos === 'object' && f.pos.lane === 'finish');
  const pathFigs = figs.filter(f => typeof f.pos === 'object' && f.pos.ring);
  if (pathFigs.length > 0) return false;
  const slots = finishFigs.map(f => f.pos.slot).sort((a, b) => b - a);
  for (let i = 0; i < slots.length; i++) {
    if (slots[i] !== 4 - i) return false;
  }
  return true;
}

function isWinner(player) {
  return player.figures.every(f =>
    typeof f.pos === 'object' && f.pos.lane === 'finish'
  );
}

function findFigureOnCell(players, ring, idx) {
  for (const p of players) {
    for (const f of p.figures) {
      if (figureOnPath(f.pos, ring, idx)) {
        return { player: p, figure: f };
      }
    }
  }
  return null;
}

function findFigureInFinish(players, colorKey, lane, slot) {
  for (const p of players) {
    for (const f of p.figures) {
      if (figureInFinish(f.pos, colorKey, lane, slot)) {
        return { player: p, figure: f };
      }
    }
  }
  return null;
}

// ── Valid move calculation ─────────────────────────────────────────────────

export function getValidMoves(state, diceVal) {
  const player = state.players[state.currentPlayerIndex];
  const moves = [];

  player.figures.forEach(fig => {
    // STOP: can only move if dice = 1
    if (fig.stopActive && diceVal !== 1) return;

    if (fig.pos === 'home') {
      if (diceVal === 6) {
        // Can exit to outer or inner ring
        const pd = playerDef(player.color);
        const outerOcc = findFigureOnCell(state.players, 'outer', pd.exitOuter);
        if (!outerOcc) {
          moves.push({ figId: fig.id, type: 'exit', ring: 'outer', idx: pd.exitOuter });
        }
        const innerOcc = findFigureOnCell(state.players, 'inner', pd.exitInner);
        if (!innerOcc) {
          moves.push({ figId: fig.id, type: 'exit', ring: 'inner', idx: pd.exitInner });
        }
      }
      return;
    }

    if (typeof fig.pos === 'object' && fig.pos.ring) {
      const { ring, idx } = fig.pos;
      const len = pathLen(ring);
      const pd = playerDef(player.color);

      if (fig.rewindNext) {
        let targetIdx = advanceCCW(idx, diceVal, len);
        if (ring === 'inner') {
          // Clamp backward move at the exit point — can't rewind past spawn
          const stepsBackToExit = (idx - pd.exitInner + len) % len;
          if (stepsBackToExit < diceVal) targetIdx = pd.exitInner;
        }
        if (!findFigureOnCell(state.players, ring, targetIdx)) {
          moves.push({ figId: fig.id, type: 'move', ring, idx: targetIdx, rewind: true });
        }
        return;
      }

      if (ring === 'inner') {
        const stepsToFinish = (pd.finishEntryIdx - idx + len) % len;
        if (diceVal <= stepsToFinish) {
          const targetIdx = advanceCW(idx, diceVal, len);
          const occupant = findFigureOnCell(state.players, ring, targetIdx);
          if (!occupant || occupant.player.color !== player.color) {
            moves.push({ figId: fig.id, type: 'move', ring, idx: targetIdx });
          }
        } else {
          const slot = diceVal - stepsToFinish;
          if (slot >= 1 && slot <= 4) {
            if (!findFigureInFinish(state.players, player.color, 'finish', slot)) {
              moves.push({ figId: fig.id, type: 'finish', lane: 'finish', color: player.color, slot });
            }
          }
          // else overshoot (slot > 4) — no valid move
        }
      } else {
        // Outer ring: loop indefinitely, no finish access
        const targetIdx = advanceCW(idx, diceVal, len);
        const occupant = findFigureOnCell(state.players, ring, targetIdx);
        if (!occupant || occupant.player.color !== player.color) {
          moves.push({ figId: fig.id, type: 'move', ring, idx: targetIdx });
        }
      }
      return;
    }

    if (typeof fig.pos === 'object' && fig.pos.lane) {
      // In finish lane — advance deeper
      const { lane, color, slot } = fig.pos;
      const nextSlot = slot + diceVal;
      if (nextSlot <= 4) {
        if (!findFigureInFinish(state.players, color, lane, nextSlot)) {
          moves.push({ figId: fig.id, type: 'finish', lane, color, slot: nextSlot });
        }
      }
    }
  });

  return moves;
}

// ── Reducer ────────────────────────────────────────────────────────────────


function advanceTurn(state) {
  let nextIdx = (state.currentPlayerIndex + 1) % state.players.length;
  const nextPlayer = state.players[nextIdx];
  const stuck = isAllStuck(nextPlayer);
  return {
    ...state,
    currentPlayerIndex: nextIdx,
    diceValue: null,
    secondDiceValue: null,
    rollsLeft: stuck ? 3 : 1,
    bonusRoll: false,
    phase: 'rolling',
  };
}

function deepCopyPlayers(players) {
  return players.map(p => ({
    ...p,
    figures: p.figures.map(f => ({ ...f })),
    specialsHeld: [...p.specialsHeld],
  }));
}

function applyMove(state, move) {
  const player = state.players[state.currentPlayerIndex];
  let newPlayers = deepCopyPlayers(state.players);
  const mover = newPlayers.find(p => p.color === player.color);
  const fig = mover.figures.find(f => f.id === move.figId);

  // Clear flags on move
  fig.rewindNext = false;
  fig.stopActive = false;
  fig.bombActive = null; // escaped the bomb by moving

  if (move.type === 'exit') {
    fig.pos = { ring: move.ring, idx: move.idx };
  } else if (move.type === 'move') {
    fig.pos = { ring: move.ring, idx: move.idx };
    if (move.rewind) fig.rewindNext = false; // already moved backward, flag consumed
  } else if (move.type === 'finish') {
    fig.pos = { lane: move.lane, color: move.color, slot: move.slot };
  }

  // Detonate any other armed figures of the current player that weren't moved
  mover.figures.filter(f => f.id !== move.figId && f.bombActive).forEach(armed => {
    mover.specialsHeld = [...mover.specialsHeld, 'bomba'];
    armed.pos = 'home';
    armed.stopActive = false;
    armed.rewindNext = false;
    armed.bombActive = null;
  });

  // Check for capture (only on path, not on finish/home)
  let duelState = null;
  let specialTrigger = null;

  if ((move.type === 'move' || move.type === 'exit') && !move.rewind) {
    const ring = move.ring;
    const idx = move.idx;
    const occupied = findFigureOnCell(newPlayers.filter(p => p.color !== player.color), ring, idx);
    if (occupied) {
      // Dynamic rule 8: dice duel
      duelState = {
        atkColor: player.color,
        defColor: occupied.player.color,
        ring,
        idx,
        figId: move.figId,
        defFigId: occupied.figure.id,
        atkRoll: null,
        defRoll: null,
      };
    }
  }

  if (move.type === 'move' || move.type === 'exit') {
    // Check special square — applies even on rewind moves
    const spKey = `${move.ring}-${move.idx}`;
    if (!duelState && state.specialsOnBoard[spKey]) {
      specialTrigger = {
        type: state.specialsOnBoard[spKey].type,
        ring: move.ring,
        idx: move.idx,
        figId: move.figId,
        playerColor: player.color,
        placedBy: state.specialsOnBoard[spKey].placedBy,
      };
    } else if (!duelState && move.type !== 'exit') {
      // Bridge: check direct cell first, then parallel cell
      const parallel = getBridgeParallel(move.ring, move.idx);
      if (state.bridgesOnBoard[spKey]) {
        specialTrigger = {
          type: 'most',
          ring: move.ring,
          idx: move.idx,
          figId: move.figId,
          playerColor: player.color,
          placedBy: state.bridgesOnBoard[spKey].placedBy,
        };
      } else if (parallel) {
        const parallelKey = `${parallel.ring}-${parallel.idx}`;
        if (state.bridgesOnBoard[parallelKey]) {
          specialTrigger = {
            type: 'most',
            ring: move.ring,
            idx: move.idx,
            figId: move.figId,
            playerColor: player.color,
            placedBy: state.bridgesOnBoard[parallelKey].placedBy,
          };
        }
      }
    }
  }

  // Check win
  const winner = newPlayers.find(isWinner);
  if (winner) {
    return { ...state, players: newPlayers, winner: winner.color, phase: 'game-over' };
  }

  if (duelState) {
    return { ...state, players: newPlayers, duelState, phase: 'duel' };
  }

  if (specialTrigger) {
    return applySpecialTrigger({ ...state, players: newPlayers }, specialTrigger);
  }

  return afterMove({ ...state, players: newPlayers }, move);
}

function afterMove(state, move) {
  const player = state.players[state.currentPlayerIndex];
  const hasSpecials = player.specialsHeld.length > 0;
  const hasBridge = player.specialsHeld.includes('most');
  const spKey = `${move.ring}-${move.idx}`;
  const activeColors = state.players.map(p => p.color);
  const isSpawnPoint = typeof move.ring === 'string' && activeColors.some(color => {
    const pd = PLAYERS[color];
    return pd && (
      (move.ring === 'outer' && move.idx === pd.exitOuter) ||
      (move.ring === 'inner' && move.idx === pd.exitInner)
    );
  });
  const validPlacement = (move.type === 'move' || move.type === 'exit') &&
    !state.specialsOnBoard[spKey] && (
      isSpawnPoint
        ? hasBridge && !!canPlaceMost(move.ring, move.idx, state.bridgesOnBoard)
        : hasSpecials && canPlaceSpecial(move.ring, move.idx, activeColors)
    );

  if (validPlacement) {
    return { ...state, phase: 'placing-special', lastMoveRing: move.ring, lastMoveIdx: move.idx };
  }

  // Bonus roll if dice was 6
  if (state.bonusRoll) {
    return { ...state, phase: 'rolling', diceValue: null, bonusRoll: false, rollsLeft: 1 };
  }

  return advanceTurn(state);
}

// Shared post-landing logic for moves that teleport a piece (MOST bridge, KOCKA).
// Checks collision → duel, then special trigger, then normal afterMove.
function afterLanding(state, newPlayers, ring, idx, figId, playerColor) {
  const occupied = findFigureOnCell(newPlayers.filter(p => p.color !== playerColor), ring, idx);
  if (occupied) {
    const duelSt = {
      atkColor: playerColor,
      defColor: occupied.player.color,
      ring,
      idx,
      figId,
      defFigId: occupied.figure.id,
      atkRoll: null,
      defRoll: null,
    };
    return { ...state, players: newPlayers, duelState: duelSt, phase: 'duel' };
  }
  const spKey = `${ring}-${idx}`;
  if (state.specialsOnBoard[spKey]) {
    const trigger = {
      type: state.specialsOnBoard[spKey].type,
      ring,
      idx,
      figId,
      playerColor,
      placedBy: state.specialsOnBoard[spKey].placedBy,
    };
    return applySpecialTrigger({ ...state, players: newPlayers }, trigger);
  }
  // Bridge: check direct cell first, then parallel cell
  const parallel = getBridgeParallel(ring, idx);
  const bridgeKey = spKey;
  if (state.bridgesOnBoard[bridgeKey]) {
    const trigger = {
      type: 'most',
      ring,
      idx,
      figId,
      playerColor,
      placedBy: state.bridgesOnBoard[bridgeKey].placedBy,
    };
    return applySpecialTrigger({ ...state, players: newPlayers }, trigger);
  }
  if (parallel) {
    const parallelKey = `${parallel.ring}-${parallel.idx}`;
    if (state.bridgesOnBoard[parallelKey]) {
      const trigger = {
        type: 'most',
        ring,
        idx,
        figId,
        playerColor,
        placedBy: state.bridgesOnBoard[parallelKey].placedBy,
      };
      return applySpecialTrigger({ ...state, players: newPlayers }, trigger);
    }
  }
  return afterMove({ ...state, players: newPlayers }, { type: 'move', ring, idx });
}

function applySpecialTrigger(state, trigger) {
  const { type, ring, idx, figId, playerColor } = trigger;
  let newPlayers = deepCopyPlayers(state.players);
  let newSpecials = { ...state.specialsOnBoard };
  const spKey = `${ring}-${idx}`;

  if (type === 'bomba') {
    // Arm the figure — it must be moved next turn or it detonates
    const mover = newPlayers.find(p => p.color === playerColor);
    const fig = mover.figures.find(f => f.id === figId);
    fig.bombActive = { placedBy: trigger.placedBy };
    delete newSpecials[spKey];
    return { ...state, players: newPlayers, specialsOnBoard: newSpecials, phase: 'special-trigger', specialTrigger: trigger };
  }

  if (type === 'stop') {
    const mover = newPlayers.find(p => p.color === playerColor);
    const fig = mover.figures.find(f => f.id === figId);
    fig.stopActive = true;
    return { ...state, players: newPlayers, phase: 'special-trigger', specialTrigger: trigger };
  }

  if (type === 'rewind') {
    const mover = newPlayers.find(p => p.color === playerColor);
    const fig = mover.figures.find(f => f.id === figId);
    fig.rewindNext = true;
    return { ...state, players: newPlayers, phase: 'special-trigger', specialTrigger: trigger };
  }

  // MOST, KOCKA, ZAMJENA: need UI interaction — set phase
  return {
    ...state,
    players: newPlayers,
    phase: 'special-trigger',
    specialTrigger: trigger,
  };
}

function reducer(state, action) {
  switch (action.type) {
    case 'ROLL_DICE': {
      const val = rollD6();
      const player = state.players[state.currentPlayerIndex];
      const stuck = isAllStuck(player);

      let newRollsLeft = state.rollsLeft;
      if (stuck) {
        newRollsLeft = state.rollsLeft - 1;
        if (val === 6 || newRollsLeft <= 0) {
          // Got 6 or used all rolls
          const moves = getValidMoves({ ...state, diceValue: val }, val);
          if (val === 6 && moves.length > 0) {
            return { ...state, diceValue: val, rollsLeft: newRollsLeft, phase: 'moving', bonusRoll: true };
          }
          if (newRollsLeft <= 0) {
            return { ...state, diceValue: val, rollsLeft: 0, phase: 'no-moves' };
          }
          return { ...state, diceValue: val, rollsLeft: newRollsLeft };
        }
        return { ...state, diceValue: val, rollsLeft: newRollsLeft };
      }

      const moves = getValidMoves({ ...state, diceValue: val }, val);
      const bonus = val === 6;

      if (moves.length === 0) {
        if (bonus) {
          return { ...state, diceValue: val, bonusRoll: true, phase: 'rolling' };
        }
        return { ...state, diceValue: val, bonusRoll: false, phase: 'no-moves' };
      }

      return { ...state, diceValue: val, bonusRoll: bonus, phase: 'moving' };
    }

    case 'SELECT_MOVE': {
      const move = action.move;
      return applyMove(state, move);
    }

    case 'SKIP_PLACE_SPECIAL': {
      if (state.bonusRoll) {
        return { ...state, phase: 'rolling', diceValue: null, bonusRoll: false, rollsLeft: 1 };
      }
      return advanceTurn(state);
    }

    case 'PLACE_SPECIAL': {
      const { ring, idx, specialType } = action;
      const player = state.players[state.currentPlayerIndex];
      if (specialType === 'most' && !canPlaceMost(ring, idx, state.bridgesOnBoard)) {
        return state;
      }
      if (specialType !== 'most' && !canPlaceSpecial(ring, idx, state.players.map(p => p.color))) {
        return state;
      }
      const newPlayers = deepCopyPlayers(state.players).map(p => {
        if (p.color !== player.color) return p;
        const i = p.specialsHeld.indexOf(specialType);
        if (i !== -1) p.specialsHeld.splice(i, 1);
        return p;
      });
      const spKey = `${ring}-${idx}`;

      // Bridges go into bridgesOnBoard (permanent); all other specials into specialsOnBoard
      const newSpecials = specialType === 'most'
        ? state.specialsOnBoard
        : { ...state.specialsOnBoard, [spKey]: { type: specialType, placedBy: player.color } };
      const newBridges = specialType === 'most'
        ? { ...state.bridgesOnBoard, [spKey]: { placedBy: player.color } }
        : state.bridgesOnBoard;

      // Check if figure on this cell is immediately affected (rule 9c)
      const figHere = findFigureOnCell(newPlayers, ring, idx);
      let nextState = { ...state, players: newPlayers, specialsOnBoard: newSpecials, bridgesOnBoard: newBridges, phase: 'moving' };

      if (figHere && figHere.player.color !== player.color) {
        // Immediate activation on opponent's figure
        nextState = applySpecialTrigger(nextState, {
          type: specialType,
          ring,
          idx,
          figId: figHere.figure.id,
          playerColor: figHere.player.color,
          placedBy: player.color,
        });
      }

      if (nextState.phase === 'moving') {
        if (state.bonusRoll) {
          return { ...nextState, phase: 'rolling', diceValue: null, bonusRoll: false, rollsLeft: 1 };
        }
        return advanceTurn(nextState);
      }
      return nextState;
    }

    case 'RESOLVE_DUEL': {
      const { atkRoll, defRoll } = action;
      const { duelState } = state;
      if (!duelState) return state;

      if (atkRoll === defRoll) {
        // Tie — need to re-roll
        return { ...state, duelState: { ...duelState, atkRoll: null, defRoll: null } };
      }

      let newPlayers = deepCopyPlayers(state.players);
      const loserColor = atkRoll > defRoll ? duelState.defColor : duelState.atkColor;
      const loserFigId = atkRoll > defRoll ? duelState.defFigId : duelState.figId;

      const loserPlayer = newPlayers.find(p => p.color === loserColor);
      const loserFig = loserPlayer.figures.find(f => f.id === loserFigId);
      loserFig.pos = 'home';
      loserFig.stopActive = false;
      loserFig.rewindNext = false;
      loserFig.bombActive = null;

      const attackerWon = atkRoll > defRoll;
      const newState = { ...state, players: newPlayers, duelState: null };

      if (!attackerWon) {
        // Attacker lost — figure went home, no placement, no bonus roll
        return advanceTurn(newState);
      }

      // Attacker won — check special square on the duel cell (non-bridge first, then bridge)
      const spKey = `${duelState.ring}-${duelState.idx}`;
      if (newState.specialsOnBoard[spKey]) {
        const trigger = {
          type: newState.specialsOnBoard[spKey].type,
          ring: duelState.ring,
          idx: duelState.idx,
          figId: duelState.figId,
          playerColor: duelState.atkColor,
          placedBy: newState.specialsOnBoard[spKey].placedBy,
        };
        return applySpecialTrigger(newState, trigger);
      }

      return afterMove(newState, { type: 'move', ring: duelState.ring, idx: duelState.idx });
      // Note: bridge check happens inside afterMove → afterLanding is not called here,
      // but afterMove triggers bridge via the standard landing path.
    }

    case 'RESOLVE_MOST': {
      const { cross, trigger } = action;
      if (!cross) {
        return afterMove({ ...state, specialTrigger: null }, { type: 'move', ring: trigger.ring, idx: trigger.idx });
      }
      const dest = getBridgeParallel(trigger.ring, trigger.idx);
      if (!dest) {
        return afterMove({ ...state, specialTrigger: null }, { type: 'move', ring: trigger.ring, idx: trigger.idx });
      }

      let newPlayers = deepCopyPlayers(state.players);
      const mover = newPlayers.find(p => p.color === trigger.playerColor);
      const fig = mover.figures.find(f => f.id === trigger.figId);
      fig.pos = { ring: dest.ring, idx: dest.idx };

      const baseState = { ...state, specialTrigger: null, players: newPlayers };

      // Check for duel at destination, but skip special re-trigger —
      // the destination may be the bridge cell itself and would loop back.
      const occupied = findFigureOnCell(
        newPlayers.filter(p => p.color !== trigger.playerColor),
        dest.ring, dest.idx
      );
      if (occupied) {
        return {
          ...baseState,
          duelState: {
            atkColor: trigger.playerColor,
            defColor: occupied.player.color,
            ring: dest.ring,
            idx: dest.idx,
            figId: trigger.figId,
            defFigId: occupied.figure.id,
            atkRoll: null,
            defRoll: null,
          },
          phase: 'duel',
        };
      }

      // Trigger special on destination cell (skip bridge check to prevent infinite loop)
      const destKey = `${dest.ring}-${dest.idx}`;
      if (baseState.specialsOnBoard[destKey]) {
        return applySpecialTrigger(baseState, {
          type: baseState.specialsOnBoard[destKey].type,
          ring: dest.ring,
          idx: dest.idx,
          figId: trigger.figId,
          playerColor: trigger.playerColor,
          placedBy: baseState.specialsOnBoard[destKey].placedBy,
        });
      }

      return afterMove(baseState, { type: 'move', ring: dest.ring, idx: dest.idx });
    }

    case 'RESOLVE_KOCKA': {
      const { trigger, d1, d2 } = action;
      const total = d1 + d2;
      const player = state.players[state.currentPlayerIndex];
      const pd = playerDef(player.color);

      let newPlayers = deepCopyPlayers(state.players);
      const mover = newPlayers.find(p => p.color === trigger.playerColor);
      const fig = mover.figures.find(f => f.id === trigger.figId);
      const len = pathLen(trigger.ring);

      if (trigger.ring === 'inner') {
        const stepsToFinish = (pd.finishEntryIdx - trigger.idx + len) % len;
        if (total <= stepsToFinish) {
          fig.pos = { ring: trigger.ring, idx: advanceCW(trigger.idx, total, len) };
        } else {
          const slot = total - stepsToFinish;
          if (slot >= 1 && slot <= 4) {
            fig.pos = { lane: 'finish', color: player.color, slot };
          }
          // else overshoot — figure stays put
        }
      } else {
        fig.pos = { ring: trigger.ring, idx: advanceCW(trigger.idx, total, len) };
      }

      const newState = { ...state, players: newPlayers, specialTrigger: null, secondDiceValue: d1 * 10 + d2 };
      if (typeof fig.pos === 'object' && fig.pos.ring) {
        return afterLanding(newState, newPlayers, fig.pos.ring, fig.pos.idx, trigger.figId, trigger.playerColor);
      }
      // Landed in finish or stayed put — no collision possible
      return afterMove(newState, { type: 'move', ring: trigger.ring, idx: trigger.idx });
    }

    case 'DISMISS_SPECIAL_INFO': {
      const trigger = state.specialTrigger;
      return afterMove({ ...state, specialTrigger: null }, { type: 'move', ring: trigger.ring, idx: trigger.idx });
    }

    case 'RESOLVE_ZAMJENA': {
      const { trigger, targetColor, targetFigId } = action;
      let newPlayers = deepCopyPlayers(state.players);
      const mover = newPlayers.find(p => p.color === trigger.playerColor);
      const myFig = mover.figures.find(f => f.id === trigger.figId);
      const targetPlayer = newPlayers.find(p => p.color === targetColor);
      let swapped = false;
      if (targetPlayer) {
        const targetFig = targetPlayer.figures.find(f => f.id === targetFigId);
        if (targetFig && typeof targetFig.pos === 'object' && targetFig.pos.ring) {
          const oldPos = myFig.pos;
          myFig.pos = targetFig.pos;
          targetFig.pos = oldPos;
          // Both figures moved — clear their status flags
          myFig.stopActive = false;
          myFig.rewindNext = false;
          myFig.bombActive = null;
          targetFig.stopActive = false;
          targetFig.rewindNext = false;
          targetFig.bombActive = null;
          swapped = true;
        }
      }
      const baseState = { ...state, players: newPlayers, specialTrigger: null };
      // Check specials/collision at the active figure's new position
      if (swapped && typeof myFig.pos === 'object' && myFig.pos.ring) {
        return afterLanding(baseState, newPlayers, myFig.pos.ring, myFig.pos.idx, trigger.figId, trigger.playerColor);
      }
      return afterMove(baseState, { type: 'move', ring: trigger.ring, idx: trigger.idx });
    }

    case 'END_TURN': {
      return advanceTurn(state);
    }

    case 'PICKUP_SPECIAL': {
      // When player rolls 6 and picks up a special from a cell (rule 9d)
      const { ring, idx } = action;
      const spKey = `${ring}-${idx}`;
      const special = state.specialsOnBoard[spKey];
      if (!special) return state;
      const newSpecials = { ...state.specialsOnBoard };
      delete newSpecials[spKey];
      const currentColor = state.players[state.currentPlayerIndex].color;
      const newPlayers = deepCopyPlayers(state.players).map(p => {
        if (p.color === currentColor) p.specialsHeld = [...p.specialsHeld, special.type];
        return p;
      });
      return { ...state, players: newPlayers, specialsOnBoard: newSpecials, phase: 'rolling', diceValue: null, rollsLeft: 1 };
    }

    case 'INITIAL_ROLL': {
      const { initialRollOrder, initialRollIdx, initialRolls } = state;
      if (initialRollIdx >= initialRollOrder.length) return state;
      const color = initialRollOrder[initialRollIdx];
      const val = rollD6();
      const newRolls = { ...initialRolls, [color]: val };
      const nextIdx = initialRollIdx + 1;

      if (nextIdx < initialRollOrder.length) {
        return { ...state, initialRolls: newRolls, initialRollIdx: nextIdx };
      }

      // All players in this round have rolled
      const maxVal = Math.max(...Object.values(newRolls));
      const tied = initialRollOrder.filter(c => newRolls[c] === maxVal);

      if (tied.length === 1) {
        return { ...state, initialRolls: newRolls, initialRollIdx: nextIdx, initialRollWinner: tied[0] };
      }
      // Tie — show results then wait for user to continue
      return { ...state, initialRolls: newRolls, initialRollIdx: nextIdx, initialRollOrder: tied, initialRollTied: true };
    }

    case 'CONTINUE_AFTER_TIE': {
      return { ...state, initialRolls: {}, initialRollIdx: 0, initialRollTied: false };
    }

    case 'START_GAME': {
      const winnerIdx = state.players.findIndex(p => p.color === state.initialRollWinner);
      const winner = state.players[winnerIdx];
      return {
        ...state,
        phase: 'rolling',
        currentPlayerIndex: winnerIdx,
        rollsLeft: isAllStuck(winner) ? 3 : 1,
        initialRollWinner: null,
      };
    }

    case 'SYNC':
      return action.state;

    default:
      return state;
  }
}

export { reducer, initState };

export function useGame(setupPlayers) {
  const [state, dispatch] = useReducer(reducer, setupPlayers, initState);

  const rollDice = useCallback(() => dispatch({ type: 'ROLL_DICE' }), []);
  const selectMove = useCallback(move => dispatch({ type: 'SELECT_MOVE', move }), []);
  const skipPlaceSpecial = useCallback(() => dispatch({ type: 'SKIP_PLACE_SPECIAL' }), []);
  const placeSpecial = useCallback((ring, idx, specialType) =>
    dispatch({ type: 'PLACE_SPECIAL', ring, idx, specialType }), []);
  const resolveDuel = useCallback((atkRoll, defRoll) =>
    dispatch({ type: 'RESOLVE_DUEL', atkRoll, defRoll }), []);
  const resolveMost = useCallback((cross, trigger) =>
    dispatch({ type: 'RESOLVE_MOST', cross, trigger }), []);
  const resolveKocka = useCallback((trigger, d1, d2) =>
    dispatch({ type: 'RESOLVE_KOCKA', trigger, d1, d2 }), []);
  const resolveZamjena = useCallback((trigger, targetColor, targetFigId) =>
    dispatch({ type: 'RESOLVE_ZAMJENA', trigger, targetColor, targetFigId }), []);
  const dismissSpecialInfo = useCallback(() => dispatch({ type: 'DISMISS_SPECIAL_INFO' }), []);
  const endTurn = useCallback(() => dispatch({ type: 'END_TURN' }), []);
  const initialRoll = useCallback(() => dispatch({ type: 'INITIAL_ROLL' }), []);
  const continueAfterTie = useCallback(() => dispatch({ type: 'CONTINUE_AFTER_TIE' }), []);
  const startGame = useCallback(() => dispatch({ type: 'START_GAME' }), []);

  const validMoves = state.phase === 'moving'
    ? getValidMoves(state, state.diceValue)
    : [];

  const currentPlayer = state.players[state.currentPlayerIndex];

  return {
    state,
    currentPlayer,
    validMoves,
    rollDice,
    selectMove,
    skipPlaceSpecial,
    placeSpecial,
    resolveDuel,
    resolveMost,
    resolveKocka,
    resolveZamjena,
    dismissSpecialInfo,
    endTurn,
    initialRoll,
    continueAfterTie,
    startGame,
  };
}