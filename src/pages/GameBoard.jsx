import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { useGame } from '../hooks/useGame.js';
import Board from '../components/Board/Board.jsx';
import Dice from '../components/Dice.jsx';
import PlayerPanel from '../components/PlayerPanel.jsx';
import Modal from '../components/Modal.jsx';
import { canPlaceSpecial } from '../data/boardLayout.js';
import './GameBoard.css';

const COLOR_HEX = {
  red: '#e53935', yellow: '#fdd835', blue: '#1e88e5', green: '#43a047',
  cyan: '#00838f', purple: '#8e24aa', magenta: '#f06292', orange: '#fb8c00',
};

function loadSetup() {
  try {
    const raw = sessionStorage.getItem('gameSetup');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export default function GameBoard() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { theme, toggleTheme } = useTheme();

  const setup = loadSetup();
  useEffect(() => {
    if (!setup) navigate('/setup');
  }, []);

  const { state, currentPlayer, validMoves, rollDice, selectMove,
    skipPlaceSpecial, placeSpecial, resolveDuel, resolveMost, resolveKocka, resolveZamjena,
    endTurn, initialRoll, continueAfterTie, startGame,
  } = useGame(setup?.players || []);

  const [selectedSpecialType, setSelectedSpecialType] = useState(null);
  const [duelRolls, setDuelRolls] = useState({ atk: null, def: null });

  // Derived
  const phase = state.phase;
  const isInitialRoll = phase === 'initial-roll';
  const isRolling = phase === 'rolling';
  const isMoving = phase === 'moving';
  const isPlacing = phase === 'placing-special';
  const isDuel = phase === 'duel';
  const isSpecial = phase === 'special-trigger';
  const isOver = phase === 'game-over';
  const isNoMoves = phase === 'no-moves';

  // Auto-advance after showing the dice result when there are no valid moves
  useEffect(() => {
    if (!isNoMoves) return;
    const timer = setTimeout(endTurn, 1500);
    return () => clearTimeout(timer);
  }, [isNoMoves, endTurn]);

  const moveableFigures = isMoving
    ? validMoves.map(m => ({ figId: m.figId, playerColor: currentPlayer.color }))
    : [];

  const validTargets = isMoving
    ? validMoves.map(m => {
        if (m.type === 'move' || m.type === 'exit') return { ring: m.ring, idx: m.idx };
        if (m.type === 'finish') return { lane: m.lane, color: m.color, slot: m.slot };
        return null;
      }).filter(Boolean)
    : isPlacing && state.lastMoveRing
      ? [{ ring: state.lastMoveRing, idx: state.lastMoveIdx }]
      : [];

  function handleFigureClick(playerColor, figId) {
    if (!isMoving) return;
    if (playerColor !== currentPlayer.color) return;
    // If multiple moves for this figure, pick first (or handle multi-move selection)
    const move = validMoves.find(m => m.figId === figId);
    if (!move) return;
    // If exit move, need ring choice
    if (move.type === 'exit') {
      const allExitMoves = validMoves.filter(m => m.figId === figId && m.type === 'exit');
      if (allExitMoves.length > 1) {
        // Will be shown via modal below — just set state
        setExitChoiceFig({ figId, playerColor, moves: allExitMoves });
      } else {
        selectMove(move);
      }
    } else {
      selectMove(move);
    }
  }

  const [exitChoiceFig, setExitChoiceFig] = useState(null);

  function handleCellClick({ cell }) {
    // Tap a target cell to select move
    if (isMoving) {
      if (cell.type === 'outer-path') {
        const move = validMoves.find(m => m.ring === 'outer' && m.idx === cell.outerIdx);
        if (move) selectMove(move);
      } else if (cell.type === 'inner-path') {
        const move = validMoves.find(m => m.ring === 'inner' && m.idx === cell.innerIdx);
        if (move) selectMove(move);
      } else if (cell.type === 'finish') {
        const move = validMoves.find(m => m.lane === 'finish' && m.color === cell.color && m.slot === cell.slot);
        if (move) selectMove(move);
      }
    }

    // Tap to place special — only allowed on the exact cell just landed on
    if (isPlacing && selectedSpecialType) {
      const { lastMoveRing, lastMoveIdx } = state;
      if (cell.type === 'outer-path' && lastMoveRing === 'outer' && cell.outerIdx === lastMoveIdx) {
        placeSpecial('outer', lastMoveIdx, selectedSpecialType);
        setSelectedSpecialType(null);
      } else if (cell.type === 'inner-path' && lastMoveRing === 'inner' && cell.innerIdx === lastMoveIdx) {
        placeSpecial('inner', lastMoveIdx, selectedSpecialType);
        setSelectedSpecialType(null);
      }
    }
  }

  function handleDuelRoll(who) {
    const val = Math.floor(Math.random() * 6) + 1;
    const newRolls = who === 'atk'
      ? { ...duelRolls, atk: val }
      : { ...duelRolls, def: val };
    setDuelRolls(newRolls);

    if (newRolls.atk !== null && newRolls.def !== null) {
      setTimeout(() => {
        resolveDuel(newRolls.atk, newRolls.def);
        setDuelRolls({ atk: null, def: null });
      }, 1500);
    }
  }

  if (!setup) return null;

  return (
    <div className="gameboard-page page">
      {/* Top bar */}
      <div className="game-topbar">
        <button className="btn btn-ghost" onClick={() => navigate('/')} style={{ fontSize: '0.85rem' }}>
          ✕
        </button>
        <span className="game-turn-label" style={{ color: COLOR_HEX[currentPlayer.color] }}>
          {currentPlayer.name}
          {phase === 'rolling' && ' — 🎲'}
          {phase === 'moving' && ' — potez'}
          {phase === 'placing-special' && ' — postavi'}
          {phase === 'duel' && ' — dvoboj!'}
        </span>
        <button className="btn btn-ghost" onClick={toggleTheme} style={{ fontSize: '1.1rem' }}>
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </div>

      {/* Board */}
      <div className="game-board-area">
        <Board
          gamePlayers={state.players}
          specialsOnBoard={state.specialsOnBoard}
          moveableFigures={moveableFigures}
          validTargets={validTargets}
          onFigureClick={handleFigureClick}
          onCellClick={handleCellClick}
          currentPlayerColor={currentPlayer.color}
        />
      </div>

      {/* Bottom panel */}
      <div className="game-bottom">
        <PlayerPanel
          players={state.players}
          currentPlayerIndex={state.currentPlayerIndex}
          phase={phase}
          diceValue={state.diceValue}
          onSelectSpecialForPlace={type => setSelectedSpecialType(type === selectedSpecialType ? null : type)}
          selectedSpecial={selectedSpecialType}
          t={t}
        />
        <div className="game-controls">
          <Dice
            value={state.diceValue}
            onRoll={rollDice}
            disabled={!isRolling}
            rollsLeft={state.rollsLeft}
          />
          {isPlacing && (
            <button className="btn btn-ghost" onClick={() => { setSelectedSpecialType(null); skipPlaceSpecial(); }}>
              {t('gameSkip')}
            </button>
          )}
          {isMoving && validMoves.length === 0 && (
            <button className="btn btn-secondary" onClick={skipPlaceSpecial}>
              {t('gameNoMoves')} →
            </button>
          )}
        </div>
      </div>

      {/* Exit choice modal */}
      {exitChoiceFig && (
        <Modal title={t('gameChooseExit')} onClose={() => setExitChoiceFig(null)}>
          {exitChoiceFig.moves.map(m => (
            <button
              key={m.ring}
              className="btn btn-secondary"
              onClick={() => { selectMove(m); setExitChoiceFig(null); }}
            >
              {m.ring === 'outer' ? t('gameOuterRing') : t('gameInnerRing')}
            </button>
          ))}
        </Modal>
      )}

      {/* Duel modal */}
      {isDuel && state.duelState && (
        <Modal title={t('duelTitle')}>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            <span style={{ color: COLOR_HEX[state.duelState.atkColor] }}>●</span> vs{' '}
            <span style={{ color: COLOR_HEX[state.duelState.defColor] }}>●</span>
          </p>
          {duelRolls.atk === null && (
            <button
              className="btn btn-primary"
              onClick={() => handleDuelRoll('atk')}
            >
              🎲 {state.players.find(p => p.color === state.duelState.atkColor)?.name} {t('duelRoll')}
            </button>
          )}
          {duelRolls.atk !== null && (
            <p>Napadač: <strong>{duelRolls.atk}</strong></p>
          )}
          {duelRolls.atk !== null && duelRolls.def === null && (
            <button
              className="btn btn-secondary"
              onClick={() => handleDuelRoll('def')}
            >
              🎲 {state.players.find(p => p.color === state.duelState.defColor)?.name} {t('duelRoll')}
            </button>
          )}
          {duelRolls.def !== null && (
            <p>Branič: <strong>{duelRolls.def}</strong></p>
          )}
        </Modal>
      )}

      {/* Special trigger modal */}
      {isSpecial && state.specialTrigger && (
        <SpecialModal
          trigger={state.specialTrigger}
          players={state.players}
          t={t}
          onMost={cross => resolveMost(cross, state.specialTrigger)}
          onKocka={() => resolveKocka(state.specialTrigger)}
          onZamjena={(tc, tf) => resolveZamjena(state.specialTrigger, tc, tf)}
        />
      )}

      {/* Initial roll modal — rule 2 */}
      {isInitialRoll && (
        <InitialRollModal
          state={state}
          players={state.players}
          onRoll={initialRoll}
          onContinue={continueAfterTie}
          onStart={startGame}
        />
      )}

      {/* Win modal */}
      {isOver && state.winner && (
        <Modal title={t('gameWin')}>
          <p style={{ textAlign: 'center', fontSize: '2rem' }}>🏆</p>
          <p style={{ textAlign: 'center' }}>
            <strong style={{ color: COLOR_HEX[state.winner] }}>
              {state.players.find(p => p.color === state.winner)?.name}
            </strong>{' '}
            {t('gameWinMsg')}
          </p>
          <button className="btn btn-primary" onClick={() => navigate('/setup')}>
            {t('gamePlayAgain')}
          </button>
          <button className="btn btn-secondary" onClick={() => navigate('/')}>
            {t('gameMainMenu')}
          </button>
        </Modal>
      )}
    </div>
  );
}

function SpecialModal({ trigger, players, t, onMost, onKocka, onZamjena }) {
  const COLOR_HEX = {
    red: '#e53935', yellow: '#fdd835', blue: '#1e88e5', green: '#43a047',
    cyan: '#00838f', purple: '#8e24aa', magenta: '#f06292', orange: '#fb8c00',
  };

  if (trigger.type === 'most') {
    return (
      <Modal title={`🌉 ${t('specialMost')}`}>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{t('specialMostQ')}</p>
        <button className="btn btn-secondary" onClick={() => onMost(false)}>{t('specialMostStay')}</button>
        <button className="btn btn-primary" onClick={() => onMost(true)}>{t('specialMostCross')}</button>
      </Modal>
    );
  }

  if (trigger.type === 'kocka') {
    return (
      <Modal title={`🎲 ${t('specialKocka')}`}>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{t('specialKockaMsg')}</p>
        <button className="btn btn-primary" onClick={onKocka}>🎲🎲 {t('gameRoll')}</button>
      </Modal>
    );
  }

  if (trigger.type === 'zamjena') {
    const eligibleFigs = [];
    const placer = players.find(p => p.color === trigger.placedBy);
    if (placer) {
      placer.figures.forEach(f => {
        if (typeof f.pos === 'object' && f.pos.ring) {
          eligibleFigs.push({ ...f, playerColor: placer.color });
        }
      });
    }
    return (
      <Modal title={`🔄 ${t('specialZamjena')}`}>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{t('specialZamjenaTitle')}</p>
        {eligibleFigs.length === 0 && (
          <p style={{ color: 'var(--text-muted)' }}>Nema slobodnih figurica za zamjenu.</p>
        )}
        {eligibleFigs.map(f => (
          <button
            key={f.id}
            className="btn btn-secondary"
            style={{ borderLeft: `4px solid ${COLOR_HEX[f.playerColor]}` }}
            onClick={() => onZamjena(f.playerColor, f.id)}
          >
            Figurica {f.id + 1}
          </button>
        ))}
        <button className="btn btn-ghost" onClick={() => onZamjena(null, null)}>Preskoči</button>
      </Modal>
    );
  }

  return null;
}

function InitialRollModal({ state, players, onRoll, onContinue, onStart }) {
  const COLOR_HEX = {
    red: '#e53935', yellow: '#fdd835', blue: '#1e88e5', green: '#43a047',
    cyan: '#00838f', purple: '#8e24aa', magenta: '#f06292', orange: '#fb8c00',
  };

  const { initialRollOrder, initialRolls, initialRollIdx, initialRollWinner, initialRollTied } = state;
  const allRolled = initialRollIdx >= initialRollOrder.length;
  const isReroll = initialRollOrder.length < players.length;
  const currentColor = !allRolled ? initialRollOrder[initialRollIdx] : null;
  const currentPlayer = currentColor ? players.find(p => p.color === currentColor) : null;
  const winner = initialRollWinner ? players.find(p => p.color === initialRollWinner) : null;

  return (
    <Modal title="🎲 Tko ide prvi?">
      {isReroll && (
        <p style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
          Izjednačeno — isti igrači bacaju opet!
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
        {initialRollOrder.map(color => {
          const player = players.find(p => p.color === color);
          const roll = initialRolls[color];
          const isCurrent = color === currentColor;
          const isMax = allRolled && roll === Math.max(...Object.values(initialRolls));
          return (
            <div
              key={color}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 14px',
                background: 'var(--bg-secondary)',
                borderRadius: '8px',
                border: `2px solid ${isCurrent ? COLOR_HEX[color] : isMax ? COLOR_HEX[color] : 'transparent'}`,
                opacity: isCurrent || !allRolled || isMax ? 1 : 0.5,
              }}
            >
              <span style={{ color: COLOR_HEX[color], fontWeight: 700 }}>● {player?.name}</span>
              <span style={{ fontSize: '1.5rem', fontWeight: 900, color: isMax ? COLOR_HEX[color] : 'var(--text-primary)' }}>
                {roll !== undefined ? roll : isCurrent ? '?' : '—'}
              </span>
            </div>
          );
        })}
      </div>

      {winner && (
        <>
          <p style={{ textAlign: 'center', fontWeight: 700, fontSize: '1rem', marginTop: '4px' }}>
            <span style={{ color: COLOR_HEX[initialRollWinner] }}>{winner.name}</span> počinje!
          </p>
          <button className="btn btn-primary" style={{ width: '100%' }} onClick={onStart}>
            🎮 Započni igru!
          </button>
        </>
      )}

      {initialRollTied && !winner && (
        <button className="btn btn-secondary" style={{ width: '100%' }} onClick={onContinue}>
          🎲 Baci opet
        </button>
      )}

      {!allRolled && (
        <button className="btn btn-primary" style={{ width: '100%' }} onClick={onRoll}>
          🎲 {currentPlayer?.name} baci!
        </button>
      )}
    </Modal>
  );
}