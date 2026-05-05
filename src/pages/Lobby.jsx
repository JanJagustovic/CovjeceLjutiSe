import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { PLAYER_ORDER } from '../data/boardLayout';
import './Lobby.css';

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export default function Lobby() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { t, lang, setLanguage } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const [joinCode, setJoinCode]   = useState('');
  const [playerName, setPlayerName] = useState('');
  const [error, setError]         = useState('');
  const [busy, setBusy]           = useState(false);

  if (loading) return <div className="page lobby-page"><p>...</p></div>;

  if (!db) {
    return (
      <div className="page lobby-page">
        <div className="lobby-header">
          <button className="btn btn-ghost" onClick={() => navigate('/')}>← {t('setupBack')}</button>
        </div>
        <div className="lobby-content">
          <h2 className="lobby-title">{t('menuMultiplayer')}</h2>
          <p style={{ color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.6 }}>
            Firebase is not configured yet.<br />
            Fill in <code>.env</code> with your Firebase project credentials to enable multiplayer.
          </p>
        </div>
      </div>
    );
  }

  async function handleCreate() {
    setBusy(true);
    setError('');
    try {
      const code = generateCode();
      const name = playerName.trim() || `${t('setupPlayerName')} 1`;
      const docRef = await addDoc(collection(db, 'rooms'), {
        code,
        hostUid: user.uid,
        status: 'waiting',
        players: [{ uid: user.uid, name, color: PLAYER_ORDER[0], index: 0 }],
        gameState: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      navigate(`/lobby/${docRef.id}`);
    } catch (err) {
      console.error(err);
      setError('Failed to create room. Check your connection.');
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin() {
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 6) { setError('Enter a 6-character room code.'); return; }
    setBusy(true);
    setError('');
    try {
      const q = query(
        collection(db, 'rooms'),
        where('code', '==', code),
        where('status', '==', 'waiting'),
      );
      const snap = await getDocs(q);
      if (snap.empty) { setError('Room not found or already started.'); setBusy(false); return; }
      navigate(`/lobby/${snap.docs[0].id}`);
    } catch (err) {
      console.error(err);
      setError('Failed to join. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page lobby-page">
      <div className="lobby-header">
        <button className="btn btn-ghost" onClick={() => navigate('/')}>← {t('setupBack')}</button>
        <div style={{ display: 'flex', gap: '2px' }}>
          <button className="btn btn-ghost menu-theme-btn" onClick={() => setLanguage(lang === 'hr' ? 'en' : 'hr')}>
            {lang === 'hr' ? 'EN' : 'HR'}
          </button>
          <button className="btn btn-ghost menu-theme-btn" onClick={toggleTheme} aria-label="Toggle theme">
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>
      </div>

      <div className="lobby-content">
        <h2 className="lobby-title">{t('menuMultiplayer')}</h2>

        <section className="lobby-section">
          <h3 className="lobby-section-title">{t('lobbyCreate')}</h3>
          <input
            className="player-name-input"
            placeholder={`${t('setupPlayerName')} 1`}
            value={playerName}
            maxLength={16}
            onChange={e => setPlayerName(e.target.value)}
          />
          <button className="btn btn-primary btn-lg" onClick={handleCreate} disabled={busy}>
            {t('lobbyCreateBtn')}
          </button>
        </section>

        <div className="lobby-divider">{t('lobbyOr')}</div>

        <section className="lobby-section">
          <h3 className="lobby-section-title">{t('lobbyJoin')}</h3>
          <input
            className="player-name-input lobby-code-input"
            placeholder={t('lobbyCodePlaceholder')}
            value={joinCode}
            maxLength={6}
            onChange={e => setJoinCode(e.target.value.toUpperCase())}
          />
          <button
            className="btn btn-secondary btn-lg"
            onClick={handleJoin}
            disabled={busy || joinCode.length !== 6}
          >
            {t('lobbyJoinBtn')}
          </button>
        </section>

        {error && <p className="lobby-error">{error}</p>}
      </div>
    </div>
  );
}