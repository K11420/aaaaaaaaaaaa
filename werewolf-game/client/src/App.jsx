import { useState, useEffect } from 'react';
import { connectSocket, socket } from './utils/socket';
import Home from './components/Home';
import GameRoom from './components/GameRoom';

function App() {
  const [currentScreen, setCurrentScreen] = useState('home');
  const [roomId, setRoomId] = useState(null);
  const [playerId, setPlayerId] = useState(null);
  const [playerName, setPlayerName] = useState('');
  const [isHost, setIsHost] = useState(false);

  useEffect(() => {
    connectSocket();

    socket.on('joined-room', ({ roomId, playerId, isHost }) => {
      setRoomId(roomId);
      setPlayerId(playerId);
      setIsHost(isHost);
      setCurrentScreen('game');
    });

    socket.on('error', ({ message }) => {
      alert(message);
    });

    return () => {
      socket.off('joined-room');
      socket.off('error');
    };
  }, []);

  const handleJoinRoom = (roomId, playerName) => {
    console.log('🚪 Attempting to join room:', roomId, 'as', playerName);
    console.log('Socket connected:', socket.connected);
    setPlayerName(playerName);
    socket.emit('join-room', { roomId, playerName });
  };

  const handleCreateRoom = async (playerName, settings) => {
    try {
      // Cloudflare経由の場合は相対パス
      const apiUrl = window.location.origin.includes('trycloudflare.com') 
        ? ''  // 相対パス（プロキシ経由）
        : (import.meta.env.VITE_SOCKET_URL || 'http://localhost:4096');
      
      const response = await fetch(`${apiUrl}/api/rooms/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ playerName, settings })
      });

      const data = await response.json();
      
      if (data.success) {
        setPlayerName(playerName);
        socket.emit('join-room', { roomId: data.roomId, playerName });
      }
    } catch (error) {
      console.error('Failed to create room:', error);
      alert('ルームの作成に失敗しました: ' + error.message);
    }
  };

  const handleLeaveRoom = () => {
    setCurrentScreen('home');
    setRoomId(null);
    setPlayerId(null);
    setIsHost(false);
  };

  return (
    <div className="app">
      <div className="container">
        {currentScreen === 'home' ? (
          <Home 
            onJoinRoom={handleJoinRoom}
            onCreateRoom={handleCreateRoom}
          />
        ) : (
          <GameRoom
            roomId={roomId}
            playerId={playerId}
            playerName={playerName}
            isHost={isHost}
            onLeave={handleLeaveRoom}
          />
        )}
      </div>
    </div>
  );
}

export default App;
