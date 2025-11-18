import { useState, useEffect } from 'react';
import { socket } from '../utils/socket';
import WaitingRoom from './WaitingRoom';
import GamePlay from './GamePlay';
import GameOver from './GameOver';

function GameRoom({ roomId, playerId, playerName, isHost, onLeave }) {
  const [gameState, setGameState] = useState(null);
  const [phase, setPhase] = useState('waiting');
  const [role, setRole] = useState(null);
  const [roleInfo, setRoleInfo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [day, setDay] = useState(0);

  useEffect(() => {
    // ルーム情報の更新
    socket.on('room-update', (state) => {
      setGameState(state);
      if (state.phase) {
        setPhase(state.phase);
      }
      if (state.day) {
        setDay(state.day);
      }
    });

    // 役職割り当て
    socket.on('role-assigned', ({ role, roleInfo }) => {
      setRole(role);
      setRoleInfo(roleInfo);
    });

    // ゲーム開始
    socket.on('game-started', (state) => {
      setGameState(state);
      setPhase(state.phase);
      setDay(state.day);
      addSystemMessage('ゲームが開始されました！');
    });

    // フェーズ変更
    socket.on('phase-change', ({ phase, day }) => {
      setPhase(phase);
      setDay(day);
      
      const phaseNames = {
        'day_discussion': '昼の議論フェーズ',
        'voting': '投票フェーズ',
        'night': '夜フェーズ',
        'game_over': 'ゲーム終了'
      };
      
      addSystemMessage(`${day}日目 - ${phaseNames[phase]}`);
    });

    // チャットメッセージ
    socket.on('chat-message', ({ playerId, playerName, message, isCPU }) => {
      addMessage({
        type: 'chat',
        playerId,
        playerName,
        message,
        isCPU
      });
    });

    // システムメッセージ
    socket.on('system-message', ({ message }) => {
      addSystemMessage(message);
    });

    // 投票結果
    socket.on('voting-result', ({ executed, voteCounts }) => {
      if (executed) {
        const player = gameState?.players.find(p => p.id === executed);
        if (player) {
          addSystemMessage(`${player.name}が投票により処刑されました`);
        }
      } else {
        addSystemMessage('投票の結果、誰も処刑されませんでした');
      }
    });

    // 夜の結果
    socket.on('night-result', ({ killed, message }) => {
      addSystemMessage(message);
    });

    // 占い結果
    socket.on('seer-result', ({ targetName, isWerewolf }) => {
      addSystemMessage(
        `【占い結果】${targetName}は${isWerewolf ? '人狼' : '人狼ではありません'}！`,
        'important'
      );
    });

    // 投票通知
    socket.on('vote-cast', ({ voterName }) => {
      addSystemMessage(`${voterName}が投票しました`);
    });

    // ゲーム終了
    socket.on('game-over', ({ winner, players }) => {
      setPhase('game_over');
      setGameState(prev => ({ ...prev, winner, players, phase: 'game_over' }));
    });

    // エラー
    socket.on('error', ({ message }) => {
      alert(message);
    });

    return () => {
      socket.off('room-update');
      socket.off('role-assigned');
      socket.off('game-started');
      socket.off('phase-change');
      socket.off('chat-message');
      socket.off('system-message');
      socket.off('voting-result');
      socket.off('night-result');
      socket.off('seer-result');
      socket.off('vote-cast');
      socket.off('game-over');
      socket.off('error');
    };
  }, [gameState]);

  const addMessage = (message) => {
    setMessages(prev => [...prev, { ...message, timestamp: Date.now() }]);
  };

  const addSystemMessage = (text, importance = 'normal') => {
    addMessage({
      type: 'system',
      message: text,
      importance
    });
  };

  const handleStartGame = () => {
    socket.emit('start-game', { roomId });
  };

  const handleAddCPU = () => {
    socket.emit('add-cpu', { roomId });
  };

  const handleRemoveCPU = (cpuId) => {
    socket.emit('remove-cpu', { roomId, cpuId });
  };

  const handleSendMessage = (message) => {
    socket.emit('chat-message', { roomId, message });
  };

  const handleVote = (targetId) => {
    socket.emit('vote', { roomId, targetId });
  };

  const handleNightAction = (action, targetId) => {
    socket.emit('night-action', { roomId, action, targetId });
  };

  const handleNextPhase = () => {
    socket.emit('next-phase', { roomId });
  };

  const handleUpdateSettings = (newSettings) => {
    socket.emit('update-settings', { roomId, settings: newSettings });
  };

  if (!gameState) {
    return (
      <div className="loading">
        <h2>ルームに接続中...</h2>
      </div>
    );
  }

  if (phase === 'game_over') {
    return (
      <GameOver
        winner={gameState.winner}
        players={gameState.players}
        onLeave={onLeave}
        onPlayAgain={() => window.location.reload()}
      />
    );
  }

  if (phase === 'waiting') {
    return (
      <WaitingRoom
        roomId={roomId}
        players={gameState.players}
        isHost={isHost}
        settings={gameState.settings}
        onStartGame={handleStartGame}
        onAddCPU={handleAddCPU}
        onRemoveCPU={handleRemoveCPU}
        onUpdateSettings={handleUpdateSettings}
        onLeave={onLeave}
      />
    );
  }

  return (
    <GamePlay
      roomId={roomId}
      playerId={playerId}
      playerName={playerName}
      gameState={gameState}
      phase={phase}
      day={day}
      role={role}
      roleInfo={roleInfo}
      messages={messages}
      isHost={isHost}
      onSendMessage={handleSendMessage}
      onVote={handleVote}
      onNightAction={handleNightAction}
      onNextPhase={handleNextPhase}
      onLeave={onLeave}
    />
  );
}

export default GameRoom;
