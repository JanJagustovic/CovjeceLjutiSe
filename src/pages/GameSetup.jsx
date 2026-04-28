import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import './GameSetup.css';

const ALL_COLORS = ['red', 'yellow', 'blue', 'green', 'cyan', 'purple', 'magenta', 'orange'];

const COLOR_HEX = {
  red: '#e53935', yellow: '#fdd835', blue: '#1e88e5', green: '#43a047',
  cyan: '#00acc1', purple: '#8e24aa', magenta: '#d81b60', orange: '#fb8c00',
};

function initPlayers(count) {
  return ALL_COLORS.slice(0, count).map((color, i) => ({
    id: i,
    name: `Igrač ${i + 1}`,
    color,
  }));
}

export default function GameSetup() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [count, setCount] = useState(4);
  const [players, setPlayers] = useState(() => initPlayers(4));

  function handleCountChange(n) {
    setCount(n);
    setPlayers(prev => {
      const next = initPlayers(n);
      // keep custom names if player existed
      return next.map((p, i) => prev[i] ? { ...p, name: prev[i].name } : p);
    });
  }

  function handleName(id, name) {
    setPlayers(prev => prev.map(p => p.id === id ? { ...p, name } : p));
  }

  function handleColor(id, color) {
    const already = players.find(p => p.id !== id && p.color === color);
    if (already) return; // color taken
    setPlayers(prev => prev.map(p => p.id === id ? { ...p, color } : p));
  }

  function startGame() {
    sessionStorage.setItem('gameSetup', JSON.stringify({ players }));
    navigate('/game');
  }

  const usedColors = new Set(players.map(p => p.color));

  return (
    <div className="setup-page page">
      <div className="setup-header">
        <button className="btn btn-ghost" onClick={() => navigate('/')}>← {t('setupBack')}</button>
        <h2 className="setup-title">{t('setupTitle')}</h2>
      </div>

      <div className="setup-scroll">
        <div className="setup-count-row">
          <span className="setup-label">{t('setupPlayers')}</span>
          <div className="setup-count-btns">
            {[2,3,4,5,6,7,8].map(n => (
              <button
                key={n}
                className={`count-btn ${count === n ? 'count-btn--active' : ''}`}
                onClick={() => handleCountChange(n)}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="setup-players">
          {players.map(player => (
            <div key={player.id} className="player-card card">
              <div className="player-card-top">
                <div className="player-avatar" style={{ backgroundColor: COLOR_HEX[player.color] }}>
                  {player.name.charAt(0).toUpperCase()}
                </div>
                <input
                  className="player-name-input"
                  value={player.name}
                  maxLength={14}
                  onChange={e => handleName(player.id, e.target.value)}
                />
              </div>
              <div className="player-colors">
                {ALL_COLORS.map(color => (
                  <button
                    key={color}
                    className={`color-dot ${player.color === color ? 'color-dot--active' : ''} ${usedColors.has(color) && player.color !== color ? 'color-dot--taken' : ''}`}
                    style={{ backgroundColor: COLOR_HEX[color] }}
                    onClick={() => handleColor(player.id, color)}
                    aria-label={t('color' + color.charAt(0).toUpperCase() + color.slice(1))}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="setup-footer">
        <button className="btn btn-primary btn-lg" style={{ width: '100%' }} onClick={startGame}>
          🎮 {t('setupStart')}
        </button>
      </div>
    </div>
  );
}