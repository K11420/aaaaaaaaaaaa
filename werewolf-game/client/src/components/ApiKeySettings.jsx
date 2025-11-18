import { useState, useEffect } from 'react';

function ApiKeySettings() {
  const [apiKey, setApiKey] = useState('');
  const [isInitialized, setIsInitialized] = useState(false);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    checkApiStatus();
  }, []);

  const checkApiStatus = async () => {
    try {
      const apiUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/gemini/status`);
      const data = await response.json();
      
      setIsInitialized(data.isInitialized);
      setMessage(data.message);
    } catch (error) {
      console.error('API status check error:', error);
      setMessage('APIステータスの確認に失敗しました');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!apiKey.trim()) {
      setMessage('APIキーを入力してください');
      return;
    }

    setIsLoading(true);
    setMessage('');

    try {
      const apiUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';
      const response = await fetch(`${apiUrl}/api/gemini/set-api-key`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ apiKey })
      });

      const data = await response.json();

      if (data.success) {
        setIsInitialized(true);
        setMessage('✅ Gemini APIキーが設定されました！CPUプレイヤーがAIを使用します。');
        setApiKey('');
      } else {
        setMessage(`❌ エラー: ${data.error}`);
      }
    } catch (error) {
      console.error('API key setup error:', error);
      setMessage('❌ APIキーの設定に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '24px',
      borderRadius: '12px',
      marginBottom: '20px',
      color: 'white'
    }}>
      <h3 style={{ color: 'white', marginBottom: '16px' }}>
        🤖 Gemini AI設定
      </h3>

      <div style={{
        background: 'rgba(255, 255, 255, 0.2)',
        padding: '16px',
        borderRadius: '8px',
        marginBottom: '16px'
      }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          marginBottom: '8px',
          fontSize: '14px'
        }}>
          <span style={{ 
            display: 'inline-block',
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            background: isInitialized ? '#4ade80' : '#fbbf24',
            marginRight: '8px'
          }}></span>
          <strong>状態:</strong> {isInitialized ? 'AI有効' : 'AI無効（デフォルトロジック使用）'}
        </div>
        {message && (
          <div style={{ fontSize: '14px', marginTop: '8px' }}>
            {message}
          </div>
        )}
      </div>

      {!isInitialized && (
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '8px',
              fontSize: '14px',
              fontWeight: '600'
            }}>
              Google Gemini APIキー
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIzaSy..."
                style={{
                  width: '100%',
                  padding: '12px',
                  paddingRight: '100px',
                  borderRadius: '8px',
                  border: '2px solid rgba(255, 255, 255, 0.3)',
                  background: 'rgba(255, 255, 255, 0.9)',
                  color: '#333',
                  fontSize: '14px'
                }}
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  padding: '6px 12px',
                  fontSize: '12px',
                  background: 'rgba(255, 255, 255, 0.8)',
                  color: '#667eea'
                }}
              >
                {showKey ? '👁️ 非表示' : '👁️ 表示'}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            style={{
              width: '100%',
              padding: '12px',
              background: 'white',
              color: '#667eea',
              fontWeight: '600',
              opacity: isLoading ? 0.7 : 1
            }}
          >
            {isLoading ? '設定中...' : 'APIキーを設定'}
          </button>
        </form>
      )}

      <div style={{
        marginTop: '16px',
        padding: '12px',
        background: 'rgba(255, 255, 255, 0.1)',
        borderRadius: '8px',
        fontSize: '13px',
        lineHeight: '1.6'
      }}>
        <strong>ℹ️ Gemini APIについて:</strong>
        <ul style={{ marginLeft: '20px', marginTop: '8px' }}>
          <li>Gemini APIを使用すると、CPUプレイヤーがより自然で戦略的な発言・判断をします</li>
          <li>APIキーは <a href="https://makersuite.google.com/app/apikey" target="_blank" rel="noopener noreferrer" style={{ color: '#fbbf24', textDecoration: 'underline' }}>Google AI Studio</a> で無料取得可能</li>
          <li>設定しない場合、デフォルトのシンプルなAIロジックを使用します</li>
        </ul>
      </div>
    </div>
  );
}

export default ApiKeySettings;
