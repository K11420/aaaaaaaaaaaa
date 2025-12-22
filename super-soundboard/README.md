# Super Soundboard

Discord連携対応のスーパーサウンドボード。ボイスチャンネルでキーワードを話すと自動でサウンドが再生されます。

## 機能

### Discord Bot機能
- **音声認識**: ボイスチャンネルの音声をWhisperで認識し、キーワードを検出
- **自動再生**: キーワード検出時に自動でサウンドを再生
- **カスタム音源登録**: Discordメッセージで音源ファイルを添付して登録
- **プリセットサウンド**: 10種類のプリセット（やばい、すごい、草、など）

### Webアプリ機能
- **ブラウザ音声認識**: Web Speech APIによるリアルタイム音声認識
- **サウンドボード**: クリックで手動再生
- **Discord連携**: WebSocket経由でBotと連携し、ボイスチャンネルで再生

## セットアップ

### 1. 依存関係のインストール

```bash
# Botディレクトリ
cd bot
npm install

# Whisperのインストール（音声認識用）
python3 -m venv venv
source venv/bin/activate
pip install openai-whisper

# Webアプリ
cd ..
npm install
```

### 2. Discord Botの設定

1. [Discord Developer Portal](https://discord.com/developers/applications) でアプリを作成
2. Botセクションで以下を有効化:
   - **MESSAGE CONTENT INTENT**
   - **SERVER MEMBERS INTENT** 
3. OAuth2 > URL Generator で以下を選択:
   - Scopes: `bot`
   - Permissions: `Connect`, `Speak`, `Read Messages/View Channels`
4. 生成されたURLでBotをサーバーに招待

### 3. Botの起動

```bash
cd bot
DISCORD_TOKEN=あなたのトークン node index.js
```

### 4. Webアプリの起動

```bash
npm run build
npm run preview -- --host 0.0.0.0 --port 4103
```

## Discord コマンド

| コマンド | 説明 |
|---------|------|
| `!join` | ボイスチャンネルに参加（音声認識開始） |
| `!leave` | ボイスチャンネルから退出 |
| `!sounds` | 登録済みサウンド一覧 |
| `!delete キーワード` | カスタムサウンドを削除 |
| `!help` | ヘルプを表示 |

## Discordで音源を登録する

1. Discordのテキストチャンネルで以下の形式でメッセージを送信：
   ```
   トリガ:キーワード
   ```
2. MP3/WAV/OGG/M4Aファイルを添付

**例:**
```
トリガ:やったー
```
（音声ファイルを添付）

→ ボイスチャンネルで「やったー」と言うとサウンドが再生されます！

## プリセットサウンド

| キーワード | サウンド |
|-----------|---------|
| やばい、やべー | やばい！ |
| すごい、すげー | すごい！ |
| 草、わろた | 草www |
| 大丈夫 | 大丈夫だ、問題ない |
| ナイス、いいね | ナイス！ |
| 失敗、ミス | 失敗... |
| 勝った、勝利 | 勝利！ |
| 負けた | 敗北... |
| ありがとう | ありがとう |
| ペイペイ | PayPay♪ |

## 技術スタック

- **Bot**: discord.js, @discordjs/voice, prism-media
- **音声認識**: OpenAI Whisper (ローカル)
- **Webアプリ**: TypeScript, Vite, Web Speech API
- **ストレージ**: IndexedDB (Web), JSON (Bot)

## Cloudflare Tunnel

公開URLで利用する場合：

```bash
# Webアプリ
./cloudflared tunnel --url http://localhost:4103

# WebSocket (Bot連携用)
./cloudflared tunnel --url http://localhost:8765
```

## ポート

| ポート | 用途 |
|-------|------|
| 4103 | Webアプリ |
| 8765 | WebSocket Server |
| 8766 | HTTP API (ステータス確認用) |

## ライセンス

MIT
