import { useReducer, useCallback, useEffect, useRef } from 'react';
import { doc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { reducer, initState, getValidMoves } from './useGame';

export function useOnlineGame(setupPlayers, roomId, myUid) {
  const [state, dispatch] = useReducer(reducer, setupPlayers, initState);

  // Prevents write→snapshot→write loops
  const isWritingRef       = useRef(false);
  const lastRemoteStateRef = useRef(null);

  // Firestore → local: apply remote state when it changes
  useEffect(() => {
    if (!roomId) return;
    return onSnapshot(doc(db, 'rooms', roomId), (snap) => {
      if (!snap.exists()) return;
      const remote = snap.data().gameState;
      if (!remote) return;
      if (isWritingRef.current) return;
      const str = JSON.stringify(remote);
      if (str === lastRemoteStateRef.current) return;
      lastRemoteStateRef.current = str;
      dispatch({ type: 'SYNC', state: remote });
    });
  }, [roomId]);

  // Local → Firestore: write after each state change when it's my turn
  useEffect(() => {
    if (!roomId) return;
    const currentUid = state.players[state.currentPlayerIndex]?.uid;
    if (currentUid !== myUid) return;
    if (isWritingRef.current) return;
    const str = JSON.stringify(state);
    if (str === lastRemoteStateRef.current) return;
    isWritingRef.current = true;
    updateDoc(doc(db, 'rooms', roomId), {
      gameState: state,
      updatedAt: serverTimestamp(),
    }).finally(() => {
      isWritingRef.current = false;
      lastRemoteStateRef.current = str;
    });
  }, [state, roomId, myUid]);

  const rollDice           = useCallback(() => dispatch({ type: 'ROLL_DICE' }), []);
  const selectMove         = useCallback(move => dispatch({ type: 'SELECT_MOVE', move }), []);
  const skipPlaceSpecial   = useCallback(() => dispatch({ type: 'SKIP_PLACE_SPECIAL' }), []);
  const placeSpecial       = useCallback((ring, idx, specialType) =>
    dispatch({ type: 'PLACE_SPECIAL', ring, idx, specialType }), []);
  const resolveDuel        = useCallback((atkRoll, defRoll) =>
    dispatch({ type: 'RESOLVE_DUEL', atkRoll, defRoll }), []);
  const resolveMost        = useCallback((cross, trigger) =>
    dispatch({ type: 'RESOLVE_MOST', cross, trigger }), []);
  const resolveKocka       = useCallback((trigger, d1, d2) =>
    dispatch({ type: 'RESOLVE_KOCKA', trigger, d1, d2 }), []);
  const resolveZamjena     = useCallback((trigger, targetColor, targetFigId) =>
    dispatch({ type: 'RESOLVE_ZAMJENA', trigger, targetColor, targetFigId }), []);
  const dismissSpecialInfo = useCallback(() => dispatch({ type: 'DISMISS_SPECIAL_INFO' }), []);
  const endTurn            = useCallback(() => dispatch({ type: 'END_TURN' }), []);
  const initialRoll        = useCallback(() => dispatch({ type: 'INITIAL_ROLL' }), []);
  const continueAfterTie   = useCallback(() => dispatch({ type: 'CONTINUE_AFTER_TIE' }), []);
  const startGame          = useCallback(() => dispatch({ type: 'START_GAME' }), []);

  const validMoves    = state.phase === 'moving' ? getValidMoves(state, state.diceValue) : [];
  const currentPlayer = state.players[state.currentPlayerIndex];

  return {
    state, currentPlayer, validMoves,
    rollDice, selectMove, skipPlaceSpecial, placeSpecial,
    resolveDuel, resolveMost, resolveKocka, resolveZamjena,
    dismissSpecialInfo, endTurn, initialRoll, continueAfterTie, startGame,
  };
}