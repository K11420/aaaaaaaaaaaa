@echo off
echo ====================================================
echo 🛣️ CV経路探索システム - ローカル起動スクリプト (Windows)
echo ====================================================

REM Python バージョンチェック
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Python が見つかりません。Python 3.8以上をインストールしてください。
    pause
    exit /b 1
)

echo ✅ Python が見つかりました。

REM 依存関係チェック
echo 📦 依存関係をチェック中...
pip show flask >nul 2>&1
if %errorlevel% neq 0 (
    echo ⚠️  依存関係が不足しています。インストール中...
    pip install -r requirements.txt
    if %errorlevel% neq 0 (
        echo ❌ 依存関係のインストールに失敗しました。
        pause
        exit /b 1
    )
)

echo ✅ 依存関係OK

REM サーバー起動
echo 🚀 サーバーを起動中...
echo 📍 アクセスURL: http://localhost:9000
echo 🛑 停止するには Ctrl+C を押してください
echo ====================================================

python app.py --port 9000

pause