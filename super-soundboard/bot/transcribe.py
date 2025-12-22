#!/usr/bin/env python3
"""
Simple Whisper transcription script for Discord voice recognition.
Usage: python3 transcribe.py <audio_file.wav>
Output: Transcribed text to stdout
"""
import sys
import os

# Add venv to path
venv_path = os.path.join(os.path.dirname(__file__), 'venv', 'lib', 'python3.10', 'site-packages')
sys.path.insert(0, venv_path)

import whisper
import warnings

warnings.filterwarnings("ignore")

def transcribe(audio_path):
    """Transcribe audio file using Whisper."""
    try:
        model = whisper.load_model("tiny")
        result = model.transcribe(audio_path, language="ja", fp16=False)
        text = result["text"].strip()
        print(text)
        return text
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return ""

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 transcribe.py <audio_file.wav>", file=sys.stderr)
        sys.exit(1)
    
    audio_file = sys.argv[1]
    if not os.path.exists(audio_file):
        print(f"File not found: {audio_file}", file=sys.stderr)
        sys.exit(1)
    
    transcribe(audio_file)
