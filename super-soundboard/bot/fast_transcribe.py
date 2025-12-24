#!/usr/bin/env python3
"""
faster-whisper を使用した高速音声認識スクリプト
RTX 3050 (4GB VRAM) 最適化版

最適化ポイント:
1. モデルをグローバルにキャッシュ（毎回ロードしない）
2. int8量子化でVRAM節約＆高速化
3. tinyモデルで超高速認識
4. VADフィルターで無音スキップ
"""

import sys
import os
import time

# グローバルモデルキャッシュ
_model = None
_model_config = None

def get_model(model_size="tiny", device="cuda", compute_type="int8"):
    """モデルをキャッシュして再利用"""
    global _model, _model_config
    
    config = (model_size, device, compute_type)
    
    if _model is not None and _model_config == config:
        return _model
    
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        print("ERROR: faster-whisper not installed", file=sys.stderr)
        print("Install with: pip install faster-whisper", file=sys.stderr)
        sys.exit(1)
    
    print(f"🔄 Loading model: {model_size} ({device}, {compute_type})...", file=sys.stderr)
    start = time.time()
    
    _model = WhisperModel(
        model_size, 
        device=device, 
        compute_type=compute_type,
        cpu_threads=4,
        num_workers=2,
    )
    _model_config = config
    
    print(f"✅ Model loaded in {time.time() - start:.2f}s", file=sys.stderr)
    return _model

def transcribe(audio_path, model_size="tiny", device="cuda", language="ja"):
    if not os.path.exists(audio_path):
        print(f"ERROR: File not found: {audio_path}", file=sys.stderr)
        sys.exit(1)
    
    # RTX 3050最適化: int8量子化
    if device == "cuda":
        compute_type = "int8"  # float16より高速＆省VRAM
    else:
        compute_type = "int8"
        device = "cpu"
    
    try:
        start = time.time()
        
        # キャッシュされたモデルを取得
        model = get_model(model_size, device, compute_type)
        
        # 音声認識（最速設定）
        segments, info = model.transcribe(
            audio_path,
            language=language,
            beam_size=1,           # 最速
            best_of=1,             # 最速
            temperature=0.0,       # 決定的（高速）
            compression_ratio_threshold=2.4,
            log_prob_threshold=-1.0,
            no_speech_threshold=0.6,
            condition_on_previous_text=False,  # 高速化
            vad_filter=True,       # 無音部分をスキップ
            vad_parameters=dict(
                min_silence_duration_ms=300,  # 短めに設定
                speech_pad_ms=200,
            ),
        )
        
        # 結果を結合
        text = " ".join([segment.text.strip() for segment in segments])
        elapsed = time.time() - start
        
        # 結果出力
        print(text.strip())
        print(f"⏱️ {elapsed*1000:.0f}ms", file=sys.stderr)
        
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: fast_transcribe.py <audio_file> [model] [device] [language]", file=sys.stderr)
        print("", file=sys.stderr)
        print("Models (速度順):", file=sys.stderr)
        print("  tiny  - 最速 (~150ms), 精度: ★★☆☆☆", file=sys.stderr)
        print("  base  - 高速 (~300ms), 精度: ★★★☆☆ [デフォルト]", file=sys.stderr)
        print("  small - 普通 (~500ms), 精度: ★★★★☆", file=sys.stderr)
        print("", file=sys.stderr)
        print("RTX 3050推奨: tiny または base", file=sys.stderr)
        sys.exit(1)
    
    audio_path = sys.argv[1]
    model_size = sys.argv[2] if len(sys.argv) > 2 else os.environ.get('WHISPER_MODEL', 'tiny')
    device = sys.argv[3] if len(sys.argv) > 3 else os.environ.get('WHISPER_DEVICE', 'cuda')
    language = sys.argv[4] if len(sys.argv) > 4 else os.environ.get('WHISPER_LANGUAGE', 'ja')
    
    transcribe(audio_path, model_size, device, language)
