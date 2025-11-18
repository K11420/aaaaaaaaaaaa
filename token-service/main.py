"""
東京都AI トークン取得サーバー
Playwright + FastAPI

Microsoftアカウントでログインして、新しいチャットを作成し、
Bearerトークンを自動取得するサービス
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeout
import asyncio
import os
from typing import Optional
from dotenv import load_dotenv
import logging

# ロギング設定
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 環境変数の読み込み
load_dotenv()

# FastAPIアプリケーション初期化
app = FastAPI(
    title="東京都AI トークン取得サービス",
    description="Microsoftログインして新チャット作成、Bearerトークンを自動取得",
    version="1.0.0"
)

# CORS設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 本番環境では制限してください
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# リクエストモデル
class TokenRequest(BaseModel):
    microsoft_email: str
    microsoft_password: str
    timeout: Optional[int] = 60000  # デフォルト60秒

# レスポンスモデル
class TokenResponse(BaseModel):
    success: bool
    token: Optional[str] = None
    session_id: Optional[str] = None
    error: Optional[str] = None
    details: Optional[str] = None

# グローバルブラウザインスタンス（再利用）
browser_instance = None
playwright_instance = None

# ========================================
# ブラウザ初期化
# ========================================
async def get_browser():
    """ブラウザインスタンスを取得（シングルトン）"""
    global browser_instance, playwright_instance
    
    if browser_instance is None or not browser_instance.is_connected():
        logger.info("🌐 新しいブラウザインスタンスを起動")
        playwright_instance = await async_playwright().start()
        browser_instance = await playwright_instance.chromium.launch(
            headless=True,
            args=[
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-blink-features=AutomationControlled'
            ]
        )
    
    return browser_instance

# ========================================
# トークン取得メイン処理
# ========================================
async def fetch_tokyo_ai_token(email: str, password: str, timeout: int = 60000) -> TokenResponse:
    """
    Microsoftアカウントでログインして、新しいチャットを作成し、Bearerトークンを取得
    """
    browser = None
    context = None
    page = None
    
    try:
        logger.info(f"🚀 トークン取得開始: {email}")
        
        # ブラウザ取得
        browser = await get_browser()
        
        # 新しいコンテキストとページ作成
        context = await browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        )
        page = await context.new_page()
        
        # リクエストを監視してBearerトークンを取得
        bearer_token = None
        
        async def handle_request(request):
            nonlocal bearer_token
            if 'chat/message' in request.url:
                auth_header = request.headers.get('authorization', '')
                if auth_header.startswith('Bearer '):
                    bearer_token = auth_header.replace('Bearer ', '')
                    logger.info(f"✅ Bearerトークン取得成功: {bearer_token[:20]}...")
        
        page.on('request', handle_request)
        
        # Step 1: 東京都AIサイトにアクセス
        logger.info("📡 東京都AIサイトにアクセス中...")
        await page.goto('https://ai.metro.tokyo.lg.jp/chattomo/conversation', 
                       wait_until='domcontentloaded',
                       timeout=timeout)
        
        # ページが完全に読み込まれるまで待機
        await page.wait_for_timeout(3000)
        
        # Step 2: ログインボタンを探してクリック
        logger.info("🔍 ログインボタンを探しています...")
        
        # 複数のセレクタを試行
        login_selectors = [
            'text="ログイン"',
            'text="サインイン"',
            'text="Sign in"',
            'button:has-text("ログイン")',
            'a:has-text("ログイン")',
            '[href*="login"]',
            '[href*="signin"]'
        ]
        
        login_clicked = False
        for selector in login_selectors:
            try:
                if await page.locator(selector).count() > 0:
                    logger.info(f"🖱️ ログインボタンをクリック: {selector}")
                    await page.locator(selector).first.click(timeout=5000)
                    login_clicked = True
                    break
            except Exception as e:
                continue
        
        if not login_clicked:
            # すでにログイン済みの可能性があるので、チャットページに直接アクセス
            logger.info("ℹ️ ログインボタンが見つからない - すでにログイン済みの可能性")
        else:
            # Microsoftログインページが表示されるまで待機
            await page.wait_for_timeout(2000)
            
            # Step 3: Microsoftメールアドレス入力
            logger.info("📧 Microsoftメールアドレスを入力中...")
            
            # メール入力欄のセレクタ
            email_selectors = [
                'input[type="email"]',
                'input[name="loginfmt"]',
                'input[placeholder*="メール"]',
                'input[placeholder*="Email"]'
            ]
            
            email_input = None
            for selector in email_selectors:
                try:
                    if await page.locator(selector).count() > 0:
                        email_input = page.locator(selector).first
                        break
                except:
                    continue
            
            if email_input:
                await email_input.fill(email)
                await page.wait_for_timeout(500)
                
                # 次へボタンをクリック
                next_button_selectors = ['input[type="submit"]', 'button[type="submit"]', 'text="次へ"', 'text="Next"']
                for selector in next_button_selectors:
                    try:
                        if await page.locator(selector).count() > 0:
                            await page.locator(selector).first.click()
                            break
                    except:
                        continue
                
                await page.wait_for_timeout(2000)
            
            # Step 4: Microsoftパスワード入力
            logger.info("🔒 Microsoftパスワードを入力中...")
            
            password_selectors = [
                'input[type="password"]',
                'input[name="passwd"]',
                'input[placeholder*="パスワード"]',
                'input[placeholder*="Password"]'
            ]
            
            password_input = None
            for selector in password_selectors:
                try:
                    if await page.locator(selector).count() > 0:
                        password_input = page.locator(selector).first
                        break
                except:
                    continue
            
            if password_input:
                await password_input.fill(password)
                await page.wait_for_timeout(500)
                
                # サインインボタンをクリック
                signin_button_selectors = ['input[type="submit"]', 'button[type="submit"]', 'text="サインイン"', 'text="Sign in"']
                for selector in signin_button_selectors:
                    try:
                        if await page.locator(selector).count() > 0:
                            await page.locator(selector).first.click()
                            break
                    except:
                        continue
                
                await page.wait_for_timeout(3000)
            
            # Step 5: 「サインインの状態を維持しますか？」の処理
            try:
                stay_signed_in_selectors = ['text="はい"', 'text="Yes"', 'button:has-text("はい")', 'input[value="はい"]']
                for selector in stay_signed_in_selectors:
                    try:
                        if await page.locator(selector).count() > 0:
                            logger.info("✔️ サインインの状態を維持")
                            await page.locator(selector).first.click(timeout=3000)
                            break
                    except:
                        continue
            except:
                pass
            
            await page.wait_for_timeout(3000)
        
        # Step 6: チャットページに戻る/確認
        logger.info("💬 チャットページを確認中...")
        current_url = page.url
        if 'conversation' not in current_url:
            await page.goto('https://ai.metro.tokyo.lg.jp/chattomo/conversation', 
                           wait_until='domcontentloaded',
                           timeout=timeout)
            await page.wait_for_timeout(2000)
        
        # Step 7: 新しいチャットを作成（オプション - トークン取得には必須ではない）
        logger.info("🆕 新しいチャット作成を試みます...")
        
        new_chat_selectors = [
            'text="新しいチャット"',
            'text="New Chat"',
            'button:has-text("新しいチャット")',
            '[aria-label*="新しいチャット"]'
        ]
        
        for selector in new_chat_selectors:
            try:
                if await page.locator(selector).count() > 0:
                    await page.locator(selector).first.click(timeout=3000)
                    logger.info("✅ 新しいチャットを作成しました")
                    await page.wait_for_timeout(1000)
                    break
            except:
                continue
        
        # Step 8: ダミーメッセージを送信してトークンを取得
        if not bearer_token:
            logger.info("📤 ダミーメッセージを送信してトークンを取得...")
            
            # テキスト入力欄を探す
            input_selectors = [
                'textarea',
                'input[type="text"]',
                '[contenteditable="true"]',
                '[placeholder*="メッセージ"]',
                '[placeholder*="Message"]'
            ]
            
            message_input = None
            for selector in input_selectors:
                try:
                    if await page.locator(selector).count() > 0:
                        message_input = page.locator(selector).first
                        break
                except:
                    continue
            
            if message_input:
                await message_input.fill("こんにちは")
                await page.wait_for_timeout(500)
                
                # 送信ボタンをクリック
                send_button_selectors = [
                    'button[type="submit"]',
                    'button:has-text("送信")',
                    'button:has-text("Send")',
                    '[aria-label*="送信"]'
                ]
                
                for selector in send_button_selectors:
                    try:
                        if await page.locator(selector).count() > 0:
                            await page.locator(selector).first.click()
                            break
                    except:
                        continue
                
                # トークンが取得されるまで待機
                max_wait = 10
                for i in range(max_wait):
                    if bearer_token:
                        break
                    await page.wait_for_timeout(1000)
                    logger.info(f"⏳ トークン取得待機中... ({i+1}/{max_wait}秒)")
            
        # Step 9: 結果を返す
        if bearer_token:
            logger.info(f"🎉 トークン取得成功！")
            return TokenResponse(
                success=True,
                token=bearer_token,
                session_id=None  # 必要に応じてセッションIDも抽出可能
            )
        else:
            logger.warning("⚠️ トークンを取得できませんでした")
            return TokenResponse(
                success=False,
                error="トークンを取得できませんでした",
                details="チャットメッセージの送信後、ネットワークリクエストからトークンを取得できませんでした"
            )
    
    except PlaywrightTimeout as e:
        logger.error(f"⏱️ タイムアウトエラー: {str(e)}")
        return TokenResponse(
            success=False,
            error="タイムアウト",
            details=f"処理がタイムアウトしました: {str(e)}"
        )
    
    except Exception as e:
        logger.error(f"❌ エラー発生: {str(e)}", exc_info=True)
        return TokenResponse(
            success=False,
            error="予期しないエラー",
            details=str(e)
        )
    
    finally:
        # クリーンアップ
        if page:
            await page.close()
        if context:
            await context.close()

# ========================================
# APIエンドポイント
# ========================================

@app.get("/")
async def root():
    """ルートエンドポイント"""
    return {
        "service": "東京都AI トークン取得サービス",
        "version": "1.0.0",
        "status": "running",
        "endpoints": {
            "health": "/health",
            "get_token": "/api/get-token (POST)"
        }
    }

@app.get("/health")
async def health_check():
    """ヘルスチェック"""
    return {
        "status": "healthy",
        "service": "token-service",
        "browser_ready": browser_instance is not None and browser_instance.is_connected()
    }

@app.post("/api/get-token", response_model=TokenResponse)
async def get_token(request: TokenRequest):
    """
    Bearerトークンを取得
    
    - **microsoft_email**: Microsoftアカウントのメールアドレス
    - **microsoft_password**: Microsoftアカウントのパスワード
    - **timeout**: タイムアウト時間（ミリ秒、デフォルト60000）
    """
    logger.info(f"🔐 トークン取得リクエスト受信: {request.microsoft_email}")
    
    # トークン取得処理
    result = await fetch_tokyo_ai_token(
        email=request.microsoft_email,
        password=request.microsoft_password,
        timeout=request.timeout
    )
    
    if not result.success:
        logger.error(f"❌ トークン取得失敗: {result.error}")
        raise HTTPException(status_code=500, detail=result.error)
    
    return result

# ========================================
# アプリケーション起動/終了処理
# ========================================

@app.on_event("startup")
async def startup_event():
    """アプリケーション起動時の処理"""
    logger.info("🚀 トークン取得サービスを起動しています...")
    # ブラウザの事前初期化（オプション）
    # await get_browser()

@app.on_event("shutdown")
async def shutdown_event():
    """アプリケーション終了時の処理"""
    logger.info("🛑 トークン取得サービスを終了しています...")
    global browser_instance, playwright_instance
    
    if browser_instance:
        await browser_instance.close()
    
    if playwright_instance:
        await playwright_instance.stop()

# ========================================
# メイン実行
# ========================================

if __name__ == "__main__":
    import uvicorn
    
    port = int(os.getenv("PORT", 8000))
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=True,
        log_level="info"
    )
