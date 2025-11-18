import { useState } from 'react';
import ApiKeySettings from './ApiKeySettings';

function Home({ onJoinRoom, onCreateRoom }) {
  const [playerName, setPlayerName] = useState('');
  const [roomId, setRoomId] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [settings, setSettings] = useState({
    maxPlayers: 10,
    werewolfCount: 2,
    seerCount: 1,
    knightCount: 1,
    cpuCount: 0
  });

  const handleJoin = () => {
    if (!playerName.trim() || !roomId.trim()) {
      alert('プレイヤー名とルームIDを入力してください');
      return;
    }
    onJoinRoom(roomId.toUpperCase(), playerName);
  };

  const handleCreate = () => {
    if (!playerName.trim()) {
      alert('プレイヤー名を入力してください');
      return;
    }
    onCreateRoom(playerName, settings);
  };

  return (
    <div>
      <h1 style={{ textAlign: 'center', marginBottom: '40px', fontSize: '48px' }}>
        🐺 人狼ゲーム
      </h1>

      <ApiKeySettings />

      {!showCreateForm ? (
        <div>
          <div className="form-group">
            <label>プレイヤー名</label>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="あなたの名前を入力"
              maxLength={20}
            />
          </div>

          <div className="form-group">
            <label>ルームID</label>
            <input
              type="text"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value.toUpperCase())}
              placeholder="ルームIDを入力（6文字）"
              maxLength={6}
            />
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
            <button onClick={handleJoin} style={{ flex: 1 }}>
              ルームに参加
            </button>
            <button 
              onClick={() => setShowCreateForm(true)} 
              className="secondary"
              style={{ flex: 1 }}
            >
              ルームを作成
            </button>
          </div>
        </div>
      ) : (
        <div>
          <h2>ルームを作成</h2>
          
          <div className="form-group">
            <label>プレイヤー名</label>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="あなたの名前を入力"
              maxLength={20}
            />
          </div>

          <div className="settings-panel">
            <h3>ゲーム設定</h3>
            
            <div className="form-group">
              <label>最大プレイヤー数: {settings.maxPlayers}人</label>
              <input
                type="range"
                min="3"
                max="15"
                value={settings.maxPlayers}
                onChange={(e) => setSettings({...settings, maxPlayers: parseInt(e.target.value)})}
              />
            </div>

            <div className="form-group">
              <label>人狼: {settings.werewolfCount}人</label>
              <input
                type="range"
                min="1"
                max="5"
                value={settings.werewolfCount}
                onChange={(e) => setSettings({...settings, werewolfCount: parseInt(e.target.value)})}
              />
            </div>

            <div className="form-group">
              <label>占い師: {settings.seerCount}人</label>
              <input
                type="range"
                min="0"
                max="2"
                value={settings.seerCount}
                onChange={(e) => setSettings({...settings, seerCount: parseInt(e.target.value)})}
              />
            </div>

            <div className="form-group">
              <label>騎士: {settings.knightCount}人</label>
              <input
                type="range"
                min="0"
                max="2"
                value={settings.knightCount}
                onChange={(e) => setSettings({...settings, knightCount: parseInt(e.target.value)})}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
            <button onClick={handleCreate} style={{ flex: 1 }}>
              作成して参加
            </button>
            <button 
              onClick={() => setShowCreateForm(false)} 
              className="secondary"
              style={{ flex: 1 }}
            >
              戻る
            </button>
          </div>
        </div>
      )}

      <div style={{ marginTop: '40px', padding: '20px', background: '#f8f9fa', borderRadius: '12px' }}>
        <h3>遊び方</h3>
        <ul style={{ marginLeft: '20px', lineHeight: '1.8' }}>
          <li>3〜15人でプレイできます</li>
          <li>人狼、占い師、騎士、村人の役職があります</li>
          <li>昼は議論、夜は各役職がアクションを実行します</li>
          <li>人狼を全滅させれば村人陣営の勝利！</li>
          <li>人狼が村人と同数以上になれば人狼陣営の勝利！</li>
          <li>CPUプレイヤーを追加して、少人数でもプレイ可能！</li>
        </ul>
      </div>
    </div>
  );
}

export default Home;
