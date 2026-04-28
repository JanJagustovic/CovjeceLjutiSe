import { GRID, OUTER_PATH, INNER_PATH, PLAYERS } from '../../data/boardLayout.js';
import './Board.css';

const SPECIAL_ICONS = {
  most:    '🌉',
  kocka:   '🎲',
  rewind:  '⏪',
  bomba:   '💣',
  stop:    '🛑',
  zamjena: '🔄',
};

const COLOR_HEX = {
  red: '#e53935', yellow: '#fdd835', blue: '#1e88e5', green: '#43a047',
  cyan: '#00acc1', purple: '#8e24aa', magenta: '#d81b60', orange: '#fb8c00',
};

function getFiguresOnCell(figures, ring, idx, allPlayers) {
  const result = [];
  allPlayers.forEach(player => {
    player.figures.forEach(fig => {
      if (typeof fig.pos === 'object' && fig.pos.ring === ring && fig.pos.idx === idx) {
        result.push({ ...fig, playerColor: player.color });
      }
    });
  });
  return result;
}

function getFiguresOnFinish(allPlayers, colorKey, lane, slot) {
  const result = [];
  allPlayers.forEach(player => {
    player.figures.forEach(fig => {
      if (
        typeof fig.pos === 'object' &&
        fig.pos.lane === lane &&
        fig.pos.color === colorKey &&
        fig.pos.slot === slot
      ) {
        result.push({ ...fig, playerColor: player.color });
      }
    });
  });
  return result;
}

function getFiguresInHome(allPlayers, colorKey) {
  const player = allPlayers.find(p => p.color === colorKey);
  if (!player) return [];
  return player.figures.filter(f => f.pos === 'home');
}

function Figure({ playerColor, figId, isSelected, isMoveable, onClick }) {
  return (
    <div
      className={`figure ${isSelected ? 'figure--selected' : ''} ${isMoveable ? 'figure--moveable' : ''}`}
      style={{ backgroundColor: COLOR_HEX[playerColor] }}
      onClick={onClick}
      title={`${playerColor} #${figId}`}
    />
  );
}

export default function Board({
  gamePlayers,
  specialsOnBoard,
  selectedFigure,
  moveableFigures,
  validTargets,
  onFigureClick,
  onCellClick,
  currentPlayerColor,
}) {
  const players = gamePlayers || [];

  function renderFigures(figures, isHome = false) {
    if (!figures.length) return null;
    return (
      <div className={`figures-group ${isHome ? 'figures-group--home' : ''}`}>
        {figures.map((fig, i) => {
          const isSelected = selectedFigure &&
            selectedFigure.figId === fig.id &&
            selectedFigure.playerColor === fig.playerColor;
          const isMoveable = moveableFigures?.some(
            m => m.figId === fig.id && m.playerColor === fig.playerColor
          );
          return (
            <Figure
              key={`${fig.playerColor}-${fig.id}`}
              playerColor={fig.playerColor}
              figId={fig.id}
              isSelected={isSelected}
              isMoveable={isMoveable}
              onClick={() => onFigureClick?.(fig.playerColor, fig.id)}
            />
          );
        })}
      </div>
    );
  }

  const cells = [];
  for (let r = 0; r < 19; r++) {
    for (let c = 0; c < 19; c++) {
      const cell = GRID[r][c];
      const key = `${r}-${c}`;
      let className = `board-cell board-cell--${cell.type}`;
      if (cell.color) className += ` board-cell--${cell.color}`;

      let content = null;
      let specialIcon = null;

      if (cell.type === 'outer-path') {
        const spKey = `outer-${cell.outerIdx}`;
        if (specialsOnBoard?.[spKey]) {
          specialIcon = SPECIAL_ICONS[specialsOnBoard[spKey].type];
        }
        const figs = getFiguresOnCell(players, 'outer', cell.outerIdx, players.map(p => ({
          ...p,
          figures: p.figures.map(f => ({ ...f, playerColor: p.color })),
        })));
        const isTarget = validTargets?.some(t => t.ring === 'outer' && t.idx === cell.outerIdx);
        if (isTarget) className += ' board-cell--target';
        content = renderFigures(figs);
      } else if (cell.type === 'inner-path') {
        const spKey = `inner-${cell.innerIdx}`;
        if (specialsOnBoard?.[spKey]) {
          specialIcon = SPECIAL_ICONS[specialsOnBoard[spKey].type];
        }
        const figs = getFiguresOnCell(players, 'inner', cell.innerIdx, players.map(p => ({
          ...p,
          figures: p.figures.map(f => ({ ...f, playerColor: p.color })),
        })));
        const isTarget = validTargets?.some(t => t.ring === 'inner' && t.idx === cell.innerIdx);
        if (isTarget) className += ' board-cell--target';
        content = renderFigures(figs);
      } else if (cell.type === 'home') {
        const homeFigs = getFiguresInHome(players, cell.color);
        const homePlayerFigs = homeFigs.map(f => ({ ...f, playerColor: cell.color }));
        content = renderFigures(homePlayerFigs, true);
      } else if (cell.type === 'outer-finish' || cell.type === 'inner-finish') {
        const lane = cell.type === 'outer-finish' ? 'outer' : 'inner';
        const figs = getFiguresOnFinish(players, cell.color, lane, cell.slot);
        const figsMapped = figs.map(f => ({ ...f, playerColor: cell.color }));
        const isTarget = validTargets?.some(
          t => t.lane === lane && t.color === cell.color && t.slot === cell.slot
        );
        if (isTarget) className += ' board-cell--target';
        content = (
          <>
            <span className="finish-slot-num">{cell.slot}</span>
            {renderFigures(figsMapped)}
          </>
        );
      } else if (cell.type === 'center') {
        if (r === 9 && c === 9) {
          content = <span className="board-center-text">🎲</span>;
        }
      }

      cells.push(
        <div
          key={key}
          className={className}
          onClick={() => onCellClick?.({ r, c, cell })}
          data-r={r}
          data-c={c}
        >
          {specialIcon && <span className="special-icon">{specialIcon}</span>}
          {content}
        </div>
      );
    }
  }

  return (
    <div className="board-wrapper">
      <div className="board-grid">
        {cells}
      </div>
    </div>
  );
}