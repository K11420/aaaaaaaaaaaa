import type { SpeechRecognition, SpeechRecognitionEvent } from './types';

export class SpeechRecognizer {
  private recognition: SpeechRecognition | null = null;
  private isListening = false;
  private onTranscript: (final: string, interim: string) => void;
  private onStateChange: (isListening: boolean) => void;
  private onError: (error: string) => void;

  constructor(
    onTranscript: (final: string, interim: string) => void,
    onStateChange: (isListening: boolean) => void,
    onError: (error: string) => void
  ) {
    this.onTranscript = onTranscript;
    this.onStateChange = onStateChange;
    this.onError = onError;
    this.init();
  }

  private init() {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognitionAPI) {
      this.onError('お使いのブラウザはWeb Speech APIに対応していません。Google Chromeをお使いください。');
      return;
    }

    this.recognition = new SpeechRecognitionAPI();
    this.recognition.lang = 'ja-JP';
    this.recognition.continuous = true;
    this.recognition.interimResults = true;

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      let finalText = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalText += text;
        } else {
          interim += text;
        }
      }

      this.onTranscript(finalText, interim);
    };

    this.recognition.onerror = (event: Event) => {
      const errorEvent = event as Event & { error: string };
      console.error('Speech recognition error:', errorEvent.error);
      
      if (errorEvent.error === 'not-allowed') {
        this.onError('マイクへのアクセスが許可されていません。ブラウザの設定を確認してください。');
      } else if (errorEvent.error === 'no-speech') {
        // 無視 - 音声が検出されなかった場合
      } else {
        this.onError(`音声認識エラー: ${errorEvent.error}`);
      }
    };

    this.recognition.onend = () => {
      // 継続モードの場合、自動で再開
      if (this.isListening) {
        try {
          this.recognition?.start();
        } catch (e) {
          console.log('Restarting recognition...');
        }
      } else {
        this.onStateChange(false);
      }
    };

    this.recognition.onstart = () => {
      this.onStateChange(true);
    };
  }

  start() {
    if (!this.recognition) {
      this.onError('音声認識が初期化されていません');
      return;
    }

    try {
      this.isListening = true;
      this.recognition.start();
    } catch (e) {
      console.error('Failed to start recognition:', e);
    }
  }

  stop() {
    this.isListening = false;
    this.recognition?.stop();
    this.onStateChange(false);
  }

  toggle() {
    if (this.isListening) {
      this.stop();
    } else {
      this.start();
    }
  }

  getIsListening() {
    return this.isListening;
  }
}
