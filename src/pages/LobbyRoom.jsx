import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { doc, onSnapshot, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { PLAYER_ORDER, PLAYERS } from '../data/boardLayout';
import './Lobby.css';

const COLOR_HEX = Object.fromEntries(
  Object.entries(PLAYERS).map(([k, v]) => [k, v.color])
);

export default function LobbyRoom() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { t } = useLanguage();
  const [room, setRoom]   = useState(null);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!roomId || loading) return;
    return onSnapshot(doc(db, 'rooms', roomId), (snap) => {
      if (!snap.exists()) { navigate('/lobby'); return; }
      const data = { id: snap.id, ...snap.data() };
      setRoom(data);
      if (data.status === 'active') {
        navigate(`/online/${roomId}`);
      }
    });
  }, [roomId, loading]);

  // Join: add this user to players[] once we have both room and user
  useEffect(() => {
    if (!room || !user || joined || loading) return;
    const alreadyIn = room.players.some(p => p.uid === user.uid);
    if (alreadyIn) { setJoined(true); return; }

    const takenColors = room.players.map(p => p.color);
    const availableColor = PLAYER_ORDER.find(c => !takenColors.includes(c));
    if (!availableColor) { setError('Room is full.'); return; }

    const entry = {
      uid: user.uid,
      name: user.displayName || user.email?.split('@')[0] || `${t('setupPlayerName')} ${room.players.length + 1}`,
      color: availableColor,
      index: room.players.length,
    };

    updateDoc(doc(db, 'rooms', roomId), {
      players: arrayUnion(entry),
      updatedAt: serverTimestamp(),
    })
      .then(() => setJoined(true))
      .catch(err => { console.error(err); setError('Could not join room.'); });
  }, [room, user, joined, loading]);

  async function handleStart() {
    await updateDoc(doc(db, 'rooms', roomId), {
      status: 'active',
      updatedAt: serverTimestamp(),
    });
  }

  if (loading || !room) return <div className="page lobby-room-page"><p style={{ padding: 20 }}>...</p></div>;

  const isHost    = room.hostUid === user?.uid;
  const canStart  = isHost && room.players.length >= 2;

  return (
    <div className="page lobby-room-page">
      <div className="lobby-header">
        <button className="btn btn-ghost" onClick={() => navigate('/lobby')}>← {t('setupBack')}</button>
      </div>

      <div className="lobby-room-content">
        <div className="lobby-code-display">
          <h2>{t('lobbyRoomCode')}</h2>
          <div className="lobby-code-value">{room.code}</div>
          <p className="lobby-code-hint">{t('lobbyShareCode')}</p>
        </div>

        <div>
          <p className="lobby-players-title">{t('lobbyPlayers')}</p>
          <div className="lobby-players-list">
            {room.players.map(p => (
              <div key={p.uid} className="lobby-player-row">
                <span
                  className="lobby-player-dot"
                  style={{ background: COLOR_HEX[p.color] }}
                />
                <span className={`lobby-player-name${p.uid === user?.uid ? ' is-me' : ''}`}>
                  {p.name}
                  {p.uid === room.hostUid ? ' 👑' : ''}
                  {p.uid === user?.uid ? ` (${t('lobbyYou')})` : ''}
                </span>
              </div>
            ))}
          </div>
        </div>

        {error && <p className="lobby-error">{error}</p>}

        {canStart && (
          <button className="btn btn-primary btn-lg" onClick={handleStart}>
            🎮 {t('setupStart')}
          </button>
        )}

        {isHost && !canStart && (
          <p className="lobby-status-msg">{t('lobbyWaitingPlayers')}</p>
        )}
        {!isHost && (
          <p className="lobby-status-msg">{t('lobbyWaitingHost')}</p>
        )}
      </div>
    </div>
  );
}