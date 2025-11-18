# 🌐 Cloudflare Tunnel セットアップガイド

Cloudflare Tunnelを使用して、人狼ゲームを外部に公開する方法を説明します。

## 🚀 現在のトンネル情報

**公開URL**: https://cal-cement-easy-rock.trycloudflare.com

このURLで世界中からゲームにアクセスできます！

## 📝 2つの方法

### 方法1: 簡易トンネル（推奨・現在使用中）

**特徴**
- ✅ 設定不要
- ✅ すぐに使える
- ✅ 自動でランダムURLが生成される
- ⚠️ トンネル再起動時にURLが変わる
- ⚠️ 実験用・一時的な使用向け

**起動方法**
```bash
cd /home/kbt0/webapp
./cloudflared tunnel --url http://localhost:3002
```

**バックグラウンドで起動**
```bash
cd /home/kbt0/webapp
./cloudflared tunnel --url http://localhost:3002 &
```

**生成されるURL例**
- https://cal-cement-easy-rock.trycloudflare.com
- https://random-name.trycloudflare.com

### 方法2: 名前付きトンネル（本番向け）

**特徴**
- ✅ 固定URL
- ✅ 複数のサービスを同時にトンネル可能
- ✅ 本番環境向け
- ❌ Cloudflareアカウントが必要
- ❌ DNS設定が必要

**セットアップ手順**

1. **Cloudflareアカウントでログイン**
   ```bash
   cd /home/kbt0/webapp
   ./cloudflared tunnel login
   ```

2. **トンネルを作成**
   ```bash
   ./cloudflared tunnel create werewolf-game-tunnel
   ```

3. **DNS設定**
   ```bash
   ./cloudflared tunnel route dns werewolf-game-tunnel werewolf.yourdomain.com
   ```

4. **設定ファイルを編集**
   - `cloudflare-tunnel.yml` を編集
   - 適切なホスト名を設定

5. **トンネルを起動**
   ```bash
   cd werewolf-game
   ./start-tunnel.sh
   ```

## 🔧 現在のセットアップ

### アクティブなトンネル

**トンネルタイプ**: 簡易トンネル（アカウント不要）
**公開URL**: https://cal-cement-easy-rock.trycloudflare.com
**ローカルサービス**: http://localhost:3002
**状態**: ✅ 実行中

### サーバー構成

```
インターネット
    ↓
Cloudflare Tunnel (https://cal-cement-easy-rock.trycloudflare.com)
    ↓
ローカル (http://localhost:3002)
    ↓
Vite Dev Server (Reactアプリ)
    ↓
WebSocket接続 → Express Server (http://localhost:3001)
```

## 📊 トンネルの管理

### トンネルの状態確認
```bash
cd /home/kbt0/webapp
./cloudflared tunnel info werewolf-game-tunnel
```

### トンネルの停止
```bash
# プロセスIDを確認
ps aux | grep cloudflared

# プロセスを停止
kill <PID>

# または
pkill cloudflared
```

### トンネルの再起動
```bash
# 簡易トンネルの場合
cd /home/kbt0/webapp
./cloudflared tunnel --url http://localhost:3002 &

# 名前付きトンネルの場合
cd werewolf-game
./start-tunnel.sh
```

## 🔒 セキュリティ

### 簡易トンネル（trycloudflare.com）
- ランダムなURLが生成される
- URLを知っている人のみアクセス可能
- HTTPSで暗号化
- Cloudflareによる基本的なDDoS保護

### 本番環境の推奨事項
- 名前付きトンネルを使用
- Cloudflare Access でアクセス制御
- レート制限の設定
- ログの監視

## 🐛 トラブルシューティング

### トンネルに接続できない

**原因1**: ローカルサーバーが起動していない
```bash
# サーバーを確認
curl http://localhost:3002
```

**原因2**: ポート3002が使用中
```bash
# ポートを確認
lsof -i:3002
```

**原因3**: トンネルが停止している
```bash
# トンネルプロセスを確認
ps aux | grep cloudflared
```

### URLが変わってしまった

簡易トンネルはトンネル再起動時に新しいランダムURLが生成されます。

**解決策**:
- 固定URLが必要な場合は名前付きトンネルを使用
- または、トンネルを停止しない

### "connection refused" エラー

**確認事項**:
1. ローカルサーバーが起動しているか
   ```bash
   curl http://localhost:3002
   ```

2. ファイアウォールの設定
   ```bash
   # ポート3002が開いているか確認
   sudo ufw status
   ```

3. cloudflaredが正しいポートを指定しているか
   ```bash
   ps aux | grep cloudflared
   ```

## 📱 モバイルアクセス

Cloudflare Tunnelを使用すると、スマートフォンやタブレットからもゲームにアクセスできます。

1. **公開URLにアクセス**
   - https://cal-cement-easy-rock.trycloudflare.com

2. **QRコード生成（オプション）**
   ```bash
   # QRコード生成ツールを使用
   qrencode -o tunnel-qr.png "https://cal-cement-easy-rock.trycloudflare.com"
   ```

## 🌍 グローバルアクセス

Cloudflareのグローバルネットワークにより、世界中から低レイテンシでアクセス可能です。

**Cloudflareエッジロケーション**:
- 東京 (nrt)
- 大阪 (kix)
- その他、世界中のエッジサーバー

## 💡 ヒント

- **開発中**: 簡易トンネルで十分
- **友達とプレイ**: 簡易トンネルのURLを共有
- **本番運用**: 名前付きトンネル + カスタムドメイン
- **パフォーマンス**: ローカルアクセスの方が速い

## 📚 関連リンク

- [Cloudflare Tunnel ドキュメント](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)
- [Try Cloudflare (無料)](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/do-more-with-tunnels/trycloudflare/)
- [Cloudflared CLI](https://github.com/cloudflare/cloudflared)

---

楽しい人狼ゲームをお楽しみください！🐺✨
