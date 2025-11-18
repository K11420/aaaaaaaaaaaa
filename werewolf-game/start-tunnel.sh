#!/bin/bash

# Cloudflare Tunnel 起動スクリプト

echo "🌐 Cloudflare Tunnel を起動しています..."

# Cloudflared のパス
CLOUDFLARED="/home/kbt0/webapp/cloudflared"

# 設定ファイルのパス
CONFIG_FILE="/home/kbt0/webapp/werewolf-game/cloudflare-tunnel.yml"

# トンネルを起動
$CLOUDFLARED tunnel --config $CONFIG_FILE run werewolf-game-tunnel

echo "✅ Cloudflare Tunnel が起動しました"
