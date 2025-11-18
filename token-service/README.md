# 東京都AI トークン取得サービス

Microsoftアカウントで自動ログインして、新しいチャットを作成し、Bearerトークンを自動取得するPythonサービスです。

## 🎯 概要

このサービスは、Playwrightを使用してブラウザを自動操作し、以下を実行します：

1. 東京都AIサイト（https://ai.metro.tokyo.lg.jp/chattomo/conversation）にアクセス
2. Microsoftアカウントでログイン
3. 新しいチャットを作成
4. ダミーメッセージを送信してネットワークリクエストを監視
5. Bearerトークンを抽出して返す

## 🚀 ローカル開発

### 1. 依存関係のインストール

```bash
cd token-service

# 仮想環境の作成（推奨）
python -m venv venv

# 仮想環境の有効化
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# パッケージのインストール
pip install -r requirements.txt

# Playwrightブラウザのインストール
playwright install chromium
```

### 2. 環境変数の設定

```bash
# .envファイルを作成
cp .env.example .env

# .envを編集（オプション）
PORT=8000
```

### 3. サーバー起動

```bash
# 開発サーバーを起動
python main.py

# または uvicorn で起動
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

サーバーが起動したら、http://localhost:8000 にアクセスしてください。

## 📡 APIエンドポイント

### ヘルスチェック

```
GET /health
```

レスポンス例：
```json
{
  "status": "healthy",
  "service": "token-service",
  "browser_ready": true
}
```

### トークン取得

```
POST /api/get-token
```

リクエストボディ：
```json
{
  "microsoft_email": "your-email@example.com",
  "microsoft_password": "your-password",
  "timeout": 60000
}
```

レスポンス例（成功）：
```json
{
  "success": true,
  "token": "AJ9NFBtmru2lukLtEZLz9R5kuLs0Z3adMj0bRdpDi2FlQMMKr4pPao45t4Ng",
  "session_id": null
}
```

レスポンス例（失敗）：
```json
{
  "success": false,
  "token": null,
  "session_id": null,
  "error": "タイムアウト",
  "details": "処理がタイムアウトしました"
}
```

## 🚢 デプロイ

### Railway へのデプロイ

1. **Railwayアカウントを作成**: https://railway.app/

2. **GitHubリポジトリに接続**:
   ```bash
   # このディレクトリをGitリポジトリのルートに配置
   git add token-service/
   git commit -m "Add token service"
   git push
   ```

3. **Railwayでプロジェクトを作成**:
   - Railway ダッシュボード → New Project
   - Deploy from GitHub repo を選択
   - リポジトリを選択
   - Root Directory を `token-service` に設定

4. **環境変数を設定**（オプション）:
   - PORT: 8000（自動設定される）

5. **デプロイ**:
   - 自動的にDockerfileが検出されてビルドされます

### Render.com へのデプロイ

1. **Render.comアカウントを作成**: https://render.com/

2. **GitHubリポジトリに接続**

3. **New Web Service を作成**:
   - Repository を選択
   - Root Directory を `token-service` に設定
   - Environment: Docker
   - Plan: Free

4. **環境変数を設定**:
   - PORT: 8000

5. **デプロイ**:
   - Create Web Service をクリック

## 🔧 使い方

### curlでテスト

```bash
# トークン取得
curl -X POST http://localhost:8000/api/get-token \
  -H "Content-Type: application/json" \
  -d '{
    "microsoft_email": "your-email@example.com",
    "microsoft_password": "your-password"
  }'
```

### Pythonクライアント例

```python
import requests

response = requests.post(
    'http://localhost:8000/api/get-token',
    json={
        'microsoft_email': 'your-email@example.com',
        'microsoft_password': 'your-password',
        'timeout': 60000
    }
)

if response.status_code == 200:
    data = response.json()
    if data['success']:
        print(f"Token: {data['token']}")
    else:
        print(f"Error: {data['error']}")
```

### JavaScriptクライアント例

```javascript
const response = await fetch('http://localhost:8000/api/get-token', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    microsoft_email: 'your-email@example.com',
    microsoft_password: 'your-password',
    timeout: 60000
  })
});

const data = await response.json();
if (data.success) {
  console.log('Token:', data.token);
} else {
  console.error('Error:', data.error);
}
```

## ⚙️ 設定

### タイムアウト

デフォルトのタイムアウトは60秒です。リクエスト時に変更できます：

```json
{
  "microsoft_email": "your-email@example.com",
  "microsoft_password": "your-password",
  "timeout": 120000
}
```

### ヘッドレスモード

本番環境では自動的にヘッドレスモードで実行されます。

開発中に画面を表示したい場合は、`main.py`を編集：

```python
browser_instance = await playwright_instance.chromium.launch(
    headless=False,  # Falseに変更
    # ...
)
```

## 🐛 トラブルシューティング

### Playwrightがインストールできない

```bash
# システムの依存関係をインストール
playwright install-deps chromium

# Chromiumを再インストール
playwright install chromium
```

### ログイン失敗

- Microsoftアカウントの認証情報が正しいか確認
- 2段階認証が有効な場合は無効化するか、アプリパスワードを使用
- タイムアウト時間を増やす（120秒など）

### タイムアウトエラー

```json
{
  "timeout": 120000
}
```

### メモリ不足エラー

Dockerコンテナのメモリを増やす：

```bash
# docker-compose.yml
services:
  token-service:
    mem_limit: 2g
```

## 📊 パフォーマンス

- **初回トークン取得**: 約30-60秒
- **2回目以降**: ブラウザを再利用するため高速化（約20-40秒）
- **同時リクエスト**: 推奨最大3-5並列

## 🔒 セキュリティ

⚠️ **重要**:
- Microsoftアカウントの認証情報は安全に管理してください
- 本番環境では環境変数やSecrets管理を使用
- APIへのアクセスを制限（CORS、認証など）

## 📝 ライセンス

MIT License

## 🙏 謝辞

- [Playwright](https://playwright.dev/) - ブラウザ自動化
- [FastAPI](https://fastapi.tiangolo.com/) - Webフレームワーク
