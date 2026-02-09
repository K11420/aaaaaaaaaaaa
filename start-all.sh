#!/bin/bash
# 経路検索システム + fmaps.schale41.jp トンネルを一括起動
# ※ fmaps は config-lenovo.yml のトンネルで公開（Error 1033 回避）

WEBAPP_DIR="/home/kbt0/webapp"
cd "$WEBAPP_DIR" || exit 1

echo "🚀 すべてを起動しています..."
echo ""

# 1. Flask アプリ起動
if pgrep -f "python.*app.py" > /dev/null; then
  echo "✅ 経路検索システム (Flask) は既に起動中です"
else
  nohup venv/bin/python3 -u app.py >> app.log 2>&1 &
  sleep 4
  if lsof -i :5000 > /dev/null 2>&1; then
    echo "✅ 経路検索システム (Flask) を起動しました (port 5000)"
  else
    echo "❌ 経路検索システムの起動に失敗しました"
    exit 1
  fi
fi

# 2. トンネル起動（config-lenovo で fmaps/lenovo 等を一括公開）
if pgrep -f "cloudflared.*config-lenovo" > /dev/null; then
  echo "✅ トンネル (fmaps.schale41.jp 含む) は既に起動中です"
else
  # fmaps 専用トンネルは使わず、lenovo トンネルで fmaps を公開（1033 回避）
  nohup /usr/local/bin/cloudflared tunnel --config /home/kbt0/.cloudflared/config-lenovo.yml run >> lenovo-tunnel.log 2>&1 &
  sleep 4
  if pgrep -f "cloudflared.*config-lenovo" > /dev/null; then
    echo "✅ トンネルを起動しました (fmaps.schale41.jp → localhost:5000)"
  else
    echo "❌ トンネルの起動に失敗しました"
    exit 1
  fi
fi

echo ""
echo "🌐 https://fmaps.schale41.jp でアクセスできます"
echo ""
