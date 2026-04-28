import { useReducer, useCallback } from 'react';
import {
  OUTER_PATH, INNER_PATH, PLAYERS,
  advanceCW, advanceCCW,
  distributeSpecials, canPlaceSpecial,
} from '../data/boardLayout.js';

const OUTER_LEN = OUTER_PATH.length; // 72
const INNER_LEN = INNER_PATH.length; // 48

function rollD6() {
  return Math.floor(Math.random() * 6) + 1;
}

function initFigures() {
  return [
    { id: 0, pos: 'home', rewindNext: false, stopActive: false },
    { id: 1, pos: 'home', rewindNext: false, stopActive: false },
    { id: 2, pos: 'home', rewindNext: false, stopActive: false },
    { id: 3, pos: 'home', rewindNext: false, stopActive: false },
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
    phase: 'rolling', // rolling | choosing-exit | moving | placing-special | duel | special-trigger | game-over
    specialsOnBoard: {}, // key: "ring-idx" → { type, placedBy }
    duelState: null,     // { atkColor, defColor, pos, atkRoll, defRoll }
    specialTrigger: null,// { type, ring, idx, figId, playerColor }
    exitChoice: null,    // { figId, playerColor } — waiting for ring choice
    winner: null,
    log: [],
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
  // All figures in HOME, OR consecutively in finish from slot 4 downward
  const figs = player.figures;
  const atHome = figs.filter(f => f.pos === 'home').length;
  if (atHome === 4) return true;
  // Check if remaining figures are in finish slots 4,3,2,...
  const finishFigs = figs.filter(f => typeof f.pos === 'object' && (f.pos.lane === 'inner' || f.pos.lane === 'outer'));
  const pathFigs = figs.filter(f => typeof f.pos === 'object' && f.pos.ring);
  if (pathFigs.length > 0) return false;
  // All non-home figures are in finish
  const slots = finishFigs.map(f => f.pos.slot).sort((a, b) => b - a);
  // Must be consecutive from 4 downward
  for (let i = 0; i < slots.length; i++) {
    if (slots[i] !== 4 - i) return false;
  }
  return true;
}

function isWinner(player) {
  return player.figures.every(f =>
    typeof f.pos === 'object' && (f.pos.lane === 'inner' || f.pos.lane === 'outer')
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
        if (!findFigureOnCell(state.players, 'outer', pd.exitOuter)) {
          moves.push({ figId: fig.id, type: 'exit', ring: 'outer', idx: pd.exitOuter });
        }
        if (!findFigureOnCell(state.players, 'inner', pd.exitInner)) {
          moves.push({ figId: fig.id, type: 'exit', ring: 'inner', idx: pd.exitInner });
        }
      }
      return;
    }

    if (typeof fig.pos === 'object' && fig.pos.ring) {
      const { ring, idx } = fig.pos;
      const len = pathLen(ring);
      const pd = playerDef(player.color);
      const finishEntryIdx = ring === 'outer' ? pd.outerFinishEntryIdx : pd.innerFinishEntryIdx;
      const stepsToFinish = (finishEntryIdx - idx + len) % len;

      if (fig.rewindNext) {
        // REWIND: move backward
        const targetIdx = advanceCCW(idx, diceVal, len);
        if (!findFigureOnCell(state.players, ring, targetIdx)) {
          // Can't enter finish going backward
          moves.push({ figId: fig.id, type: 'move', ring, idx: targetIdx, rewind: true });
        }
        return;
      }

      if (diceVal <= stepsToFinish) {
        // Stay on path
        const targetIdx = advanceCW(idx, diceVal, len);
        const occupant = findFigureOnCell(state.players, ring, targetIdx);
        if (!occupant || occupant.player.color !== player.color) {
          moves.push({ figId: fig.id, type: 'move', ring, idx: targetIdx });
        }
      } else if (diceVal === stepsToFinish + 1) {
        // Enter finish slot 1 (closest to path)
        if (!findFigureInFinish(state.players, player.color, ring, 1)) {
          moves.push({ figId: fig.id, type: 'finish', lane: ring, color: player.color, slot: 1 });
        }
      } else {
        // Overshoot — move normally but stop before finish entry
        // (figure stays if can't complete move — no move available)
      }
      return;
    }

    if (typeof fig.pos === 'object' && fig.pos.lane) {
      // In finish lane — advance deeper
      const { lane, color, slot } = fig.pos;
      const nextSlot = slot + 1;
      if (nextSlot <= 4 && diceVal === 1) {
        if (!findFigureInFinish(state.players, color, lane, nextSlot)) {
          moves.push({ figId: fig.id, type: 'finish', lane, color, slot: nextSlot });
        }
      }
    }
  });

  return moves;
}

// ── Reducer ────────────────────────────────────────────────────────────────

function addLog(state, msg) {
  return { ...state, log: [msg, ...state.log.slice(0, 19)] };
}

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

function applyMove(state, move) {
  const player = state.players[state.currentPlayerIndex];
  let newPlayers = state.players.map(p => ({ ...p, figures: p.figures.map(f => ({ ...f })) }));
  const mover = newPlayers.find(p => p.color === player.color);
  const fig = mover.figures.find(f => f.id === move.figId);

  // Clear rewind/stop flags on move
  fig.rewindNext = false;
  fig.stopActive = false;

  if (move.type === 'exit') {
    fig.pos = { ring: move.ring, idx: move.idx };
  } else if (move.type === 'move') {
    fig.pos = { ring: move.ring, idx: move.idx };
    if (move.rewind) fig.rewindNext = false; // already moved backward, flag consumed
  } else if (move.type === 'finish') {
    fig.pos = { lane: move.lane, color: move.color, slot: move.slot };
  }

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

    // Check special square
    const spKey = `${ring}-${idx}`;
    if (!duelState && state.specialsOnBoard[spKey]) {
      specialTrigger = {
        type: state.specialsOnBoard[spKey].type,
        ring,
        idx,
        figId: move.figId,
        playerColor: player.color,
        placedBy: state.specialsOnBoard[spKey].placedBy,
      };
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
  // Check if player can place a special
  const hasSpecials = player.specialsHeld.length > 0;
  const validPlacement = hasSpecials && (move.type === 'move' || move.type === 'exit') &&
    canPlaceSpecial(move.ring, move.idx, player.color);

  if (validPlacement) {
    return { ...state, phase: 'placing-special', lastMoveRing: move.ring, lastMoveIdx: move.idx };
  }

  // Bonus roll if dice was 6
  if (state.bonusRoll) {
    return { ...state, phase: 'rolling', diceValue: null, bonusRoll: false, rollsLeft: 1 };
  }

  return advanceTurn(state);
}

function applySpecialTrigger(state, trigger) {
  const { type, ring, idx, figId, playerColor, placedBy } = trigger;
  let newPlayers = state.players.map(p => ({ ...p, figures: p.figures.map(f => ({ ...f })) }));
  let newSpecials = { ...state.specialsOnBoard };
  const spKey = `${ring}-${idx}`;

  if (type === 'bomba') {
    // Figure goes home; bomb returns to placer's hand
    const mover = newPlayers.find(p => p.color === playerColor);
    const fig = mover.figures.find(f => f.id === figId);
    fig.pos = 'home';
    delete newSpecials[spKey];
    const placer = newPlayers.find(p => p.color === placedBy);
    if (placer) placer.specialsHeld.push('bomba');
    return advanceTurn({
      ...state,
      players: newPlayers,
      specialsOnBoard: newSpecials,
    });
  }

  if (type === 'stop') {
    const mover = newPlayers.find(p => p.color === playerColor);
    const fig = mover.figures.find(f => f.id === figId);
    fig.stopActive = true;
    return afterMove({ ...state, players: newPlayers }, { type: 'move', ring, idx });
  }

  if (type === 'rewind') {
    const mover = newPlayers.find(p => p.color === playerColor);
    const fig = mover.figures.find(f => f.id === figId);
    fig.rewindNext = true;
    return afterMove({ ...state, players: newPlayers }, { type: 'move', ring, idx });
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
            return { ...state, diceValue: val, rollsLeft: newRollsLeft, phase: 'moving', bonusRoll: false };
          }
          if (newRollsLeft <= 0) {
            return advanceTurn({ ...state, diceValue: val, rollsLeft: 0 });
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
        return addLog(advanceTurn({ ...state, diceValue: val, bonusRoll: false }), 'Nema poteza, sljedeći igrač.');
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
      const newPlayers = state.players.map(p => {
        if (p.color === player.color) {
          const idx2 = p.specialsHeld.indexOf(specialType);
          const newHeld = [...p.specialsHeld];
          if (idx2 !== -1) newHeld.splice(idx2, 1);
          return { ...p, specialsHeld: newHeld };
        }
        return p;
      });
      const spKey = `${ring}-${idx}`;
      const newSpecials = { ...state.specialsOnBoard, [spKey]: { type: specialType, placedBy: player.color } };

      // Check if figure on this cell is immediately affected (rule 9c)
      const figHere = findFigureOnCell(newPlayers, ring, idx);
      let nextState = { ...state, players: newPlayers, specialsOnBoard: newSpecials, phase: 'moving' };

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

      let newPlayers = state.players.map(p => ({ ...p, figures: p.figures.map(f => ({ ...f })) }));
      const loserColor = atkRoll > defRoll ? duelState.defColor : duelState.atkColor;
      const loserFigId = atkRoll > defRoll ? duelState.defFigId : duelState.figId;

      const loserPlayer = newPlayers.find(p => p.color === loserColor);
      const loserFig = loserPlayer.figures.find(f => f.id === loserFigId);
      loserFig.pos = 'home';

      const newState = { ...state, players: newPlayers, duelState: null };

      // Check special square
      const spKey = `${duelState.ring}-${duelState.idx}`;
      if (newState.specialsOnBoard[spKey] && loserColor !== state.players[state.currentPlayerIndex].color) {
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
    }

    case 'RESOLVE_MOST': {
      const { cross, trigger } = action;
      if (!cross) {
        return afterMove({ ...state, specialTrigger: null }, { type: 'move', ring: trigger.ring, idx: trigger.idx });
      }
      // Find the MOST pair and jump to parallel ring
      const pd = playerDef(state.players[state.currentPlayerIndex].color);
      const pair = pd.mostPairs.find(p =>
        (p.outerIdx === trigger.idx && trigger.ring === 'outer') ||
        (p.innerIdx === trigger.idx && trigger.ring === 'inner')
      );
      if (!pair) {
        return afterMove({ ...state, specialTrigger: null }, { type: 'move', ring: trigger.ring, idx: trigger.idx });
      }
      const destRing = trigger.ring === 'outer' ? 'inner' : 'outer';
      const destIdx = trigger.ring === 'outer' ? pair.innerIdx : pair.outerIdx;

      let newPlayers = state.players.map(p => ({ ...p, figures: p.figures.map(f => ({ ...f })) }));
      const mover = newPlayers.find(p => p.color === trigger.playerColor);
      const fig = mover.figures.find(f => f.id === trigger.figId);
      fig.pos = { ring: destRing, idx: destIdx };

      return afterMove({ ...state, players: newPlayers, specialTrigger: null }, { type: 'move', ring: destRing, idx: destIdx });
    }

    case 'RESOLVE_KOCKA': {
      const { trigger } = action;
      const d1 = rollD6();
      const d2 = rollD6();
      const total = d1 + d2;
      const player = state.players[state.currentPlayerIndex];
      const pd = playerDef(player.color);

      let newPlayers = state.players.map(p => ({ ...p, figures: p.figures.map(f => ({ ...f })) }));
      const mover = newPlayers.find(p => p.color === trigger.playerColor);
      const fig = mover.figures.find(f => f.id === trigger.figId);
      const len = pathLen(trigger.ring);
      const finishEntry = trigger.ring === 'outer' ? pd.outerFinishEntryIdx : pd.innerFinishEntryIdx;
      const stepsToFinish = (finishEntry - trigger.idx + len) % len;

      if (total <= stepsToFinish) {
        fig.pos = { ring: trigger.ring, idx: advanceCW(trigger.idx, total, len) };
      } else if (total === stepsToFinish + 1) {
        fig.pos = { lane: trigger.ring, color: player.color, slot: 1 };
      }

      return afterMove({
        ...state, players: newPlayers, specialTrigger: null,
        secondDiceValue: d1 * 10 + d2,
      }, { type: 'move', ring: trigger.ring, idx: fig.pos.idx ?? trigger.idx });
    }

    case 'RESOLVE_ZAMJENA': {
      const { trigger, targetColor, targetFigId } = action;
      let newPlayers = state.players.map(p => ({ ...p, figures: p.figures.map(f => ({ ...f })) }));
      const mover = newPlayers.find(p => p.color === trigger.playerColor);
      const myFig = mover.figures.find(f => f.id === trigger.figId);
      const targetPlayer = newPlayers.find(p => p.color === targetColor);
      if (targetPlayer) {
        const targetFig = targetPlayer.figures.find(f => f.id === targetFigId);
        if (targetFig && typeof targetFig.pos === 'object' && targetFig.pos.ring) {
          const oldPos = myFig.pos;
          myFig.pos = targetFig.pos;
          targetFig.pos = oldPos;
        }
      }
      return afterMove({ ...state, players: newPlayers, specialTrigger: null },
        { type: 'move', ring: trigger.ring, idx: trigger.idx });
    }

    case 'PICKUP_SPECIAL': {
      // When player rolls 6 and picks up a special from a cell (rule 9d)
      const { ring, idx } = action;
      const spKey = `${ring}-${idx}`;
      const special = state.specialsOnBoard[spKey];
      if (!special) return state;
      const newSpecials = { ...state.specialsOnBoard };
      delete newSpecials[spKey];
      const newPlayers = state.players.map(p => {
        if (p.color === state.players[state.currentPlayerIndex].color) {
          return { ...p, specialsHeld: [...p.specialsHeld, special.type] };
        }
        return p;
      });
      return { ...state, players: newPlayers, specialsOnBoard: newSpecials, phase: 'rolling', diceValue: null, rollsLeft: 1 };
    }

    default:
      return state;
  }
}

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
  const resolveKocka = useCallback(trigger =>
    dispatch({ type: 'RESOLVE_KOCKA', trigger }), []);
  const resolveZamjena = useCallback((trigger, targetColor, targetFigId) =>
    dispatch({ type: 'RESOLVE_ZAMJENA', trigger, targetColor, targetFigId }), []);

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
  };
}