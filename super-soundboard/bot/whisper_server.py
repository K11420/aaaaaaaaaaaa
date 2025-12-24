#!/usr/bin/env python3
"""
faster-whisper 常駐サーバー
モデルをメモリに保持して超高速認識 (100-200ms)

使い方:
  1. サーバー起動: python whisper_server.py
  2. 認識リクエスト: echo "/path/to/audio.wav" | nc localhost 5555
  
または HTTP API:
  curl -X POST http://localhost:5556/transcribe -F "audio=@audio.wav"
"""

import os
import sys
import time
import socket
import threading
import tempfile
from http.server import HTTPServer, BaseHTTPRequestHandler
import cgi

# 設定
MODEL_SIZE = os.environ.get('WHISPER_MODEL', 'tiny')
DEVICE = os.environ.get('WHISPER_DEVICE', 'cuda')
LANGUAGE = os.environ.get('WHISPER_LANGUAGE', 'ja')
SOCKET_PORT = int(os.environ.get('WHISPER_SOCKET_PORT', 5555))
HTTP_PORT = int(os.environ.get('WHISPER_HTTP_PORT', 5556))

# グローバルモデル
model = None

def load_model():
    global model
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        print("❌ faster-whisper not installed")
        print("   pip install faster-whisper")
        sys.exit(1)
    
    # RTX 3050最適化
    compute_type = "int8"
    
    print(f"🔄 Loading faster-whisper model: {MODEL_SIZE}")
    print(f"   Device: {DEVICE}, Compute: {compute_type}")
    start = time.time()
    
    model = WhisperModel(
        MODEL_SIZE,
        device=DEVICE,
        compute_type=compute_type,
        cpu_threads=4,
        num_workers=2,
    )
    
    print(f"✅ Model loaded in {time.time() - start:.2f}s")
    print(f"🚀 Ready for transcription!")
    return model

def transcribe(audio_path):
    """音声認識を実行"""
    if not os.path.exists(audio_path):
        return None, f"File not found: {audio_path}"
    
    start = time.time()
    
    try:
        segments, info = model.transcribe(
            audio_path,
            language=LANGUAGE,
            beam_size=1,
            best_of=1,
            temperature=0.0,
            condition_on_previous_text=False,
            vad_filter=True,
            vad_parameters=dict(
                min_silence_duration_ms=300,
                speech_pad_ms=200,
            ),
        )
        
        text = " ".join([seg.text.strip() for seg in segments]).strip()
        elapsed = time.time() - start
        
        return text, f"{elapsed*1000:.0f}ms"
    
    except Exception as e:
        return None, str(e)

# === Socket Server ===
def socket_server():
    """TCPソケットサーバー（超低遅延）"""
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server.bind(('localhost', SOCKET_PORT))
    server.listen(5)
    print(f"📡 Socket server listening on localhost:{SOCKET_PORT}")
    
    while True:
        client, addr = server.accept()
        try:
            data = client.recv(4096).decode().strip()
            if data:
                text, timing = transcribe(data)
                if text is not None:
                    client.send(f"{text}\n".encode())
                    print(f"📝 [{timing}] \"{text}\"")
                else:
                    client.send(f"ERROR: {timing}\n".encode())
        except Exception as e:
            print(f"Socket error: {e}")
        finally:
            client.close()

# === HTTP Server ===
class TranscribeHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass  # ログ抑制
    
    def do_POST(self):
        if self.path == '/transcribe':
            content_type = self.headers.get('Content-Type', '')
            
            if 'multipart/form-data' in content_type:
                # ファイルアップロード
                form = cgi.FieldStorage(
                    fp=self.rfile,
                    headers=self.headers,
                    environ={'REQUEST_METHOD': 'POST'}
                )
                
                if 'audio' in form:
                    audio_data = form['audio'].file.read()
                    
                    # 一時ファイルに保存
                    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as f:
                        f.write(audio_data)
                        temp_path = f.name
                    
                    try:
                        text, timing = transcribe(temp_path)
                        if text is not None:
                            self.send_response(200)
                            self.send_header('Content-Type', 'application/json')
                            self.end_headers()
                            import json
                            self.wfile.write(json.dumps({
                                'text': text,
                                'time': timing
                            }).encode())
                            print(f"📝 [{timing}] \"{text}\"")
                        else:
                            self.send_error(500, timing)
                    finally:
                        os.unlink(temp_path)
                    return
            
            # パスで指定
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length).decode().strip()
            
            if body:
                text, timing = transcribe(body)
                if text is not None:
                    self.send_response(200)
                    self.send_header('Content-Type', 'text/plain')
                    self.end_headers()
                    self.wfile.write(f"{text}\n".encode())
                    print(f"📝 [{timing}] \"{text}\"")
                else:
                    self.send_error(500, timing)
            else:
                self.send_error(400, "No audio path provided")
        else:
            self.send_error(404)
    
    def do_GET(self):
        if self.path == '/health':
            self.send_response(200)
            self.send_header('Content-Type', 'text/plain')
            self.end_headers()
            self.wfile.write(b"OK")
        elif self.path == '/':
            self.send_response(200)
            self.send_header('Content-Type', 'text/html')
            self.end_headers()
            self.wfile.write(f"""
<!DOCTYPE html>
<html>
<head><title>Whisper Server</title></head>
<body>
<h1>🎤 Whisper Server</h1>
<p>Model: {MODEL_SIZE} ({DEVICE})</p>
<h2>API</h2>
<pre>
# ファイルパスで認識
curl -X POST http://localhost:{HTTP_PORT}/transcribe -d "/path/to/audio.wav"

# ファイルアップロードで認識
curl -X POST http://localhost:{HTTP_PORT}/transcribe -F "audio=@audio.wav"
</pre>
</body>
</html>
""".encode())
        else:
            self.send_error(404)

def http_server():
    """HTTPサーバー"""
    server = HTTPServer(('localhost', HTTP_PORT), TranscribeHandler)
    print(f"🌐 HTTP server listening on http://localhost:{HTTP_PORT}")
    server.serve_forever()

if __name__ == "__main__":
    print("=" * 50)
    print("🚀 faster-whisper Server")
    print("=" * 50)
    
    # モデルロード
    load_model()
    
    print()
    print(f"📡 Socket: localhost:{SOCKET_PORT}")
    print(f"🌐 HTTP:   http://localhost:{HTTP_PORT}")
    print()
    
    # サーバー起動
    socket_thread = threading.Thread(target=socket_server, daemon=True)
    socket_thread.start()
    
    # HTTPサーバー（メインスレッド）
    try:
        http_server()
    except KeyboardInterrupt:
        print("\n👋 Shutting down...")
