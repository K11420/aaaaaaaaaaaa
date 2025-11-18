import { useState } from 'react';

function WaitingRoom({ 
  roomId, 
  players, 
  isHost, 
  settings,
  onStartGame, 
  onAddCPU,
  onRemoveCPU,
  onUpdateSettings,
  onLeave 
}) {
  const [showSettings, setShowSettings] = useState(false);
  const [localSettings, setLocalSettings] = useState(settings || {
    maxPlayers: 10,
    werewolfCount: 2,
    seerCount: 1,
    knightCount: 1
  });

  const handleUpdateSettings = () => {
    onUpdateSettings(localSettings);
    setShowSettings(false);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>待機室</h1>
        <button onClick={onLeave} className="danger">退出</button>
      </div>

      <div className="phase-indicator">
        ルームID: {roomId}
      </div>

      <div style={{ background: '#f8f9fa', padding: '20px', borderRadius: '12px', marginBottom: '20px' }}>
        <h3>プレイヤー ({players.length}/{localSettings.maxPlayers})</h3>
        <div className="player-list">
          {players.map(player => (
            <div 
              key={player.id} 
              className={`player-card ${player.isHost ? 'host' : ''} ${player.isCPU ? 'cpu' : ''}`}
            >
              <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                {player.name}
              </div>
              {player.isHost && <div style={{ fontSize: '12px' }}>👑 ホスト</div>}
              {player.isCPU && (
                <div>
                  <div style={{ fontSize: '12px' }}>🤖 CPU</div>
                  {isHost && (
                    <button 
                      onClick={() => onRemoveCPU(player.id)}
                      className="danger"
                      style={{ 
                        marginTop: '8px', 
                        padding: '4px 8px', 
                        fontSize: '12px',
                        width: '100%'
                      }}
                    >
                      削除
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {isHost && (
        <div>
          <div className="action-buttons">
            <button onClick={onAddCPU} className="secondary">
              CPUプレイヤーを追加
            </button>
            <button onClick={() => setShowSettings(!showSettings)} className="secondary">
              {showSettings ? '設定を閉じる' : 'ゲーム設定'}
            </button>
          </div>

          {showSettings && (
            <div className="settings-panel">
              <h3>ゲーム設定</h3>
              
              <div className="form-group">
                <label>最大プレイヤー数: {localSettings.maxPlayers}人</label>
                <input
                  type="range"
                  min="3"
                  max="15"
                  value={localSettings.maxPlayers}
                  onChange={(e) => setLocalSettings({...localSettings, maxPlayers: parseInt(e.target.value)})}
                />
              </div>

              <div className="form-group">
                <label>人狼: {localSettings.werewolfCount}人</label>
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={localSettings.werewolfCount}
                  onChange={(e) => setLocalSettings({...localSettings, werewolfCount: parseInt(e.target.value)})}
                />
              </div>

              <div className="form-group">
                <label>占い師: {localSettings.seerCount}人</label>
                <input
                  type="range"
                  min="0"
                  max="2"
                  value={localSettings.seerCount}
                  onChange={(e) => setLocalSettings({...localSettings, seerCount: parseInt(e.target.value)})}
                />
              </div>

              <div className="form-group">
                <label>騎士: {localSettings.knightCount}人</label>
                <input
                  type="range"
                  min="0"
                  max="2"
                  value={localSettings.knightCount}
                  onChange={(e) => setLocalSettings({...localSettings, knightCount: parseInt(e.target.value)})}
                />
              </div>

              <button onClick={handleUpdateSettings} className="success">
                設定を保存
              </button>
            </div>
          )}

          <button 
            onClick={onStartGame}
            className="success"
            style={{ 
              width: '100%', 
              padding: '16px', 
              fontSize: '20px',
              marginTop: '20px'
            }}
            disabled={players.length < 3}
          >
            ゲーム開始
          </button>

          {players.length < 3 && (
            <div style={{ 
              marginTop: '12px', 
              textAlign: 'center', 
              color: '#dc3545',
              fontWeight: 'bold'
            }}>
              ※ 最低3人のプレイヤーが必要です（CPUを追加できます）
            </div>
          )}
        </div>
      )}

      {!isHost && (
        <div style={{ 
          marginTop: '20px', 
          textAlign: 'center', 
          padding: '20px',
          background: '#ffeaa7',
          borderRadius: '12px'
        }}>
          ホストがゲームを開始するまでお待ちください...
        </div>
      )}

      <div style={{ marginTop: '20px', padding: '16px', background: '#e3f2fd', borderRadius: '12px' }}>
        <h4>このゲームについて</h4>
        <ul style={{ marginLeft: '20px', lineHeight: '1.6', fontSize: '14px' }}>
          <li>人狼: {localSettings.werewolfCount}人</li>
          <li>占い師: {localSettings.seerCount}人</li>
          <li>騎士: {localSettings.knightCount}人</li>
          <li>村人: 残りのプレイヤー</li>
        </ul>
      </div>
    </div>
  );
}

export default WaitingRoom;
