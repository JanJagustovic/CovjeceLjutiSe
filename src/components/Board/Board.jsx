import { GRID, PLAYERS, OUTER_PATH, INNER_PATH } from '../../data/boardLayout.js';
import './Board.css';

const SPECIAL_ICONS = {
  most:    '🌉',
  kocka:   '🎲',
  rewind:  '⏪',
  bomba:   '💣',
  stop:    '⏸️',
  zamjena: '🔄',
};

const COLOR_HEX = {
  red: '#e53935', yellow: '#fdd835', blue: '#1e88e5', green: '#43a047',
  cyan: '#00838f', purple: '#8e24aa', magenta: '#f06292', orange: '#fb8c00',
};

function getArrowDir(path, idx) {
  const curr = path[idx];
  const next = path[(idx + 1) % path.length];
  if (next.r > curr.r) return '↓';
  if (next.r < curr.r) return '↑';
  if (next.c > curr.c) return '→';
  return '←';
}

function buildSpawnMap(activePlayers) {
  const map = {};
  activePlayers.forEach(player => {
    const pd = PLAYERS[player.color];
    if (!pd) return;
    const outerCell = OUTER_PATH[pd.exitOuter];
    map[`${outerCell.r}-${outerCell.c}`] = { color: player.color, dir: getArrowDir(OUTER_PATH, pd.exitOuter) };
    const innerCell = INNER_PATH[pd.exitInner];
    map[`${innerCell.r}-${innerCell.c}`] = { color: player.color, dir: getArrowDir(INNER_PATH, pd.exitInner) };
  });
  return map;
}

function getFiguresOnCell(ring, idx, allPlayers) {
  if (!Array.isArray(allPlayers)) return [];
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
  if (!Array.isArray(allPlayers)) return [];
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


function Figure({ playerColor, figId, isSelected, isMoveable, isStop, isRewind, onClick }) {
  const extra = isStop ? ' figure--stop' : isRewind ? ' figure--rewind' : '';
  return (
    <div
      className={`figure${isSelected ? ' figure--selected' : ''}${isMoveable ? ' figure--moveable' : ''}${extra}`}
      style={{ backgroundColor: COLOR_HEX[playerColor] }}
      onClick={onClick}
      title={`${playerColor} #${figId}${isStop ? ' ⏸️' : isRewind ? ' ⏪' : ''}`}
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
}) {
  const players = Array.isArray(gamePlayers) ? gamePlayers : [];
  const spawnMap = buildSpawnMap(players);

  function renderFigures(figures, isHome = false) {
    if (!figures.length) return null;
    return (
      <div className={`figures-group ${isHome ? 'figures-group--home' : ''}`}>
        {figures.map((fig) => {
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
              isStop={!!fig.stopActive}
              isRewind={!!fig.rewindNext}
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

      const spawn = spawnMap[key];
      let content = null;
      let specialIcon = null;
      let specialBadge = false;

      if (cell.type === 'outer-path') {
        const spKey = `outer-${cell.outerIdx}`;
        const figs = getFiguresOnCell('outer', cell.outerIdx, players);
        if (specialsOnBoard?.[spKey]) {
          specialIcon = SPECIAL_ICONS[specialsOnBoard[spKey].type];
          specialBadge = figs.length > 0;
        }
        const isTarget = validTargets?.some(t => t.ring === 'outer' && t.idx === cell.outerIdx);
        if (isTarget) className += ' board-cell--target';
        content = renderFigures(figs);
      } else if (cell.type === 'inner-path') {
        const spKey = `inner-${cell.innerIdx}`;
        const figs = getFiguresOnCell('inner', cell.innerIdx, players);
        if (specialsOnBoard?.[spKey]) {
          specialIcon = SPECIAL_ICONS[specialsOnBoard[spKey].type];
          specialBadge = figs.length > 0;
        }
        const isTarget = validTargets?.some(t => t.ring === 'inner' && t.idx === cell.innerIdx);
        if (isTarget) className += ' board-cell--target';
        content = renderFigures(figs);
      } else if (cell.type === 'home') {
        const player = players.find(p => p.color === cell.color);
        if (player) {
          const fig = player.figures[cell.homeSlot];
          if (fig && fig.pos === 'home') {
            content = renderFigures([{ ...fig, playerColor: cell.color }], true);
          }
        }
      } else if (cell.type === 'finish') {
        const figs = getFiguresOnFinish(players, cell.color, 'finish', cell.slot);
        const figsMapped = figs.map(f => ({ ...f, playerColor: cell.color }));
        const isTarget = validTargets?.some(
          t => t.lane === 'finish' && t.color === cell.color && t.slot === cell.slot
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
          style={spawn ? { backgroundColor: COLOR_HEX[spawn.color] + '55' } : undefined}
          onClick={() => onCellClick?.({ r, c, cell })}
          data-r={r}
          data-c={c}
        >
          {spawn && (
            <span className="spawn-arrow" style={{ color: COLOR_HEX[spawn.color] }}>
              {spawn.dir}
            </span>
          )}
          {specialIcon && (
            <span className={`special-icon${specialBadge ? ' special-icon--badge' : ''}`}>
              {specialIcon}
            </span>
          )}
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