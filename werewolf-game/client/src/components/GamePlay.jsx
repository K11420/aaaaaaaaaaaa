import { useState, useEffect, useRef } from 'react';

function GamePlay({
  roomId,
  playerId,
  playerName,
  gameState,
  phase,
  day,
  role,
  roleInfo,
  messages,
  isHost,
  onSendMessage,
  onVote,
  onNightAction,
  onNextPhase,
  onLeave
}) {
  const [chatMessage, setChatMessage] = useState('');
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [hasActed, setHasActed] = useState(false);
  const messagesEndRef = useRef(null);

  const currentPlayer = gameState?.players.find(p => p.id === playerId);
  const alivePlayers = gameState?.players.filter(p => p.isAlive && p.id !== playerId) || [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    // フェーズが変わったらリセット
    setHasVoted(false);
    setHasActed(false);
    setSelectedTarget(null);
  }, [phase]);

  const handleSendChat = (e) => {
    e.preventDefault();
    if (chatMessage.trim()) {
      onSendMessage(chatMessage);
      setChatMessage('');
    }
  };

  const handleVote = (targetId) => {
    if (!hasVoted && currentPlayer?.isAlive) {
      onVote(targetId);
      setHasVoted(true);
      setSelectedTarget(targetId);
    }
  };

  const handleNightAction = (targetId) => {
    if (!hasActed && currentPlayer?.isAlive) {
      const actions = {
        'werewolf': 'attack',
        'seer': 'divine',
        'knight': 'protect'
      };
      
      const action = actions[role];
      if (action) {
        onNightAction(action, targetId);
        setHasActed(true);
        setSelectedTarget(targetId);
      }
    }
  };

  const getPhaseTitle = () => {
    const phases = {
      'day_discussion': '☀️ 昼の議論',
      'voting': '🗳️ 投票タイム',
      'night': '🌙 夜のアクション'
    };
    return phases[phase] || phase;
  };

  const getPhaseDescription = () => {
    if (phase === 'day_discussion') {
      return '議論をして、怪しいプレイヤーを見つけましょう';
    } else if (phase === 'voting') {
      return '処刑したいプレイヤーに投票してください';
    } else if (phase === 'night') {
      if (!currentPlayer?.isAlive) {
        return '死亡しているため、何もできません';
      }
      
      const descriptions = {
        'werewolf': '襲撃する村人を選んでください',
        'seer': '占う対象を選んでください',
        'knight': '守る対象を選んでください',
        'villager': '夜は何もできません。朝を待ちましょう'
      };
      return descriptions[role] || '夜のアクションを実行してください';
    }
    return '';
  };

  const canAct = () => {
    if (!currentPlayer?.isAlive) return false;
    
    if (phase === 'voting') {
      return !hasVoted;
    } else if (phase === 'night') {
      return !hasActed && (role === 'werewolf' || role === 'seer' || role === 'knight');
    }
    return false;
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>人狼ゲーム - {day}日目</h1>
        <button onClick={onLeave} className="danger">退出</button>
      </div>

      {roleInfo && (
        <div className="role-info">
          <h2>{roleInfo.name} ({roleInfo.team === 'werewolf' ? '人狼陣営' : '村人陣営'})</h2>
          <p>{roleInfo.description}</p>
        </div>
      )}

      <div className="phase-indicator">
        {getPhaseTitle()} - {getPhaseDescription()}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
        <div>
          <h3>プレイヤー ({gameState?.alivePlayers || 0}人生存)</h3>
          <div className="player-list">
            {gameState?.players.map(player => (
              <div 
                key={player.id} 
                className={`player-card ${player.isAlive ? 'alive' : 'dead'} ${player.isHost ? 'host' : ''} ${player.isCPU ? 'cpu' : ''}`}
              >
                <div style={{ fontWeight: 'bold' }}>
                  {player.name}
                  {player.id === playerId && ' (あなた)'}
                </div>
                <div style={{ fontSize: '12px', marginTop: '4px' }}>
                  {player.isAlive ? '✅ 生存' : '💀 死亡'}
                </div>
                {player.isCPU && <div style={{ fontSize: '12px' }}>🤖</div>}
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3>チャット</h3>
          <div className="chat-container">
            <div className="chat-messages">
              {messages.map((msg, index) => (
                <div 
                  key={index} 
                  className={`chat-message ${msg.type === 'system' ? 'system' : ''} ${msg.isCPU ? 'cpu' : ''}`}
                  style={msg.importance === 'important' ? { 
                    background: '#ffd700', 
                    fontWeight: 'bold',
                    border: '2px solid #ff6b6b'
                  } : {}}
                >
                  {msg.type === 'system' ? (
                    <div>{msg.message}</div>
                  ) : (
                    <div>
                      <strong>{msg.playerName}:</strong> {msg.message}
                    </div>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {currentPlayer?.isAlive && phase !== 'night' && (
              <form onSubmit={handleSendChat} className="chat-input-container">
                <input
                  type="text"
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  placeholder="メッセージを入力..."
                  maxLength={200}
                />
                <button type="submit">送信</button>
              </form>
            )}
          </div>
        </div>
      </div>

      {canAct() && alivePlayers.length > 0 && (
        <div className="voting-area">
          <h3>
            {phase === 'voting' ? '投票先を選択' : '対象を選択'}
          </h3>
          <div className="vote-buttons">
            {alivePlayers.map(player => (
              <button
                key={player.id}
                onClick={() => phase === 'voting' ? handleVote(player.id) : handleNightAction(player.id)}
                disabled={!canAct()}
                className={selectedTarget === player.id ? 'success' : 'secondary'}
              >
                {player.name}
                {selectedTarget === player.id && ' ✓'}
              </button>
            ))}
          </div>
          
          {(hasVoted || hasActed) && (
            <div style={{ 
              marginTop: '16px', 
              textAlign: 'center', 
              color: '#28a745',
              fontWeight: 'bold'
            }}>
              {phase === 'voting' ? '投票完了！' : 'アクション実行完了！'}
            </div>
          )}
        </div>
      )}

      {!currentPlayer?.isAlive && (
        <div style={{ 
          padding: '20px', 
          background: '#f8d7da', 
          borderRadius: '12px',
          textAlign: 'center',
          marginTop: '20px'
        }}>
          <h3>あなたは死亡しています</h3>
          <p>ゲームの行方を見守りましょう</p>
        </div>
      )}

      {isHost && (
        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          <button 
            onClick={onNextPhase}
            className="secondary"
          >
            次のフェーズへ（ホスト専用）
          </button>
          <div style={{ fontSize: '12px', marginTop: '8px', color: '#666' }}>
            ※ 通常は自動で進行しますが、手動で進めることもできます
          </div>
        </div>
      )}

      {gameState?.history && gameState.history.length > 0 && (
        <div className="history-log">
          <h4>ゲームログ</h4>
          {gameState.history.map((item, index) => (
            <div key={index} className="history-item">
              {item.day > 0 && `${item.day}日目 - `}{item.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default GamePlay;
