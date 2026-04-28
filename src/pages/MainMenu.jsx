import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import './MainMenu.css';

export default function MainMenu() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="menu-page page">
      <div className="menu-header">
        <button className="btn btn-ghost menu-theme-btn" onClick={toggleTheme} aria-label="Toggle theme">
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
      </div>

      <div className="menu-hero">
        <div className="menu-logo">
          <div className="menu-logo-icon">🎲</div>
          <h1 className="menu-title">{t('appName')}</h1>
        </div>
      </div>

      <nav className="menu-nav">
        <button className="btn btn-primary btn-lg menu-btn" onClick={() => navigate('/setup')}>
          🎮 {t('menuPlay')}
        </button>
        <button className="btn btn-secondary btn-lg menu-btn" onClick={() => navigate('/rules')}>
          📖 {t('menuRules')}
        </button>
        <button className="btn btn-secondary btn-lg menu-btn" onClick={() => navigate('/settings')}>
          ⚙️ {t('menuSettings')}
        </button>
      </nav>

      <div className="menu-footer">
        <span className="menu-footer-text">2–8 igrača · Dinamički mod</span>
      </div>
    </div>
  );
}