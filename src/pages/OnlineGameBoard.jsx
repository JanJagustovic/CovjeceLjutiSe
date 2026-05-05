import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useOnlineGame } from '../hooks/useOnlineGame';
import GameBoard from './GameBoard';

export default function OnlineGameBoard() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [room, setRoom] = useState(null);

  useEffect(() => {
    if (!roomId) return;
    return onSnapshot(doc(db, 'rooms', roomId), (snap) => {
      if (!snap.exists()) { navigate('/'); return; }
      setRoom({ id: snap.id, ...snap.data() });
    });
  }, [roomId]);

  if (loading || !room || !user) {
    return <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p>Connecting…</p>
    </div>;
  }

  return (
    <OnlineGameBoardInner
      room={room}
      roomId={roomId}
      myUid={user.uid}
    />
  );
}

function OnlineGameBoardInner({ room, roomId, myUid }) {
  const setupPlayers = room.players.map(p => ({
    color: p.color,
    name: p.name,
    uid: p.uid,
  }));

  const gameHook = useOnlineGame(setupPlayers, roomId, myUid);

  const currentPlayerUid = room.players[gameHook.state.currentPlayerIndex]?.uid;
  const isMyTurn = currentPlayerUid === myUid;

  return <GameBoard gameHook={gameHook} isMyTurn={isMyTurn} />;
}