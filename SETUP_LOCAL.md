# 🛣️ CV経路探索システム - ローカル環境セットアップガイド

## 📋 システム概要
- **道路ネットワーク表示機能付きCV経路探索システム**
- **スケルトン化による道路中央線検出**
- **画像アップロード時点からの道路表示プレビュー**
- **BFS/A*/Dijkstra経路探索アルゴリズム**

## 🚀 ローカル環境セットアップ手順

### 1. システム要件
- **Python 3.8以上**
- **pip (Python package manager)**
- **Git (オプション - 開発時のみ)**

### 2. プロジェクトファイルの展開
```bash
# ダウンロードしたtar.gzファイルを展開
tar -xzf cv-pathfinding-road-network-complete.tar.gz

# プロジェクトディレクトリに移動
cd cv-pathfinding-python
```

### 3. 依存関係のインストール
```bash
# 必要なPythonパッケージをインストール
pip install -r requirements.txt

# または個別インストール
pip install flask flask-cors opencv-python pillow numpy scikit-image scikit-learn scipy
```

### 4. サーバー起動
```bash
# デフォルトポート（9000）で起動
python app.py

# カスタムポートで起動
python app.py --port 8080
```

### 5. ブラウザアクセス
```
http://localhost:9000
```

## 📁 プロジェクト構成

```
cv-pathfinding-python/
├── app.py                 # メインFlaskアプリケーション
├── requirements.txt       # Python依存関係
├── templates/
│   └── index.html        # WebUIテンプレート
├── static/
│   ├── app.js           # フロントエンドJavaScript
│   ├── sw.js            # Service Worker
│   └── manifest.json    # PWAマニフェスト
├── SETUP_LOCAL.md       # このセットアップガイド
└── README.md           # システム概要
```

## 🛣️ 主な機能

### 1. 道路ネットワーク検出
- **スケルトン化アルゴリズム**: scikit-imageによる道路中央線の自動抽出
- **DBSCAN機械学習**: scikit-learnによる交差点ノードの自動検出
- **モルフォロジー演算**: OpenCVによるノイズ除去と細線化

### 2. 経路探索
- **3つのアルゴリズム**: BFS、A*、Dijkstra
- **道路ネットワーク経路**: ノードグラフベース + スケルトン直接探索
- **フォールバック処理**: 複数の経路探索手法を組み合わせ

### 3. 視覚化機能
- **プレビュー機能**: 画像アップロード時点での道路表示
- **リアルタイム切り替え**: 道路ネットワークの表示/非表示
- **透明度制御**: 40-60%透明度での重ね合わせ表示

## ⚙️ カスタマイズ

### ポート変更
```bash
python app.py --port 8080
```

### デバッグモード
```python
# app.py の最後を以下に変更
if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=port)
```

### パフォーマンス調整
```python
# RoadNetworkGenerator クラスの調整
self.node_spacing = 15      # ノード間隔（小さくすると精度向上、処理重く）
self.corner_threshold = 30  # 角度検出閾値
self.junction_radius = 20   # 交差点検出半径
```

## 🐛 トラブルシューティング

### よくある問題

1. **依存関係エラー**
```bash
# 仮想環境を作成（推奨）
python -m venv venv
source venv/bin/activate  # Linux/Mac
# venv\Scripts\activate   # Windows

pip install -r requirements.txt
```

2. **ポート使用中エラー**
```bash
# 別のポートを使用
python app.py --port 8080
```

3. **メモリ不足**
```python
# app.py で画像サイズを制限
target_size = int(data.get('target_size', 800))  # 1200から800に削減
```

4. **OpenCVエラー**
```bash
# OpenCVの再インストール
pip uninstall opencv-python
pip install opencv-python-headless
```

## 📊 パフォーマンス目安

- **画像処理**: 2-5秒 (1200x800画像)
- **道路ネットワーク生成**: 1-3秒
- **経路探索**: 0.1-1秒
- **メモリ使用量**: 100-500MB

## 🔒 セキュリティ注意事項

- **本システムは開発/テスト用です**
- **本番環境では適切なWebサーバー (gunicorn等) を使用してください**
- **ファイルアップロードサイズ制限を設定してください**
- **HTTPS通信を使用してください（本番環境）**

## 📝 ライセンス

このプロジェクトは教育・研究目的で開発されました。
商用利用の際は依存ライブラリのライセンスを確認してください。

## 🤝 サポート

問題が発生した場合：
1. requirements.txtの依存関係を確認
2. Pythonバージョンを確認 (3.8+)
3. ブラウザコンソールでJavaScriptエラーを確認
4. app.pyの出力ログを確認