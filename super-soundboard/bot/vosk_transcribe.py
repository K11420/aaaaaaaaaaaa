#!/usr/bin/env python3
"""
Vosk リアルタイム音声認識スクリプト（高速版）
標準入力からPCMデータを受け取り、リアルタイムで認識結果を出力
"""

import sys
import os
import json

def main():
    try:
        from vosk import Model, KaldiRecognizer, SetLogLevel
        SetLogLevel(-1)  # ログを抑制して高速化
    except ImportError:
        print("ERROR: vosk not installed", file=sys.stderr)
        sys.exit(1)
    
    # サンプルレート（環境変数で指定可能）
    sample_rate = int(os.environ.get('VOSK_SAMPLE_RATE', '16000'))
    model_path = os.environ.get('VOSK_MODEL_PATH', './models/vosk-model-ja')
    
    if not os.path.exists(model_path):
        print(f"ERROR: Model not found at {model_path}", file=sys.stderr)
        sys.exit(1)
    
    # モデルロード
    model = Model(model_path)
    recognizer = KaldiRecognizer(model, sample_rate)
    recognizer.SetWords(False)  # 単語タイムスタンプ不要で高速化
    recognizer.SetPartialWords(False)  # 部分単語も不要
    
    # バッファサイズを大きくして効率化
    buffer_size = 8000
    
    while True:
        data = sys.stdin.buffer.read(buffer_size)
        if len(data) == 0:
            break
        
        if recognizer.AcceptWaveform(data):
            result = json.loads(recognizer.Result())
            text = result.get('text', '').strip()
            if text:
                print(json.dumps({"type": "final", "text": text}), flush=True)
        else:
            # 部分結果は頻度を下げる（50ms以上間隔）
            partial = json.loads(recognizer.PartialResult())
            text = partial.get('partial', '').strip()
            if text and len(text) > 2:
                print(json.dumps({"type": "partial", "text": text}), flush=True)
    
    # 最終結果
    result = json.loads(recognizer.FinalResult())
    text = result.get('text', '').strip()
    if text:
        print(json.dumps({"type": "final", "text": text}), flush=True)

if __name__ == "__main__":
    main()
