#!/bin/bash
# 経路検索システム + fmaps トンネルを停止

echo "🛑 すべてを停止しています..."

pkill -f "python.*app.py" 2>/dev/null && echo "✅ 経路検索システム (Flask) を停止しました" || echo "  (Flask は起動していませんでした)"
pkill -f "cloudflared.*fmaps-config" 2>/dev/null
pkill -f "cloudflared.*config-lenovo" 2>/dev/null && echo "✅ トンネル (fmaps/lenovo) を停止しました" || echo "  (トンネルは起動していませんでした)"

echo ""
echo "完了しました"
