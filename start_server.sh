#!/bin/bash

echo "===================================================="
echo "🛣️ CV経路探索システム - ローカル起動スクリプト (Linux/Mac)"
echo "===================================================="

# Python バージョンチェック
if ! command -v python3 &> /dev/null; then
    if ! command -v python &> /dev/null; then
        echo "❌ Python が見つかりません。Python 3.8以上をインストールしてください。"
        exit 1
    else
        PYTHON_CMD="python"
    fi
else
    PYTHON_CMD="python3"
fi

echo "✅ Python が見つかりました: $($PYTHON_CMD --version)"

# 依存関係チェック
echo "📦 依存関係をチェック中..."
if ! $PYTHON_CMD -c "import flask" &> /dev/null; then
    echo "⚠️ 依存関係が不足しています。インストール中..."
    
    # pipコマンドの確認
    if command -v pip3 &> /dev/null; then
        PIP_CMD="pip3"
    elif command -v pip &> /dev/null; then
        PIP_CMD="pip"
    else
        echo "❌ pip が見つかりません。pip をインストールしてください。"
        exit 1
    fi
    
    $PIP_CMD install -r requirements.txt
    
    if [ $? -ne 0 ]; then
        echo "❌ 依存関係のインストールに失敗しました。"
        exit 1
    fi
fi

echo "✅ 依存関係OK"

# サーバー起動
echo "🚀 サーバーを起動中..."
echo "📍 アクセスURL: http://localhost:9000"
echo "🛑 停止するには Ctrl+C を押してください"
echo "===================================================="

$PYTHON_CMD app.py --port 9000