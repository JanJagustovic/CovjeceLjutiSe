import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { doc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore';
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
    if (!roomId || loading) return;
    return onSnapshot(doc(db, 'rooms', roomId), (snap) => {
      if (!snap.exists()) { navigate('/'); return; }
      setRoom({ id: snap.id, ...snap.data() });
    });
  }, [roomId, loading]);

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
  const roomRef = useRef(room);
  useEffect(() => { roomRef.current = room; }, [room]);

  // Remove self from room.players on unmount so other clients detect the disconnect
  useEffect(() => {
    return () => {
      const r = roomRef.current;
      if (!r) return;
      updateDoc(doc(db, 'rooms', roomId), {
        players: r.players.filter(p => p.uid !== myUid),
        updatedAt: serverTimestamp(),
      }).catch(() => {});
    };
  }, []);

  const setupPlayers = room.players.map(p => ({
    color: p.color,
    name: p.name,
    uid: p.uid,
  }));

  const gameHook = useOnlineGame(setupPlayers, roomId, room.players);

  // Use game-state players (not room.players) so indices stay correct after removals
  const myColor = gameHook.state.players.find(p => p.uid === myUid)?.color;
  const isMyTurn = (() => {
    if (gameHook.state.phase === 'initial-roll') {
      const { initialRollWinner, initialRollIdx, initialRollOrder } = gameHook.state;
      if (initialRollWinner) return myColor === initialRollWinner;
      return myColor === initialRollOrder[initialRollIdx];
    }
    return gameHook.state.players[gameHook.state.currentPlayerIndex]?.uid === myUid;
  })();

  return <GameBoard gameHook={gameHook} isMyTurn={isMyTurn} myPlayerColor={myColor} playAgainPath="/lobby" />;
}