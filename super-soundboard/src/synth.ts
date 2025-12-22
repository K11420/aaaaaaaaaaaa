// Web Audio APIを使ったシンプルなサウンド生成
export class SynthSounds {
  private audioContext: AudioContext | null = null;

  private getContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
    }
    return this.audioContext;
  }

  // やばい！のサウンド
  yabai() {
    const ctx = this.getContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.3);
    
    gain.gain.setValueAtTime(0.5, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  }

  // すごい！のサウンド（上昇音）
  sugoi() {
    const ctx = this.getContext();
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'triangle';
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      const startTime = ctx.currentTime + i * 0.1;
      
      osc.frequency.setValueAtTime(freq, startTime);
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.3, startTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.2);
      
      osc.start(startTime);
      osc.stop(startTime + 0.2);
    });
  }

  // 草（笑い声風）
  kusa() {
    const ctx = this.getContext();
    
    for (let i = 0; i < 5; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'square';
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      const startTime = ctx.currentTime + i * 0.08;
      
      osc.frequency.setValueAtTime(400 + Math.random() * 200, startTime);
      gain.gain.setValueAtTime(0.15, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.06);
      
      osc.start(startTime);
      osc.stop(startTime + 0.06);
    }
  }

  // 大丈夫（安心音）
  daijoubu() {
    const ctx = this.getContext();
    const notes = [392, 493.88, 587.33]; // G4, B4, D5
    
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      const startTime = ctx.currentTime + i * 0.15;
      
      osc.frequency.setValueAtTime(freq, startTime);
      gain.gain.setValueAtTime(0.25, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.4);
      
      osc.start(startTime);
      osc.stop(startTime + 0.4);
    });
  }

  // ナイス！（ファンファーレ）
  nice() {
    const ctx = this.getContext();
    const melody = [
      { freq: 523.25, time: 0 },
      { freq: 659.25, time: 0.1 },
      { freq: 783.99, time: 0.2 },
      { freq: 1046.50, time: 0.3 },
    ];
    
    melody.forEach(({ freq, time }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'square';
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      const startTime = ctx.currentTime + time;
      
      osc.frequency.setValueAtTime(freq, startTime);
      gain.gain.setValueAtTime(0.2, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.15);
      
      osc.start(startTime);
      osc.stop(startTime + 0.15);
    });
  }

  // 失敗（下降音）
  fail() {
    const ctx = this.getContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sawtooth';
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.frequency.setValueAtTime(400, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.5);
    
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  }

  // 勝利
  victory() {
    const ctx = this.getContext();
    const melody = [
      { freq: 523.25, time: 0, duration: 0.15 },
      { freq: 659.25, time: 0.15, duration: 0.15 },
      { freq: 783.99, time: 0.3, duration: 0.15 },
      { freq: 1046.50, time: 0.45, duration: 0.4 },
    ];
    
    melody.forEach(({ freq, time, duration }) => {
      const osc = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'triangle';
      osc2.type = 'sine';
      osc.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);
      
      const startTime = ctx.currentTime + time;
      
      osc.frequency.setValueAtTime(freq, startTime);
      osc2.frequency.setValueAtTime(freq * 2, startTime);
      gain.gain.setValueAtTime(0.2, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
      
      osc.start(startTime);
      osc.stop(startTime + duration);
      osc2.start(startTime);
      osc2.stop(startTime + duration);
    });
  }

  // 敗北
  defeat() {
    const ctx = this.getContext();
    const melody = [
      { freq: 293.66, time: 0 },
      { freq: 261.63, time: 0.3 },
      { freq: 233.08, time: 0.6 },
    ];
    
    melody.forEach(({ freq, time }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      const startTime = ctx.currentTime + time;
      
      osc.frequency.setValueAtTime(freq, startTime);
      gain.gain.setValueAtTime(0.25, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.4);
      
      osc.start(startTime);
      osc.stop(startTime + 0.4);
    });
  }

  // ありがとう
  thanks() {
    const ctx = this.getContext();
    const notes = [392, 440, 493.88, 523.25]; // G4, A4, B4, C5
    
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      const startTime = ctx.currentTime + i * 0.12;
      
      osc.frequency.setValueAtTime(freq, startTime);
      gain.gain.setValueAtTime(0.2, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.2);
      
      osc.start(startTime);
      osc.stop(startTime + 0.2);
    });
  }

  // PayPay（あの音）
  paypay() {
    const ctx = this.getContext();
    
    // ペイ（高い音）
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    
    osc1.type = 'triangle';
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    
    osc1.frequency.setValueAtTime(880, ctx.currentTime);
    osc1.frequency.setValueAtTime(1046.50, ctx.currentTime + 0.1);
    gain1.gain.setValueAtTime(0.3, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
    
    osc1.start();
    osc1.stop(ctx.currentTime + 0.2);
    
    // ペイ（続き）
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    
    osc2.type = 'triangle';
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    
    const startTime2 = ctx.currentTime + 0.25;
    
    osc2.frequency.setValueAtTime(1046.50, startTime2);
    osc2.frequency.setValueAtTime(1318.51, startTime2 + 0.15);
    gain2.gain.setValueAtTime(0.3, startTime2);
    gain2.gain.exponentialRampToValueAtTime(0.01, startTime2 + 0.3);
    
    osc2.start(startTime2);
    osc2.stop(startTime2 + 0.3);
  }
}

// シングルトン
export const synth = new SynthSounds();
