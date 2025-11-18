# 🤖 Gemini API セットアップガイド

人狼ゲームのCPUプレイヤーをより賢くするため、Google Gemini APIを統合しました。

## 🌟 Gemini APIの利点

### デフォルトAI（APIキー未設定時）
- シンプルなルールベースのロジック
- ランダムな投票・アクション
- 定型文の発言

### Gemini AI（APIキー設定時）
- **自然な発言**: 状況に応じた人間らしい発言
- **戦略的判断**: ゲーム状況を理解した投票・アクション
- **役職に応じた行動**: 人狼、占い師、騎士、村人それぞれの役割を理解
- **ゲーム履歴を考慮**: 過去の出来事を踏まえた推理

## 📝 APIキーの取得方法

1. **Google AI Studioにアクセス**
   - https://makersuite.google.com/app/apikey
   - Googleアカウントでログイン

2. **APIキーを作成**
   - 「Create API Key」をクリック
   - プロジェクトを選択（または新規作成）
   - APIキーが表示される（例: `AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXX`）

3. **APIキーをコピー**
   - 安全な場所に保存
   - 他人と共有しないでください

## 🎮 使用方法

### Webサイトから設定（推奨）

1. **ゲームのホーム画面を開く**
   - http://106.73.68.66:3003 にアクセス

2. **Gemini AI設定セクション**
   - ページ上部に表示される「🤖 Gemini AI設定」

3. **APIキーを入力**
   - 取得したAPIキーを入力
   - 「APIキーを設定」ボタンをクリック

4. **設定完了**
   - ✅ 状態が「AI有効」になる
   - CPUプレイヤーがGemini AIを使用開始

### 環境変数から設定（オプション）

サーバー側で環境変数を設定することもできます：

```bash
# server/.env ファイルを作成
GEMINI_API_KEY=your_api_key_here
```

```javascript
// server/index.js に追加
require('dotenv').config();
if (process.env.GEMINI_API_KEY) {
  geminiAI.setApiKey(process.env.GEMINI_API_KEY);
}
```

## 🔒 セキュリティ

- APIキーはサーバー側でのみ使用されます
- ブラウザには保存されません
- 各セッションごとに設定が必要です

## 💰 料金

Gemini APIは無料枠があります：
- **無料枠**: 1分あたり60リクエスト
- 人狼ゲームでは1ゲームあたり数十リクエスト程度

詳細: https://ai.google.dev/pricing

## 🧪 テスト

APIキーが正しく設定されているか確認：

```bash
curl http://localhost:3001/api/gemini/status
```

レスポンス例：
```json
{
  "isInitialized": true,
  "message": "Gemini APIは有効です"
}
```

## ❓ トラブルシューティング

### エラー: APIキーの設定に失敗しました

**原因1**: APIキーが無効
- APIキーを再確認
- Google AI Studioで新しいキーを生成

**原因2**: ネットワークエラー
- インターネット接続を確認
- Gemini APIのステータスを確認: https://status.cloud.google.com/

### CPUプレイヤーの発言が変わらない

- ページをリロード
- APIキーを再設定
- ブラウザのコンソールでエラーを確認

### 429 Too Many Requests エラー

- API使用量の上限に達した
- 少し待ってから再試行
- 有料プランにアップグレード（オプション）

## 🔧 開発者向け

### Gemini APIモジュール

`server/geminiAI.js` - Gemini API統合
- `setApiKey(apiKey)` - APIキーを設定
- `isInitialized()` - 初期化状態を確認
- `generateChatMessage(context)` - 発言生成
- `makeVoteDecision(context)` - 投票判断
- `makeNightActionDecision(context)` - 夜アクション判断

### CPU AIモジュール

`server/cpuAI.js` - CPUプレイヤーロジック
- Gemini APIが利用可能な場合は自動的に使用
- フォールバック: デフォルトのルールベースAI

### エンドポイント

**APIキーを設定**
```
POST /api/gemini/set-api-key
Body: { "apiKey": "your_api_key" }
```

**API状態を確認**
```
GET /api/gemini/status
```

## 📚 関連リンク

- [Google AI Studio](https://makersuite.google.com/)
- [Gemini API ドキュメント](https://ai.google.dev/docs)
- [Gemini API 料金](https://ai.google.dev/pricing)
- [Gemini モデル](https://ai.google.dev/models/gemini)

---

楽しい人狼ゲームをお楽しみください！🐺✨
