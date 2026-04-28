import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { useGame, getValidMoves } from '../hooks/useGame.js';
import Board from '../components/Board/Board.jsx';
import Dice from '../components/Dice.jsx';
import PlayerPanel from '../components/PlayerPanel.jsx';
import Modal from '../components/Modal.jsx';
import { PLAYERS, canPlaceSpecial, INNER_PATH, OUTER_PATH } from '../data/boardLayout.js';
import './GameBoard.css';

const COLOR_HEX = {
  red: '#e53935', yellow: '#fdd835', blue: '#1e88e5', green: '#43a047',
  cyan: '#00acc1', purple: '#8e24aa', magenta: '#d81b60', orange: '#fb8c00',
};

const SPECIAL_ICONS = {
  most: '🌉', kocka: '🎲', rewind: '⏪', bomba: '💣', stop: '🛑', zamjena: '🔄',
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
    skipPlaceSpecial, placeSpecial, resolveDuel, resolveMost, resolveKocka, resolveZamjena
  } = useGame(setup?.players || []);

  const [selectedSpecialType, setSelectedSpecialType] = useState(null);
  const [duelRolls, setDuelRolls] = useState({ atk: null, def: null });

  // Derived
  const phase = state.phase;
  const isRolling = phase === 'rolling';
  const isMoving = phase === 'moving';
  const isPlacing = phase === 'placing-special';
  const isDuel = phase === 'duel';
  const isSpecial = phase === 'special-trigger';
  const isOver = phase === 'game-over';

  const moveableFigures = isMoving
    ? validMoves.map(m => ({ figId: m.figId, playerColor: currentPlayer.color }))
    : [];

  const validTargets = isMoving ? validMoves.map(m => {
    if (m.type === 'move' || m.type === 'exit') return { ring: m.ring, idx: m.idx };
    if (m.type === 'finish') return { lane: m.lane, color: m.color, slot: m.slot };
    return null;
  }).filter(Boolean) : [];

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

  function handleCellClick({ r, c, cell }) {
    // Tap a target cell to select move
    if (isMoving) {
      if (cell.type === 'outer-path') {
        const move = validMoves.find(m => m.ring === 'outer' && m.idx === cell.outerIdx);
        if (move) selectMove(move);
      } else if (cell.type === 'inner-path') {
        const move = validMoves.find(m => m.ring === 'inner' && m.idx === cell.innerIdx);
        if (move) selectMove(move);
      } else if (cell.type === 'inner-finish' || cell.type === 'outer-finish') {
        const lane = cell.type === 'inner-finish' ? 'inner' : 'outer';
        const move = validMoves.find(m => m.lane === lane && m.color === cell.color && m.slot === cell.slot);
        if (move) selectMove(move);
      }
    }

    // Tap to place special
    if (isPlacing && selectedSpecialType) {
      if (cell.type === 'outer-path') {
        if (canPlaceSpecial('outer', cell.outerIdx, currentPlayer.color)) {
          placeSpecial('outer', cell.outerIdx, selectedSpecialType);
          setSelectedSpecialType(null);
        }
      } else if (cell.type === 'inner-path') {
        if (canPlaceSpecial('inner', cell.innerIdx, currentPlayer.color)) {
          placeSpecial('inner', cell.innerIdx, selectedSpecialType);
          setSelectedSpecialType(null);
        }
      }
    }
  }

  function handleDuelRoll(who) {
    const val = Math.floor(Math.random() * 6) + 1;
    if (who === 'atk') {
      const newRolls = { ...duelRolls, atk: val };
      setDuelRolls(newRolls);
      if (newRolls.def !== null) {
        resolveDuel(newRolls.atk, newRolls.def);
        setDuelRolls({ atk: null, def: null });
      }
    } else {
      const newRolls = { ...duelRolls, def: val };
      setDuelRolls(newRolls);
      if (newRolls.atk !== null) {
        resolveDuel(newRolls.atk, newRolls.def);
        setDuelRolls({ atk: null, def: null });
      }
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
    cyan: '#00acc1', purple: '#8e24aa', magenta: '#d81b60', orange: '#fb8c00',
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