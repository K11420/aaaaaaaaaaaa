# 🚀 東京都AI チャットサイト - 完全デプロイガイド

このガイドでは、トークン自動取得機能を含む完全なシステムのデプロイ手順を説明します。

## 📋 システム構成

```
[ユーザー] ←→ [Cloudflare Pages]
                (Hono Backend)
                      ↓
                [Token Service]  ←→ [東京都AI API]
              (Railway/Render)     (Bearer認証)
                Playwright自動化
```

## 🎯 デプロイオプション

### オプション1: Bearer Token を手動設定（シンプル）

- ✅ 簡単
- ✅ 高速
- ❌ トークン期限切れ時に手動更新が必要

### オプション2: トークン自動取得サービス（推奨）

- ✅ トークンを自動取得
- ✅ 期限切れ時に自動更新
- ✅ Microsoftアカウントで自動ログイン
- ⚠️ 追加のサーバーが必要（Railway/Render.com）

---

## 📦 オプション1: Bearer Token を手動設定

### ステップ1: Bearer Token を取得

1. https://ai.metro.tokyo.lg.jp/chattomo/conversation にアクセス
2. ブラウザの開発者ツール（F12）を開く
3. ネットワークタブを選択
4. チャットでメッセージを送信
5. `chat/message` リクエストを選択
6. `Authorization: Bearer XXXXX` の値をコピー

### ステップ2: ローカル開発

`.dev.vars` を編集：

```env
# オプション1を使用
TOKYO_AI_BEARER_TOKEN=your-bearer-token-here
```

```bash
# サーバー起動
npm run build
pm2 restart tokyo-ai-chat
```

### ステップ3: Cloudflare Pages へデプロイ

```bash
# Bearerトークンをシークレットとして設定
npx wrangler pages secret put TOKYO_AI_BEARER_TOKEN --project-name tokyo-ai-chat

# デプロイ
npm run deploy:prod
```

---

## 🤖 オプション2: トークン自動取得サービス（推奨）

### パート1: トークンサービスのデプロイ

#### Railway へのデプロイ

1. **Railwayアカウントを作成**: https://railway.app/

2. **リポジトリをGitHubにプッシュ**:
   ```bash
   cd /home/user/webapp
   git add token-service/
   git commit -m "Add token service"
   git push
   ```

3. **Railwayでプロジェクトを作成**:
   - Railway ダッシュボード → New Project
   - Deploy from GitHub repo を選択
   - リポジトリを選択
   - Root Directory を `token-service` に設定

4. **自動デプロイ**:
   - Dockerfileが自動検出されてビルドされます
   - デプロイ完了後、URLが表示されます（例: `https://tokyo-ai-token-service.railway.app`）

5. **URLをコピー**:
   - このURLを後で使用します

#### Render.com へのデプロイ

1. **Render.comアカウントを作成**: https://render.com/

2. **リポジトリをGitHubにプッシュ**

3. **New Web Service を作成**:
   - Repository を選択
   - Root Directory を `token-service` に設定
   - Environment: Docker
   - Plan: Free

4. **デプロイ完了**:
   - URLをコピー（例: `https://tokyo-ai-token-service.onrender.com`）

### パート2: Honoバックエンドの設定

#### ローカル開発

`.dev.vars` を編集：

```env
# オプション2を使用（トークン自動取得）
TOKEN_SERVICE_URL=https://your-token-service.railway.app
MICROSOFT_EMAIL=your-email@example.com
MICROSOFT_PASSWORD=your-password
```

```bash
# サーバー起動
npm run build
pm2 restart tokyo-ai-chat

# テスト
curl http://localhost:3000/health
```

#### Cloudflare Pages へデプロイ

```bash
# 環境変数をシークレットとして設定
npx wrangler pages secret put TOKEN_SERVICE_URL --project-name tokyo-ai-chat
# プロンプト: https://your-token-service.railway.app

npx wrangler pages secret put MICROSOFT_EMAIL --project-name tokyo-ai-chat
# プロンプト: your-email@example.com

npx wrangler pages secret put MICROSOFT_PASSWORD --project-name tokyo-ai-chat
# プロンプト: your-password

# デプロイ
npm run deploy:prod
```

---

## 🔧 詳細設定

### トークンキャッシュ

トークンは24時間キャッシュされます。期限切れ後、自動的に再取得されます。

### タイムアウト設定

トークン取得のタイムアウトはデフォルト60秒です。変更する場合は、`src/index.tsx`を編集：

```typescript
body: JSON.stringify({
  microsoft_email: env.MICROSOFT_EMAIL,
  microsoft_password: env.MICROSOFT_PASSWORD,
  timeout: 120000  // 120秒に変更
})
```

### 複数環境の管理

開発環境と本番環境で異なる設定を使用できます：

**開発環境** (`.dev.vars`):
```env
TOKEN_SERVICE_URL=http://localhost:8000
MICROSOFT_EMAIL=dev-email@example.com
MICROSOFT_PASSWORD=dev-password
```

**本番環境** (Cloudflare Secrets):
```bash
npx wrangler pages secret put TOKEN_SERVICE_URL --project-name tokyo-ai-chat
# 本番のURL: https://your-token-service.railway.app
```

---

## 📊 パフォーマンス最適化

### トークンサービスの最適化

#### 1. ブラウザインスタンスの再利用

トークンサービスは自動的にブラウザインスタンスを再利用します。
初回: 約60秒、2回目以降: 約30秒

#### 2. 並列リクエストの制限

Railway/Render.comの無料プランでは、同時リクエスト数を3-5に制限することを推奨します。

#### 3. キャッシュの活用

Honoバックエンドはトークンを24時間キャッシュします。
頻繁なトークン再取得を防ぎます。

---

## 🐛 トラブルシューティング

### トークンサービスのログ確認

**Railway**:
```bash
# Railway CLI をインストール
npm install -g @railway/cli

# ログを表示
railway logs
```

**Render.com**:
- ダッシュボード → Service → Logs タブ

### よくあるエラー

#### 1. トークン取得タイムアウト

**原因**: Microsoftログインが遅い、ページ読み込みが遅い

**解決方法**:
- タイムアウトを増やす（120秒など）
- トークンサービスのログを確認

#### 2. Microsoftログイン失敗

**原因**: 2段階認証が有効、認証情報が間違っている

**解決方法**:
- 2段階認証を無効化
- または、アプリパスワードを使用
- 認証情報を確認

#### 3. トークンサービスに接続できない

**原因**: URLが間違っている、サービスがダウン

**解決方法**:
```bash
# トークンサービスのヘルスチェック
curl https://your-token-service.railway.app/health
```

#### 4. トークンが無効

**原因**: トークンが期限切れ、セッションが終了

**解決方法**:
- キャッシュをクリア（サーバーを再起動）
- トークンサービスから新しいトークンを取得

---

## 💰 コスト

### Railway

- **無料プラン**: 月500時間（約20日）
- **料金**: $0.000231/分（約$0.01/時間）
- **推奨**: Hobby プラン $5/月（500時間 + 追加使用量）

### Render.com

- **無料プラン**: あり（制限付き、スリープあり）
- **料金**: Starter $7/月（常時稼働）

### Cloudflare Pages

- **無料プラン**: 月100万リクエスト
- **料金**: 追加$0.15/100万リクエスト

**推定月額コスト**:
- オプション1（手動）: $0（Cloudflare Pagesのみ）
- オプション2（自動）: $5-7（Railway/Render + Cloudflare）

---

## 🔒 セキュリティベストプラクティス

### 1. 環境変数の管理

❌ **やってはいけないこと**:
- GitHubに認証情報をコミット
- フロントエンドにトークンを露出
- ハードコードされたパスワード

✅ **推奨**:
- Cloudflare Secrets を使用
- `.dev.vars` を `.gitignore` に追加
- 環境ごとに異なる認証情報を使用

### 2. CORS設定

本番環境では、特定のドメインに制限：

```typescript
app.use('/api/*', cors({
  origin: 'https://tokyo-ai-chat.pages.dev',  // 本番ドメインに変更
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}))
```

### 3. レート制限

トークンサービスへのアクセスを制限：

```typescript
// Honoにレート制限ミドルウェアを追加
import { rateLimiter } from 'hono-rate-limiter'

app.use('/api/*', rateLimiter({
  windowMs: 15 * 60 * 1000, // 15分
  max: 100 // 最大100リクエスト
}))
```

---

## 📈 モニタリング

### Cloudflare Analytics

- Workers Analytics でリクエスト数、エラー率を確認
- ダッシュボード → Workers & Pages → Analytics

### Railway/Render Metrics

- CPU使用率、メモリ使用量、レスポンスタイムを監視
- ダッシュボード → Metrics タブ

### ログ管理

```bash
# Cloudflare Pages ログ
npx wrangler tail tokyo-ai-chat

# Railway ログ
railway logs -f

# Render ログ
# ダッシュボードから確認
```

---

## 🚀 さらなる改善

### 1. トークンの暗号化

トークンをKVストレージに暗号化して保存：

```typescript
// Cloudflare KV を使用
await env.KV.put('bearer_token', encryptedToken, { expirationTtl: 86400 })
```

### 2. Webhook通知

トークン取得失敗時にSlack/Discordに通知：

```typescript
if (!data.success) {
  await fetch('https://hooks.slack.com/...', {
    method: 'POST',
    body: JSON.stringify({ text: 'トークン取得失敗' })
  })
}
```

### 3. マルチアカウント対応

複数のMicrosoftアカウントでロードバランシング

---

## 📞 サポート

問題が発生した場合：

1. **ドキュメントを確認**: README.md, SETUP_GUIDE.md
2. **ログを確認**: トークンサービス、Honoバックエンド
3. **GitHub Issues**: プロジェクトのIssueを作成

---

**最終更新**: 2025-11-10  
**バージョン**: 2.0.0（トークン自動取得対応）
