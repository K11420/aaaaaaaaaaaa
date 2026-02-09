#!/bin/bash
# fmaps.schale41.jp 用 Cloudflare Tunnel 起動スクリプト
# 経路検索システム (localhost:5000) を https://fmaps.schale41.jp で公開

CLOUDFLARED="/usr/local/bin/cloudflared"
CONFIG_FILE="/home/kbt0/.cloudflared/fmaps-config.yml"

if [ ! -f "$CONFIG_FILE" ]; then
  echo "❌ 設定ファイルが見つかりません: $CONFIG_FILE"
  exit 1
fi

echo "🌐 fmaps.schale41.jp トンネルを起動しています..."
echo "   → http://127.0.0.1:5000 (経路検索システム)"
echo ""

$CLOUDFLARED tunnel --config "$CONFIG_FILE" run
