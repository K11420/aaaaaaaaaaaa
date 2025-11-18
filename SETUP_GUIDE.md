# 🚀 東京都AI チャットサイト - 詳細セットアップガイド

このガイドでは、プロジェクトのセットアップからデプロイまでの詳細な手順を説明します。

## 📋 目次

1. [必要な環境](#必要な環境)
2. [Bearer トークンの取得](#bearer-トークンの取得)
3. [ローカル開発環境のセットアップ](#ローカル開発環境のセットアップ)
4. [開発サーバーの起動](#開発サーバーの起動)
5. [Cloudflare Pagesへのデプロイ](#cloudflare-pagesへのデプロイ)
6. [トラブルシューティング](#トラブルシューティング)
7. [高度な設定](#高度な設定)

---

## 🔧 必要な環境

### 必須要件
- **Node.js** 18.0.0 以上
- **npm** 9.0.0 以上（または yarn）
- **Git**
- **Cloudflareアカウント**（デプロイ時のみ）

### 推奨環境
- **OS**: macOS, Linux, Windows (WSL2推奨)
- **エディタ**: VS Code, WebStorm, Cursor
- **ブラウザ**: Chrome, Firefox, Safari, Edge（開発者ツールが使える最新版）

### インストール確認

```bash
# Node.jsのバージョン確認
node --version
# 出力例: v20.10.0

# npmのバージョン確認
npm --version
# 出力例: 10.2.3

# Gitのバージョン確認
git --version
# 出力例: git version 2.42.0
```

---

## 🔑 Bearer トークンの取得

東京都AI APIを使用するには、Bearer トークンが必要です。以下の手順で取得してください。

### ステップ1: 東京都AIサイトにアクセス

1. ブラウザで以下のURLにアクセス：
   ```
   https://ai.metro.tokyo.lg.jp/chattomo/conversation
   ```

2. ログインが必要な場合は、ログインしてください

### ステップ2: 開発者ツールを開く

- **Windows/Linux**: `F12` または `Ctrl + Shift + I`
- **macOS**: `Cmd + Option + I`

### ステップ3: ネットワークタブを選択

開発者ツールの上部にある「ネットワーク」または「Network」タブをクリックします。

### ステップ4: チャットでメッセージを送信

何でも良いので、チャット画面でメッセージを1つ送信します。

例: 「こんにちは」

### ステップ5: `chat/message` リクエストを探す

ネットワークタブに表示されるリクエスト一覧から、以下のようなURLを含むリクエストを見つけます：

```
https://ai-api.metro.tokyo.lg.jp/api/v1/chat/message
```

### ステップ6: リクエストヘッダーを確認

1. 見つけたリクエストをクリック
2. 「ヘッダー」または「Headers」タブを開く
3. 「リクエストヘッダー」セクションを探す
4. `Authorization` という項目を見つける

以下のような形式で表示されます：

```
Authorization: Bearer AJ9NFBtmru2lukLtEZLz9R5kuLs0Z3adMj0bRdpDi2FlQMMKr4pPao45t4Ng
```

### ステップ7: Bearer トークンをコピー

`Bearer ` の後ろの長い文字列（トークン）をコピーします。

**例**: `AJ9NFBtmru2lukLtEZLz9R5kuLs0Z3adMj0bRdpDi2FlQMMKr4pPao45t4Ng`

⚠️ **注意**: 
- トークンは定期的に期限切れになります
- 期限切れになった場合は、再度この手順でトークンを取得してください
- トークンは機密情報なので、公開リポジトリにコミットしないでください

---

## 💻 ローカル開発環境のセットアップ

### ステップ1: プロジェクトのクローン

```bash
# GitHubからクローン（URLは実際のリポジトリURLに置き換えてください）
git clone <repository-url>
cd webapp
```

または、プロジェクトを新規作成する場合：

```bash
# 新しいディレクトリを作成
mkdir tokyo-ai-chat
cd tokyo-ai-chat

# Gitリポジトリを初期化
git init
```

### ステップ2: 依存関係のインストール

```bash
# npm を使用する場合
npm install

# yarn を使用する場合
yarn install
```

インストールには数分かかる場合があります。

### ステップ3: 環境変数の設定

プロジェクトルートに `.dev.vars` ファイルを作成します：

```bash
# .dev.vars ファイルを作成
touch .dev.vars
```

`.dev.vars` ファイルに以下を追加（取得したBearerトークンを設定）：

```env
# 東京都AI API Bearer Token
TOKYO_AI_BEARER_TOKEN=your-bearer-token-here
```

**例**:
```env
TOKYO_AI_BEARER_TOKEN=AJ9NFBtmru2lukLtEZLz9R5kuLs0Z3adMj0bRdpDi2FlQMMKr4pPao45t4Ng
```

⚠️ **重要**: `.dev.vars` ファイルは `.gitignore` に含まれているため、Gitにコミットされません。

### ステップ4: プロジェクトのビルド

```bash
npm run build
```

成功すると、`dist/` ディレクトリが作成されます。

---

## 🚀 開発サーバーの起動

### 方法1: Wrangler を使用（推奨）

```bash
# ポート3000で開発サーバーを起動
npm run dev:sandbox
```

または直接：

```bash
npx wrangler pages dev dist --ip 0.0.0.0 --port 3000
```

### 方法2: PM2 を使用（サンドボックス環境用）

```bash
# PM2で開発サーバーを起動
pm2 start ecosystem.config.cjs

# ログを確認
pm2 logs tokyo-ai-chat

# サーバーを停止
pm2 stop tokyo-ai-chat

# サーバーを再起動
pm2 restart tokyo-ai-chat
```

### アクセス確認

ブラウザで以下のURLにアクセスしてください：

- **メインページ**: http://localhost:3000
- **ヘルスチェック**: http://localhost:3000/health

ヘルスチェックで以下のようなJSONが表示されれば成功です：

```json
{
  "status": "healthy",
  "timestamp": "2025-11-10T01:45:58.088Z",
  "service": "東京都AI チャット プロキシAPI",
  "version": "1.0.0"
}
```

---

## 🌐 Cloudflare Pagesへのデプロイ

### ステップ1: Cloudflareアカウントの作成

1. https://dash.cloudflare.com/sign-up にアクセス
2. アカウントを作成（無料プランで十分です）
3. メールアドレスを確認

### ステップ2: Wranglerのセットアップ

```bash
# Wranglerにログイン
npx wrangler login
```

ブラウザが開き、Cloudflareへのログインを求められます。ログイン後、ターミナルに戻ります。

### ステップ3: Bearer トークンをSecretとして設定

```bash
# プロジェクト名を確認（wrangler.jsonc の name フィールド）
# デフォルトは "tokyo-ai-chat"

# Secretを設定
npx wrangler pages secret put TOKYO_AI_BEARER_TOKEN --project-name tokyo-ai-chat
```

プロンプトが表示されたら、Bearer トークンを入力してEnterを押します。

⚠️ **注意**: 入力中、トークンは表示されません（セキュリティのため）

### ステップ4: Cloudflare Pagesプロジェクトの作成

```bash
# Pagesプロジェクトを作成
npx wrangler pages project create tokyo-ai-chat --production-branch main
```

### ステップ5: デプロイ

```bash
# ビルドしてデプロイ
npm run deploy:prod
```

または：

```bash
# 手動でビルドしてデプロイ
npm run build
npx wrangler pages deploy dist --project-name tokyo-ai-chat
```

デプロイが完了すると、以下のようなURLが表示されます：

```
✨ Deployment complete!
🚀 https://tokyo-ai-chat.pages.dev
```

### ステップ6: カスタムドメインの設定（オプション）

1. Cloudflareダッシュボードにアクセス
2. 「Pages」→ プロジェクト名（tokyo-ai-chat）を選択
3. 「Custom domains」タブを開く
4. 「Set up a custom domain」をクリック
5. ドメイン名を入力して設定

---

## 🐛 トラブルシューティング

### 1. Bearer トークンエラー

**エラーメッセージ**:
```
Bearer トークンが設定されていません
```

**原因**:
- `.dev.vars` ファイルが存在しない
- `.dev.vars` にトークンが設定されていない
- 本番環境でSecretが設定されていない

**解決方法**:

**ローカル開発の場合**:
```bash
# .dev.vars ファイルを確認
cat .dev.vars

# ファイルが存在しない場合は作成
echo "TOKYO_AI_BEARER_TOKEN=your-token-here" > .dev.vars

# サーバーを再起動
pm2 restart tokyo-ai-chat
```

**本番環境の場合**:
```bash
# Secretを設定
npx wrangler pages secret put TOKYO_AI_BEARER_TOKEN --project-name tokyo-ai-chat

# 再デプロイ
npm run deploy:prod
```

### 2. ポート衝突エラー

**エラーメッセージ**:
```
Error: Port 3000 is already in use
```

**解決方法**:

**Linux/macOS**:
```bash
# ポートを使用しているプロセスを終了
fuser -k 3000/tcp

# または npm スクリプトを使用
npm run clean-port
```

**Windows**:
```powershell
# ポートを使用しているプロセスを確認
netstat -ano | findstr :3000

# プロセスIDを確認して終了
taskkill /PID <process_id> /F
```

### 3. ビルドエラー

**エラーメッセージ**:
```
Error: Cannot find module 'xxx'
```

**解決方法**:
```bash
# node_modules を削除して再インストール
rm -rf node_modules package-lock.json
npm install

# ビルドを再実行
npm run build
```

### 4. CORS エラー

**エラーメッセージ**:
```
Access to fetch at '...' from origin '...' has been blocked by CORS policy
```

**原因**:
- バックエンドのCORS設定が正しくない
- オリジンが許可されていない

**解決方法**:

`src/index.tsx` のCORS設定を確認：

```typescript
app.use('/api/*', cors({
  origin: '*', // 開発環境では '*' でOK
  // 本番環境では特定のドメインに制限:
  // origin: 'https://your-domain.com',
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}))
```

### 5. Wranglerログインエラー

**エラーメッセージ**:
```
Error: Not logged in
```

**解決方法**:
```bash
# Wranglerからログアウト
npx wrangler logout

# 再度ログイン
npx wrangler login
```

### 6. デプロイエラー

**エラーメッセージ**:
```
Error: Project not found
```

**解決方法**:
```bash
# プロジェクトを作成
npx wrangler pages project create tokyo-ai-chat --production-branch main

# 再度デプロイ
npm run deploy:prod
```

### 7. トークン期限切れ

**症状**:
- APIからエラーレスポンスが返る
- チャットが正常に動作しない

**解決方法**:
1. [Bearer トークンの取得](#bearer-トークンの取得) の手順で新しいトークンを取得
2. `.dev.vars` ファイルを更新（ローカル開発）
3. Secretを更新（本番環境）:
   ```bash
   npx wrangler pages secret put TOKYO_AI_BEARER_TOKEN --project-name tokyo-ai-chat
   ```

---

## 🔧 高度な設定

### カスタムポートの使用

デフォルトではポート3000を使用しますが、変更できます：

```bash
# ポート8080で起動
npx wrangler pages dev dist --ip 0.0.0.0 --port 8080
```

`ecosystem.config.cjs` を編集：

```javascript
module.exports = {
  apps: [
    {
      name: 'tokyo-ai-chat',
      script: 'npx',
      args: 'wrangler pages dev dist --ip 0.0.0.0 --port 8080', // ポート変更
      env: {
        NODE_ENV: 'development',
        PORT: 8080 // ポート変更
      },
      // ...
    }
  ]
}
```

### 複数環境の管理

開発環境、ステージング環境、本番環境を分けたい場合：

```bash
# 開発環境用の .dev.vars
TOKYO_AI_BEARER_TOKEN=dev-token

# ステージング環境用の Secret
npx wrangler pages secret put TOKYO_AI_BEARER_TOKEN --project-name tokyo-ai-chat-staging --env staging

# 本番環境用の Secret
npx wrangler pages secret put TOKYO_AI_BEARER_TOKEN --project-name tokyo-ai-chat --env production
```

### ログレベルの変更

より詳細なログを表示したい場合：

```bash
# デバッグモードで起動
DEBUG=* npx wrangler pages dev dist --ip 0.0.0.0 --port 3000
```

### パフォーマンス最適化

#### 1. ビルドサイズの最適化

`vite.config.ts` で最適化設定を追加：

```typescript
import { defineConfig } from 'vite'
import pages from '@hono/vite-cloudflare-pages'

export default defineConfig({
  plugins: [pages()],
  build: {
    outDir: 'dist',
    minify: 'terser', // より強力な圧縮
    terserOptions: {
      compress: {
        drop_console: true, // console.logを削除
      },
    },
  },
})
```

#### 2. キャッシュの活用

Cloudflare Pagesは自動的に静的アセットをキャッシュしますが、追加の設定も可能です。

`wrangler.jsonc` でキャッシュ設定を追加：

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "tokyo-ai-chat",
  "compatibility_date": "2024-01-01",
  "pages_build_output_dir": "./dist",
  "compatibility_flags": ["nodejs_compat"],
  // キャッシュ設定（オプション）
  "routes": [
    {
      "pattern": "/static/*",
      "cache": {
        "cache_level": "cache_everything",
        "edge_ttl": 86400
      }
    }
  ]
}
```

### セキュリティ強化

#### 1. CORS を特定のドメインに制限

本番環境では、CORSを特定のドメインに制限することを強く推奨します：

`src/index.tsx` を編集：

```typescript
// 環境変数からオリジンを取得
const allowedOrigins = [
  'https://tokyo-ai-chat.pages.dev',
  'https://your-custom-domain.com'
]

app.use('/api/*', cors({
  origin: (origin) => {
    if (allowedOrigins.includes(origin)) {
      return origin
    }
    return allowedOrigins[0] // デフォルト
  },
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}))
```

#### 2. レート制限の追加

過度なAPIリクエストを防ぐため、レート制限を実装できます。

```typescript
// Honoのレート制限ミドルウェアを使用
import { rateLimiter } from 'hono-rate-limiter'

app.use(
  '/api/*',
  rateLimiter({
    windowMs: 15 * 60 * 1000, // 15分
    max: 100, // 最大100リクエスト
  })
)
```

---

## 📚 その他のリソース

### 公式ドキュメント
- [Hono ドキュメント](https://hono.dev/)
- [Cloudflare Workers ドキュメント](https://developers.cloudflare.com/workers/)
- [Wrangler CLI ドキュメント](https://developers.cloudflare.com/workers/wrangler/)

### コミュニティ
- [Hono Discord](https://discord.gg/honojs)
- [Cloudflare Discord](https://discord.gg/cloudflaredev)

### 関連ツール
- [VS Code Wrangler 拡張機能](https://marketplace.visualstudio.com/items?itemName=cloudflare.vscode-wrangler)
- [Postman](https://www.postman.com/) - API テスト用

---

## 📞 サポート

問題が解決しない場合は、以下の方法でサポートを受けることができます：

1. **GitHub Issues**: プロジェクトのIssueを作成
2. **Cloudflare Community**: https://community.cloudflare.com/
3. **Stack Overflow**: タグ `cloudflare-workers`, `hono` を使用

---

**最終更新**: 2025-11-10  
**バージョン**: 1.0.0
