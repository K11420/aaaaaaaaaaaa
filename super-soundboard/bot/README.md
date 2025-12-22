# Super Soundboard Bot

Discord ボイスチャンネルで発言を認識し、キーワードに応じてサウンドを自動再生するBotです。

## 必要環境

- Node.js 18以上
- Python 3.10以上
- NVIDIA GPU（推奨、CUDAサポート）
- ffmpeg

## セットアップ手順

### 1. Node.js依存関係インストール

```bash
cd ~/webapp/super-soundboard/bot
npm install
```

### 2. Python仮想環境作成 & 依存関係インストール

```bash
# 仮想環境作成
python3 -m venv venv

# 仮想環境有効化
source venv/bin/activate

# GPU版PyTorchインストール（CUDA 12.x用）
pip install torch --index-url https://download.pytorch.org/whl/cu121

# faster-whisperインストール（高速版）
pip install faster-whisper

# 仮想環境を抜ける（任意）
deactivate
```

### 3. 環境変数設定

```bash
# Discord Bot Token（必須）
export DISCORD_TOKEN=あなたのDiscordBotトークン

# 音声認識エンジン設定
export STT_ENGINE=whisper          # whisper, google, none
export WHISPER_MODEL=base          # tiny, base, small, medium, large
export WHISPER_DEVICE=cuda         # cuda, cpu
export WHISPER_LANGUAGE=ja         # 言語コード

# Google Cloud使用時（オプション）
export GOOGLE_APPLICATION_CREDENTIALS=./google-credentials.json
```

### 4. Bot起動

```bash
# 仮想環境を有効化してから起動
source venv/bin/activate

# Bot起動（環境変数を設定済みの場合）
node index.js

# または環境変数を直接指定
DISCORD_TOKEN=xxx STT_ENGINE=whisper WHISPER_MODEL=base WHISPER_DEVICE=cuda node index.js
```

## 起動コマンド例

### GPU使用（faster-whisper）
```bash
cd ~/webapp/super-soundboard/bot
source venv/bin/activate
DISCORD_TOKEN=あなたのトークン \
STT_ENGINE=whisper \
WHISPER_MODEL=base \
WHISPER_DEVICE=cuda \
node index.js
```

### CPU使用（遅い）
```bash
DISCORD_TOKEN=あなたのトークン \
STT_ENGINE=whisper \
WHISPER_MODEL=tiny \
WHISPER_DEVICE=cpu \
node index.js
```

### Google Cloud Speech使用（リアルタイム）
```bash
DISCORD_TOKEN=あなたのトークン \
STT_ENGINE=google \
GOOGLE_APPLICATION_CREDENTIALS=./google-credentials.json \
node index.js
```

## Discordコマンド

### スラッシュコマンド（推奨）

| コマンド | 説明 |
|----------|------|
| `/join` | ボイスチャンネルに参加 |
| `/leave` | ボイスチャンネルから退出 |
| `/sounds` | 登録済みサウンド一覧 |
| `/add` | サウンドを追加（キーワード + ファイル添付） |
| `/edit` | キーワードを編集（旧キーワード → 新キーワード） |
| `/delete` | サウンドを削除 |
| `/play` | サウンドを手動再生 |
| `/help` | ヘルプ表示 |

### テキストコマンド（従来互換）

| コマンド | 説明 |
|----------|------|
| `!join` | ボイスチャンネルに参加 |
| `!leave` | ボイスチャンネルから退出 |
| `!sounds` | 登録済みサウンド一覧 |
| `!edit 旧 新` | キーワードを編集 |
| `!delete キーワード` | サウンドを削除 |
| `!help` | ヘルプ表示 |
| `トリガ:キーワード` + ファイル添付 | サウンドを登録 |

## サウンド登録

### スラッシュコマンドで登録（推奨）
```
/add keyword:やったー file:（音声ファイルを選択）
```

### テキストで登録
Discordのテキストチャンネルで：
```
トリガ:キーワード
```
と入力し、音声ファイル（MP3, WAV, OGG, M4A）を添付して送信。

例：`トリガ:やったー` + 音声ファイル添付

## キーワード編集

### スラッシュコマンドで編集（推奨）
```
/edit old_keyword:旧キーワード new_keyword:新キーワード
```
オートコンプリートで既存のキーワードが表示されます。

### テキストで編集
```
!edit 旧キーワード 新キーワード
```

## 処理速度目安

| 方式 | 処理時間 |
|------|----------|
| faster-whisper (GPU) | 300-500ms |
| Whisper (GPU) | 1-2秒 |
| Whisper (CPU) | 10-20秒 |
| Google Cloud Speech | リアルタイム |

## トラブルシューティング

### nvidia-smiがエラー
```bash
# ドライバ再インストール
sudo apt install --reinstall nvidia-driver-535
sudo reboot
```

### faster-whisperが遅い
- GPUが使われているか確認: `nvidia-smi` でGPU使用率を確認
- モデルを小さくする: `WHISPER_MODEL=tiny`

### 音声が認識されない
- ffmpegがインストールされているか確認: `ffmpeg -version`
- Botがボイスチャンネルに参加しているか確認
