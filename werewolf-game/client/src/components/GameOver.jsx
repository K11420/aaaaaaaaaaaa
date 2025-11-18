function GameOver({ winner, players, onLeave, onPlayAgain }) {
  const isVillagersWin = winner === 'villagers';

  const getRoleEmoji = (role) => {
    const emojis = {
      'werewolf': '🐺',
      'seer': '🔮',
      'knight': '🛡️',
      'villager': '👤'
    };
    return emojis[role] || '👤';
  };

  const getRoleName = (role) => {
    const names = {
      'werewolf': '人狼',
      'seer': '占い師',
      'knight': '騎士',
      'villager': '村人'
    };
    return names[role] || '村人';
  };

  return (
    <div className="game-over">
      <h1 className={isVillagersWin ? 'winner-villagers' : 'winner-werewolves'}>
        {isVillagersWin ? '🎉 村人陣営の勝利！' : '🐺 人狼陣営の勝利！'}
      </h1>

      <div style={{ 
        fontSize: '24px', 
        marginBottom: '40px',
        padding: '20px',
        background: isVillagersWin ? '#d4edda' : '#f8d7da',
        borderRadius: '12px'
      }}>
        {isVillagersWin 
          ? '人狼を全て追放しました！村に平和が戻りました。' 
          : '人狼が村を乗っ取りました...'}
      </div>

      <h2>プレイヤー一覧</h2>
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: '16px',
        margin: '20px 0'
      }}>
        {players.map(player => {
          const isWinner = (isVillagersWin && player.role !== 'werewolf') || 
                          (!isVillagersWin && player.role === 'werewolf');
          
          return (
            <div 
              key={player.id}
              style={{
                padding: '20px',
                borderRadius: '12px',
                background: isWinner ? '#d4edda' : '#f8d7da',
                border: `3px solid ${isWinner ? '#28a745' : '#dc3545'}`,
                textAlign: 'center'
              }}
            >
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>
                {getRoleEmoji(player.role)}
              </div>
              <div style={{ fontWeight: 'bold', fontSize: '18px', marginBottom: '4px' }}>
                {player.name}
              </div>
              <div style={{ fontSize: '14px', color: '#666' }}>
                {getRoleName(player.role)}
              </div>
              <div style={{ fontSize: '14px', marginTop: '8px' }}>
                {player.isAlive ? '✅ 生存' : '💀 死亡'}
              </div>
              {player.isCPU && (
                <div style={{ fontSize: '12px', marginTop: '4px' }}>
                  🤖 CPU
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ 
        display: 'flex', 
        gap: '16px', 
        justifyContent: 'center',
        marginTop: '40px'
      }}>
        <button 
          onClick={onPlayAgain}
          className="success"
          style={{ padding: '16px 32px', fontSize: '18px' }}
        >
          もう一度プレイ
        </button>
        <button 
          onClick={onLeave}
          className="secondary"
          style={{ padding: '16px 32px', fontSize: '18px' }}
        >
          ホームに戻る
        </button>
      </div>

      <div style={{ 
        marginTop: '40px',
        padding: '20px',
        background: '#f8f9fa',
        borderRadius: '12px'
      }}>
        <h3>ゲーム統計</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#667eea' }}>
              {players.filter(p => p.isAlive).length}
            </div>
            <div>生存者数</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#dc3545' }}>
              {players.filter(p => !p.isAlive).length}
            </div>
            <div>死亡者数</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default GameOver;
