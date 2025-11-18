# 東京都AI チャットサイト

東京都のAI API（`https://ai-api.metro.tokyo.lg.jp/api/v1/chat/message`）を使用した、モダンなチャットインターフェースを提供するWebアプリケーションです。

## 🎯 プロジェクト概要

このプロジェクトは、**Honoフレームワーク（TypeScript）+ 静的フロントエンド（HTML/CSS/JS）** の構成で、東京都が提供するAI APIを安全にプロキシし、ユーザーがブラウザ上でAIアシスタントと対話できるチャットサイトです。リアルタイムストリーミング応答に対応し、最大10,000文字程度の詳細な回答を受け取ることができます。

## 🏗️ アーキテクチャ

### バージョン 2.0（トークン自動取得対応）

```
[ユーザー] ←→ [Cloudflare Pages]
                (Hono Backend)
                      ↓
                [Token Service] ←→ [東京都AI API]
              (Railway/Render)      (Bearer認証)
                Playwright自動化
```

### 2つのデプロイオプション

#### オプション1: Bearer Token 手動設定（シンプル）
```
[ユーザー] ←→ [Hono Backend] ←→ [東京都AI API]
                (手動トークン)
```

#### オプション2: トークン自動取得（推奨）
```
[ユーザー] ←→ [Hono Backend] → [Token Service] → [東京都AI]
              ↑                  (Playwright)       
              └── キャッシュ（24時間）
```

**なぜバックエンドが必要？**
- 東京都AI APIは**Bearer認証が必須**
- **CORS制限**により、ブラウザから直接呼び出せない
- APIキーを安全に管理するためサーバーサイド処理が必要

**トークン自動取得の利点**
- ✅ Microsoftアカウントで自動ログイン
- ✅ 新しいチャットを自動作成
- ✅ トークンを自動取得・更新
- ✅ 24時間キャッシュで高速化

## ✨ 実装済み機能

### コア機能
- ✅ **東京都AI APIとの連携** - FormData形式でのPOSTリクエスト送信
- ✅ **リアルタイムストリーミング応答** - Server-Sent Events (SSE) によるストリーミングレスポンス表示
- ✅ **通常応答モード** - ストリーミングなしの一括応答モード
- ✅ **複数AIモデル選択** - モデル1〜4から選択可能
- ✅ **セッション管理** - UUID生成によるセッション識別
- 🆕 **トークン自動取得** - Playwright + FastAPIで完全自動化（v2.0）
- 🆕 **Microsoftログイン自動化** - アカウント情報で自動ログイン
- 🆕 **トークンキャッシュ** - 24時間メモリ内キャッシュ

### UI/UX機能
- ✅ **モダンなチャットUI** - グラデーションデザインと滑らかなアニメーション
- ✅ **レスポンシブデザイン** - デスクトップ・タブレット・モバイル対応
- ✅ **リアルタイム文字数カウント** - 入力文字数の表示
- ✅ **自動スクロール** - 新しいメッセージへの自動スクロール
- ✅ **タイムスタンプ表示** - 各メッセージの送信時刻表示
- ✅ **設定の永続化** - LocalStorageによる設定保存
- ✅ **チャット履歴クリア** - ワンクリックで履歴削除

### セキュリティ
- ✅ **Bearer トークンの安全管理** - Cloudflare Secretsで管理
- ✅ **CORS対応** - 適切なCORS設定
- ✅ **エラーハンドリング** - 包括的なエラー処理

## 📦 技術スタック

### バックエンド
- **Hono** - 軽量で高速なWebフレームワーク
- **TypeScript** - 型安全な開発
- **Cloudflare Workers** - エッジコンピューティング環境
- **Server-Sent Events (SSE)** - リアルタイムストリーミング

### フロントエンド
- **Vanilla JavaScript** - フレームワークレス
- **CSS3** - モダンなスタイリング
- **Font Awesome** - アイコン
- **Noto Sans JP** - 日本語フォント

### デプロイ
- **Cloudflare Pages** - グローバルエッジ配信
- **Wrangler** - Cloudflare CLI ツール

## 🚀 クイックスタート

### 1. 前提条件

- Node.js 18 以上
- npm または yarn
- Cloudflareアカウント（デプロイ時のみ）

### 2. インストール

```bash
# リポジトリをクローン
git clone <repository-url>
cd webapp

# 依存関係をインストール
npm install
```

### 3. 環境変数の設定

`.dev.vars` ファイルを編集して、以下の**いずれか**を設定します：

#### オプション1: Bearer トークンを手動設定（簡単）

```env
TOKYO_AI_BEARER_TOKEN=your-bearer-token-here
```

**Bearer トークンの取得方法**:
1. https://ai.metro.tokyo.lg.jp/chattomo/conversation にアクセス
2. ブラウザの開発者ツール（F12）を開く
3. ネットワークタブを選択
4. チャットでメッセージを送信
5. `chat/message` リクエストを選択
6. リクエストヘッダーの `Authorization: Bearer XXXXX` の値をコピー

#### オプション2: トークン自動取得サービスを使用（推奨）

```env
TOKEN_SERVICE_URL=http://localhost:8000
MICROSOFT_EMAIL=your-email@example.com
MICROSOFT_PASSWORD=your-password
```

⚠️ **注意**: オプション2を使用する場合、先に `token-service` をデプロイする必要があります。
詳細は **DEPLOYMENT_GUIDE.md** を参照してください。

### 4. 開発サーバー起動

```bash
# プロジェクトをビルド
npm run build

# 開発サーバーを起動
npm run dev:sandbox
```

サーバーが起動したら、ブラウザで `http://localhost:3000` にアクセスしてください。

## 🌐 デモURL

- **開発環境**: https://3000-iano5a7quhv7h189p0033-d0b9e1e2.sandbox.novita.ai
- **ヘルスチェック**: https://3000-iano5a7quhv7h189p0033-d0b9e1e2.sandbox.novita.ai/health

## 📁 プロジェクト構造

```
webapp/
├── src/
│   └── index.tsx                # Honoバックエンドサーバー
├── public/
│   └── static/
│       ├── app.js               # フロントエンドJavaScript
│       └── style.css            # スタイルシート
├── token-service/               # 🆕 トークン自動取得サービス
│   ├── main.py                  # FastAPI + Playwright
│   ├── requirements.txt         # Python依存関係
│   ├── Dockerfile               # Dockerイメージ
│   ├── railway.json             # Railway設定
│   ├── render.yaml              # Render.com設定
│   └── README.md                # トークンサービス説明
├── dist/                        # ビルド出力
├── .dev.vars                    # 開発環境変数（Gitに含めない）
├── .gitignore                   # Git除外ファイル
├── ecosystem.config.cjs         # PM2設定（開発用）
├── package.json                 # 依存関係とスクリプト
├── tsconfig.json                # TypeScript設定
├── vite.config.ts               # Vite設定
├── wrangler.jsonc               # Cloudflare設定
├── README.md                    # このファイル
├── SETUP_GUIDE.md               # セットアップガイド
└── DEPLOYMENT_GUIDE.md          # 🆕 デプロイガイド（トークン自動取得）
```

## 🔧 利用可能なスクリプト

```bash
# 開発サーバー起動（Vite）
npm run dev

# 開発サーバー起動（Wrangler - サンドボックス用）
npm run dev:sandbox

# プロジェクトビルド
npm run build

# プレビュー（ビルド後）
npm run preview

# Cloudflare Pagesへデプロイ
npm run deploy

# 本番環境へデプロイ
npm run deploy:prod

# ポート3000をクリーンアップ
npm run clean-port

# ヘルスチェック
npm run test
```

## 📡 APIエンドポイント

### ヘルスチェック
```
GET /health
```

レスポンス例：
```json
{
  "status": "healthy",
  "timestamp": "2025-11-10T01:45:58.088Z",
  "service": "東京都AI チャット プロキシAPI",
  "version": "1.0.0"
}
```

### チャットAPI（非ストリーミング）
```
POST /api/chat
```

リクエスト例：
```json
{
  "sessionId": "uuid-here",
  "message": "こんにちは",
  "model": "1",
  "isStream": false
}
```

### チャットAPI（ストリーミング）
```
POST /api/chat/stream
```

リクエスト例：
```json
{
  "sessionId": "uuid-here",
  "message": "東京都の観光名所を教えて",
  "model": "1"
}
```

レスポンスはServer-Sent Events (SSE) 形式で配信されます。

## 🚢 Cloudflare Pagesへのデプロイ

### オプション1: Bearer Token 手動設定

```bash
# Bearerトークンをシークレットとして設定
npx wrangler pages secret put TOKYO_AI_BEARER_TOKEN --project-name tokyo-ai-chat

# デプロイ
npm run deploy:prod
```

### オプション2: トークン自動取得サービス（推奨）

**ステップ1: トークンサービスをRailway/Render.comにデプロイ**

詳細は **DEPLOYMENT_GUIDE.md** を参照してください。

**ステップ2: Cloudflare Secretsの設定**

```bash
# トークンサービスのURL
npx wrangler pages secret put TOKEN_SERVICE_URL --project-name tokyo-ai-chat

# Microsoftアカウント情報
npx wrangler pages secret put MICROSOFT_EMAIL --project-name tokyo-ai-chat
npx wrangler pages secret put MICROSOFT_PASSWORD --project-name tokyo-ai-chat
```

**ステップ3: デプロイ**

```bash
npm run deploy:prod
```

### カスタムドメイン設定（オプション）

Cloudflare Pagesダッシュボードから、カスタムドメインを追加できます。

## 🎨 UIカスタマイズ

### カラーテーマの変更

`public/static/style.css` の `:root` セクションでカラーパレットを変更できます：

```css
:root {
    --primary-color: #4f46e5;
    --secondary-color: #10b981;
    --danger-color: #ef4444;
    /* ... */
}
```

### フォントの変更

HTMLヘッダーのGoogle Fontsリンクを変更してください：

```html
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300;400;500;600;700&display=swap" rel="stylesheet">
```

## 🐛 トラブルシューティング

### Bearer トークンエラー

**エラー**: `Bearer トークンが設定されていません`

**解決方法**:
1. `.dev.vars` ファイルに `TOKYO_AI_BEARER_TOKEN` が設定されているか確認
2. 本番環境では `wrangler pages secret put` でシークレットを設定
3. トークンが有効期限切れの場合は、再取得してください

### CORS エラー

**エラー**: `CORS policy error`

**解決方法**:
- バックエンドのCORS設定を確認
- 本番環境では `allow_origins` を特定のドメインに制限してください

### ポート衝突

**エラー**: `Port 3000 is already in use`

**解決方法**:
```bash
# ポートをクリーンアップ
npm run clean-port

# または
fuser -k 3000/tcp
```

## 📝 開発のヒント

### ローカル開発のベストプラクティス

1. **Bearer トークンの定期更新**: トークンは定期的に期限切れになるため、定期的に更新してください
2. **ストリーミングのデバッグ**: ブラウザの開発者ツールのネットワークタブでSSEを確認
3. **エラーログの確認**: `pm2 logs tokyo-ai-chat` でサーバーログを確認

### コード品質

- TypeScriptの型チェック: `npx tsc --noEmit`
- コードフォーマット: Prettierの使用を推奨

## 📊 データモデル

### メッセージオブジェクト
```typescript
{
  role: 'user' | 'assistant',
  content: string,
  timestamp: Date
}
```

### セッション管理
- UUIDv4を使用してセッションIDを生成
- LocalStorageに設定を保存

## 🤝 貢献

プルリクエストを歓迎します！大きな変更を行う場合は、まずissueを開いて変更内容を議論してください。

## 📄 ライセンス

このプロジェクトはMITライセンスの下でライセンスされています。

## 🙏 謝辞

- [Hono](https://hono.dev/) - 素晴らしいWebフレームワーク
- [Cloudflare Workers](https://workers.cloudflare.com/) - エッジコンピューティング環境
- [東京都](https://www.metro.tokyo.lg.jp/) - AI APIの提供

## 📞 お問い合わせ

質問や提案がある場合は、GitHubのIssueを作成してください。

---

**作成日**: 2025-11-10  
**最終更新**: 2025-11-10  
**バージョン**: 1.0.0
