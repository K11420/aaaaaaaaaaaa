#!/usr/bin/env python3
"""
faster-whisper を使用した高速音声認識スクリプト
通常のWhisperより3-4倍高速
"""

import sys
import os

def transcribe(audio_path, model_size="base", device="cuda", language="ja"):
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        print("ERROR: faster-whisper not installed", file=sys.stderr)
        print("Install with: pip install faster-whisper", file=sys.stderr)
        sys.exit(1)
    
    if not os.path.exists(audio_path):
        print(f"ERROR: File not found: {audio_path}", file=sys.stderr)
        sys.exit(1)
    
    # デバイス設定
    if device == "cuda":
        compute_type = "float16"
    else:
        compute_type = "int8"
        device = "cpu"
    
    try:
        # モデルロード（キャッシュされる）
        model = WhisperModel(model_size, device=device, compute_type=compute_type)
        
        # 音声認識（beam_size=1で高速化）
        segments, info = model.transcribe(
            audio_path,
            language=language,
            beam_size=1,
            best_of=1,
            vad_filter=True,  # 無音部分をスキップ
            vad_parameters=dict(
                min_silence_duration_ms=500,
            ),
        )
        
        # 結果を結合
        text = " ".join([segment.text.strip() for segment in segments])
        print(text.strip())
        
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: fast_transcribe.py <audio_file> [model] [device] [language]", file=sys.stderr)
        sys.exit(1)
    
    audio_path = sys.argv[1]
    model_size = sys.argv[2] if len(sys.argv) > 2 else "base"
    device = sys.argv[3] if len(sys.argv) > 3 else "cuda"
    language = sys.argv[4] if len(sys.argv) > 4 else "ja"
    
    transcribe(audio_path, model_size, device, language)
