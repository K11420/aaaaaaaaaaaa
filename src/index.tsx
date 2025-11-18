/**
 * 東京都AI チャット プロキシAPI
 * Hono バックエンドサーバー
 * 
 * このサーバーは、東京都AI APIへのプロキシとして機能し、
 * フロントエンドからのリクエストを適切に処理します。
 */

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'
import { streamSSE } from 'hono/streaming'

type Bindings = {
  TOKYO_AI_BEARER_TOKEN?: string;
  TOKEN_SERVICE_URL?: string;
  MICROSOFT_EMAIL?: string;
  MICROSOFT_PASSWORD?: string;
}

const app = new Hono<{ Bindings: Bindings }>()

// CORS設定
app.use('/api/*', cors({
  origin: '*', // 本番環境では特定のドメインに制限してください
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}))

// 静的ファイルの配信
app.use('/static/*', serveStatic({ root: './public' }))

// 設定
const TOKYO_AI_API_URL = 'https://ai-api.metro.tokyo.lg.jp/api/v1/chat/message'

// トークンキャッシュ（メモリ内）
let cachedToken: string | null = null
let tokenExpiry: number | null = null

// ========================================
// トークン取得ヘルパー関数
// ========================================
async function getBearerToken(env: Bindings): Promise<string> {
  // 1. キャッシュされたトークンをチェック
  if (cachedToken && tokenExpiry && Date.now() < tokenExpiry) {
    console.log('✅ キャッシュされたトークンを使用')
    return cachedToken
  }

  // 2. 環境変数から直接取得
  if (env.TOKYO_AI_BEARER_TOKEN) {
    console.log('✅ 環境変数からトークンを取得')
    cachedToken = env.TOKYO_AI_BEARER_TOKEN
    tokenExpiry = Date.now() + (24 * 60 * 60 * 1000) // 24時間
    return cachedToken
  }

  // 3. トークンサービスから自動取得
  if (env.TOKEN_SERVICE_URL && env.MICROSOFT_EMAIL && env.MICROSOFT_PASSWORD) {
    console.log('🔄 トークンサービスから新しいトークンを取得中...')
    
    try {
      const response = await fetch(`${env.TOKEN_SERVICE_URL}/api/get-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          microsoft_email: env.MICROSOFT_EMAIL,
          microsoft_password: env.MICROSOFT_PASSWORD,
          timeout: 60000
        })
      })

      if (!response.ok) {
        throw new Error(`トークンサービスエラー: ${response.status}`)
      }

      const data = await response.json()
      
      if (data.success && data.token) {
        console.log('✅ トークンサービスからトークンを取得成功')
        cachedToken = data.token
        tokenExpiry = Date.now() + (24 * 60 * 60 * 1000) // 24時間
        return cachedToken
      } else {
        throw new Error(data.error || 'トークン取得失敗')
      }
    } catch (error) {
      console.error('❌ トークンサービスエラー:', error)
      throw new Error(`トークンサービスからの取得に失敗: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  throw new Error('Bearer トークンが設定されていません。環境変数またはトークンサービスの設定を確認してください')
}

// ========================================
// ヘルスチェックエンドポイント
// ========================================
app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: '東京都AI チャット プロキシAPI',
    version: '1.0.0'
  })
})

// ========================================
// チャットAPI（非ストリーミング）
// ========================================
app.post('/api/chat', async (c) => {
  try {
    const reqBody = await c.req.json()
    const { sessionId, message, model = '1', isStream = false } = reqBody

    // Bearer トークンの取得（自動取得対応）
    let bearerToken: string
    try {
      bearerToken = await getBearerToken(c.env)
    } catch (error) {
      return c.json({ 
        error: 'Bearer トークンの取得に失敗しました',
        details: error instanceof Error ? error.message : String(error)
      }, 500)
    }

    console.log('📤 リクエストパラメータ:', { sessionId, message, model, isStream })

    // Cloudflare Workers環境でFormDataのboundary問題を回避するため、
    // 手動でmultipart/form-dataを構築
    const boundary = `----WebKitFormBoundary${Math.random().toString(36).substring(2)}`
    const parts = []
    
    // 各フィールドを追加
    parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="id"\r\n\r\n${sessionId}\r\n`)
    parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="message[content]"\r\n\r\n${message}\r\n`)
    parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="is_stream"\r\n\r\n${isStream ? '1' : '0'}\r\n`)
    parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\n${model}\r\n`)
    parts.push(`--${boundary}--\r\n`)
    
    const multipartBody = parts.join('')

    // 東京都AI APIへのリクエスト
    const response = await fetch(TOKYO_AI_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${bearerToken}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Referer': 'https://ai.metro.tokyo.lg.jp/',
        'Origin': 'https://ai.metro.tokyo.lg.jp',
      },
      body: multipartBody,
    })
    
    console.log('📥 レスポンス受信:', response.status, response.statusText)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('東京都AI API エラー:', response.status, errorText)
      return c.json({ 
        error: 'AI APIからのレスポンスエラー',
        status: response.status,
        details: errorText 
      }, response.status)
    }

    const data = await response.json()
    return c.json(data)

  } catch (error) {
    console.error('チャットAPI エラー:', error)
    return c.json({ 
      error: 'サーバーエラーが発生しました',
      details: error instanceof Error ? error.message : String(error)
    }, 500)
  }
})

// ========================================
// チャットAPI（ストリーミング）
// ========================================
app.post('/api/chat/stream', async (c) => {
  try {
    const reqBody = await c.req.json()
    const { sessionId, message, model = '1' } = reqBody

    // Bearer トークンの取得（自動取得対応）
    let bearerToken: string
    try {
      bearerToken = await getBearerToken(c.env)
    } catch (error) {
      return c.json({ 
        error: 'Bearer トークンの取得に失敗しました',
        details: error instanceof Error ? error.message : String(error)
      }, 500)
    }

    console.log('📤 ストリーミングリクエスト:', { sessionId, message, model })

    // Cloudflare Workers環境でFormDataのboundary問題を回避するため、
    // 手動でmultipart/form-dataを構築
    const boundary = `----WebKitFormBoundary${Math.random().toString(36).substring(2)}`
    const parts = []
    
    // 各フィールドを追加
    parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="id"\r\n\r\n${sessionId}\r\n`)
    parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="message[content]"\r\n\r\n${message}\r\n`)
    parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="is_stream"\r\n\r\n1\r\n`)
    parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\n${model}\r\n`)
    parts.push(`--${boundary}--\r\n`)
    
    const multipartBody = parts.join('')

    // 東京都AI APIへのリクエスト
    const response = await fetch(TOKYO_AI_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${bearerToken}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Referer': 'https://ai.metro.tokyo.lg.jp/',
        'Origin': 'https://ai.metro.tokyo.lg.jp',
      },
      body: multipartBody,
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('東京都AI API エラー:', response.status, errorText)
      return c.json({ 
        error: 'AI APIからのレスポンスエラー',
        status: response.status,
        details: errorText 
      }, response.status)
    }

    // ストリーミングレスポンス
    return streamSSE(c, async (stream) => {
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        await stream.writeSSE({
          data: JSON.stringify({ error: 'ストリームの取得に失敗しました' }),
          event: 'error'
        })
        return
      }

      try {
        while (true) {
          const { done, value } = await reader.read()
          
          if (done) {
            await stream.writeSSE({
              data: JSON.stringify({ done: true }),
              event: 'done'
            })
            break
          }

          const chunk = decoder.decode(value, { stream: true })
          const lines = chunk.split('\n')

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim()
              
              if (data === '[DONE]') {
                await stream.writeSSE({
                  data: JSON.stringify({ done: true }),
                  event: 'done'
                })
                continue
              }

              try {
                const parsed = JSON.parse(data)
                await stream.writeSSE({
                  data: JSON.stringify(parsed),
                  event: 'message'
                })
              } catch (e) {
                // JSON パースエラーは無視
                console.warn('JSON パースエラー:', data)
              }
            }
          }
        }
      } catch (error) {
        console.error('ストリーミングエラー:', error)
        await stream.writeSSE({
          data: JSON.stringify({ 
            error: 'ストリーミング中にエラーが発生しました',
            details: error instanceof Error ? error.message : String(error)
          }),
          event: 'error'
        })
      } finally {
        reader.releaseLock()
      }
    })

  } catch (error) {
    console.error('チャットストリームAPI エラー:', error)
    return c.json({ 
      error: 'サーバーエラーが発生しました',
      details: error instanceof Error ? error.message : String(error)
    }, 500)
  }
})

// ========================================
// デフォルトルート（フロントエンド）
// ========================================
app.get('/', (c) => {
  return c.html(`<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>東京都AI チャット</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css">
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/static/style.css">
</head>
<body>
    <div class="container">
        <!-- ヘッダー -->
        <header class="chat-header">
            <div class="header-content">
                <div class="logo">
                    <i class="fas fa-robot"></i>
                    <h1>東京都AI アシスタント</h1>
                </div>
                <div class="header-info">
                    <span class="status-indicator" id="statusIndicator">
                        <i class="fas fa-circle"></i> オンライン
                    </span>
                </div>
            </div>
        </header>

        <!-- メインコンテナ -->
        <div class="chat-container">
            <!-- サイドバー -->
            <aside class="sidebar">
                <div class="sidebar-header">
                    <h2><i class="fas fa-cog"></i> 設定</h2>
                </div>
                <div class="sidebar-content">
                    <!-- モデル選択 -->
                    <div class="setting-group">
                        <label for="modelSelect">
                            <i class="fas fa-brain"></i> AIモデル
                        </label>
                        <select id="modelSelect" class="model-select">
                            <option value="1">モデル 1</option>
                            <option value="2">モデル 2</option>
                            <option value="3">モデル 3</option>
                            <option value="4">モデル 4</option>
                        </select>
                    </div>

                    <!-- ストリーミング切り替え -->
                    <div class="setting-group">
                        <label class="toggle-label">
                            <input type="checkbox" id="streamToggle" checked>
                            <span class="toggle-slider"></span>
                            <span class="toggle-text">
                                <i class="fas fa-stream"></i> ストリーミング
                            </span>
                        </label>
                    </div>

                    <!-- チャットクリア -->
                    <button id="clearChat" class="btn-clear">
                        <i class="fas fa-trash"></i> チャットをクリア
                    </button>
                </div>
            </aside>

            <!-- チャットエリア -->
            <main class="chat-main">
                <!-- メッセージ表示エリア -->
                <div class="messages-container" id="chatMessages">
                    <div class="welcome-message">
                        <i class="fas fa-comments"></i>
                        <h2>東京都AI アシスタントへようこそ</h2>
                        <p>何でもお気軽にお尋ねください</p>
                    </div>
                </div>

                <!-- 入力エリア -->
                <div class="input-container">
                    <div class="input-wrapper">
                        <textarea 
                            id="messageInput" 
                            placeholder="メッセージを入力してください..."
                            rows="1"
                        ></textarea>
                        <div class="input-actions">
                            <span class="char-count" id="charCount">0 / 5000</span>
                            <button id="sendButton" class="btn-send">
                                <i class="fas fa-paper-plane"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    </div>

    <script src="/static/app.js"></script>
</body>
</html>`)
})

export default app
