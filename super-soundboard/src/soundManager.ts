import type { SoundMapping, DetectedKeyword } from './types';
import { synth } from './synth';
import { audioStorage } from './audioStorage';

// サウンド関数のマッピング（プリセット用）
type SoundFunction = () => void;

const presetSoundFunctions: Record<string, SoundFunction> = {
  'preset-1': () => synth.yabai(),
  'preset-2': () => synth.sugoi(),
  'preset-3': () => synth.kusa(),
  'preset-4': () => synth.daijoubu(),
  'preset-5': () => synth.nice(),
  'preset-6': () => synth.fail(),
  'preset-7': () => synth.victory(),
  'preset-8': () => synth.defeat(),
  'preset-9': () => synth.thanks(),
  'preset-10': () => synth.paypay(),
};

// プリセットのサウンドマッピング
export const defaultSoundMappings: SoundMapping[] = [
  {
    id: 'preset-1',
    keywords: ['やばい', 'ヤバい', 'ヤバイ', 'やべえ', 'やべー'],
    soundUrl: '',
    name: 'やばい！',
    emoji: '😱',
    enabled: true,
    isPreset: true
  },
  {
    id: 'preset-2',
    keywords: ['すごい', 'すげえ', 'すげー', 'スゴい', 'すっごい', '凄い'],
    soundUrl: '',
    name: 'すごい！',
    emoji: '✨',
    enabled: true,
    isPreset: true
  },
  {
    id: 'preset-3',
    keywords: ['草', 'わろた', 'ワロタ', 'ウケる', 'うける', '笑った'],
    soundUrl: '',
    name: '草www',
    emoji: '🌿',
    enabled: true,
    isPreset: true
  },
  {
    id: 'preset-4',
    keywords: ['大丈夫', 'だいじょうぶ', 'オッケー', 'オーケー', 'OK'],
    soundUrl: '',
    name: '大丈夫だ、問題ない',
    emoji: '👍',
    enabled: true,
    isPreset: true
  },
  {
    id: 'preset-5',
    keywords: ['ナイス', 'nice', 'ないす', 'いいね', 'いいぞ', 'グッド'],
    soundUrl: '',
    name: 'ナイス！',
    emoji: '🎉',
    enabled: true,
    isPreset: true
  },
  {
    id: 'preset-6',
    keywords: ['失敗', 'しっぱい', 'ミス', 'やっちまった', '死んだ', 'しんだ'],
    soundUrl: '',
    name: '失敗...',
    emoji: '💀',
    enabled: true,
    isPreset: true
  },
  {
    id: 'preset-7',
    keywords: ['勝った', 'かった', '勝利', 'やった', 'ウィン', 'win'],
    soundUrl: '',
    name: '勝利！',
    emoji: '🏆',
    enabled: true,
    isPreset: true
  },
  {
    id: 'preset-8',
    keywords: ['負けた', 'まけた', '敗北', 'ゲームオーバー'],
    soundUrl: '',
    name: '敗北...',
    emoji: '😭',
    enabled: true,
    isPreset: true
  },
  {
    id: 'preset-9',
    keywords: ['ありがとう', 'あざす', 'サンキュー', 'サンクス', 'あざっす'],
    soundUrl: '',
    name: 'ありがとう',
    emoji: '🙏',
    enabled: true,
    isPreset: true
  },
  {
    id: 'preset-10',
    keywords: ['ペイペイ', 'paypay', 'PayPay', '払って', 'はらって'],
    soundUrl: '',
    name: 'PayPay♪',
    emoji: '💰',
    enabled: true,
    isPreset: true
  }
];

export class SoundManager {
  private mappings: SoundMapping[];
  private history: DetectedKeyword[] = [];
  private onHistoryUpdate: (history: DetectedKeyword[]) => void;
  private onMappingsUpdate: (mappings: SoundMapping[]) => void;
  private onSoundPlay: ((soundName: string, soundData?: string, presetId?: string) => void) | null = null;
  private cooldownMap: Map<string, number> = new Map();
  private cooldownTime = 3000;
  private audioCache: Map<string, HTMLAudioElement> = new Map();
  private audioBlobUrls: Map<string, string> = new Map();
  private audioBlobs: Map<string, Blob> = new Map();

  constructor(
    onHistoryUpdate: (history: DetectedKeyword[]) => void,
    onMappingsUpdate: (mappings: SoundMapping[]) => void
  ) {
    this.mappings = [];
    this.onHistoryUpdate = onHistoryUpdate;
    this.onMappingsUpdate = onMappingsUpdate;
  }

  setOnSoundPlay(callback: (soundName: string, soundData?: string, presetId?: string) => void): void {
    this.onSoundPlay = callback;
  }

  async init(): Promise<void> {
    await audioStorage.init();
    this.mappings = await this.loadMappings();
    await this.preloadCustomSounds();
    this.onMappingsUpdate(this.mappings);
  }

  private async loadMappings(): Promise<SoundMapping[]> {
    const saved = localStorage.getItem('soundMappings_v2');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // プリセットと保存されたカスタムをマージ
        const customMappings = parsed.filter((m: SoundMapping) => !m.isPreset);
        return [...defaultSoundMappings, ...customMappings];
      } catch {
        return defaultSoundMappings;
      }
    }
    return defaultSoundMappings;
  }

  private async preloadCustomSounds(): Promise<void> {
    for (const mapping of this.mappings) {
      if (!mapping.isPreset && mapping.id) {
        try {
          const blob = await audioStorage.getAudio(mapping.id);
          if (blob) {
            const url = URL.createObjectURL(blob);
            this.audioBlobUrls.set(mapping.id, url);
            this.audioBlobs.set(mapping.id, blob);
            const audio = new Audio(url);
            audio.preload = 'auto';
            this.audioCache.set(mapping.id, audio);
          }
        } catch (err) {
          console.error('Failed to preload audio:', mapping.id, err);
        }
      }
    }
  }

  saveMappings(): void {
    localStorage.setItem('soundMappings_v2', JSON.stringify(this.mappings));
  }

  checkAndPlay(text: string): boolean {
    const lowerText = text.toLowerCase();
    
    for (const mapping of this.mappings) {
      if (!mapping.enabled) continue;
      
      for (const keyword of mapping.keywords) {
        if (lowerText.includes(keyword.toLowerCase())) {
          const lastPlayed = this.cooldownMap.get(mapping.id) || 0;
          const now = Date.now();
          
          if (now - lastPlayed > this.cooldownTime) {
            this.playSound(mapping.id, mapping.isPreset || false);
            this.cooldownMap.set(mapping.id, now);
            
            this.history.unshift({
              keyword: keyword,
              timestamp: new Date(),
              soundName: mapping.name
            });
            
            if (this.history.length > 50) {
              this.history.pop();
            }
            
            this.onHistoryUpdate([...this.history]);
            return true;
          }
        }
      }
    }
    
    return false;
  }

  private async playSound(id: string, isPreset: boolean): Promise<void> {
    const mapping = this.mappings.find(m => m.id === id);
    
    if (isPreset) {
      const playFn = presetSoundFunctions[id];
      if (playFn) {
        playFn();
      }
      // Discord連携：プリセットIDを送信
      if (this.onSoundPlay && mapping) {
        this.onSoundPlay(mapping.name, undefined, id);
      }
    } else {
      const audio = this.audioCache.get(id);
      if (audio) {
        audio.currentTime = 0;
        audio.volume = 0.7;
        audio.play().catch(err => console.error('Failed to play:', err));
      }
      
      // Discord連携：カスタムサウンドをBase64で送信
      if (this.onSoundPlay && mapping) {
        const blob = this.audioBlobs.get(id);
        if (blob) {
          const base64 = await this.blobToBase64(blob);
          this.onSoundPlay(mapping.name, base64);
        }
      }
    }
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  playById(id: string): void {
    const mapping = this.mappings.find(m => m.id === id);
    if (mapping) {
      this.playSound(id, mapping.isPreset || false);
    }
  }

  getMappings(): SoundMapping[] {
    return this.mappings;
  }

  toggleMapping(id: string): void {
    const mapping = this.mappings.find(m => m.id === id);
    if (mapping) {
      mapping.enabled = !mapping.enabled;
      this.saveMappings();
      this.onMappingsUpdate(this.mappings);
    }
  }

  async addCustomSound(
    name: string,
    emoji: string,
    keywords: string[],
    audioFile: File
  ): Promise<void> {
    const id = `custom-${Date.now()}`;
    
    // IndexedDBに保存
    await audioStorage.saveAudio(id, name, audioFile);
    
    // Blob URLを作成してキャッシュ
    const blob = await audioStorage.getAudio(id);
    if (blob) {
      const url = URL.createObjectURL(blob);
      this.audioBlobUrls.set(id, url);
      this.audioBlobs.set(id, blob);
      const audio = new Audio(url);
      audio.preload = 'auto';
      this.audioCache.set(id, audio);
    }
    
    const newMapping: SoundMapping = {
      id,
      keywords,
      soundUrl: '',
      name,
      emoji,
      enabled: true,
      isPreset: false
    };
    
    this.mappings.push(newMapping);
    this.saveMappings();
    this.onMappingsUpdate(this.mappings);
  }

  async removeMapping(id: string): Promise<void> {
    const mapping = this.mappings.find(m => m.id === id);
    if (!mapping || mapping.isPreset) return;
    
    // IndexedDBから削除
    await audioStorage.deleteAudio(id);
    
    // Blob URLを解放
    const blobUrl = this.audioBlobUrls.get(id);
    if (blobUrl) {
      URL.revokeObjectURL(blobUrl);
      this.audioBlobUrls.delete(id);
    }
    
    // キャッシュから削除
    this.audioCache.delete(id);
    
    // マッピングから削除
    this.mappings = this.mappings.filter(m => m.id !== id);
    this.saveMappings();
    this.onMappingsUpdate(this.mappings);
  }

  updateMapping(id: string, updates: Partial<SoundMapping>): void {
    const mapping = this.mappings.find(m => m.id === id);
    if (mapping) {
      Object.assign(mapping, updates);
      this.saveMappings();
      this.onMappingsUpdate(this.mappings);
    }
  }

  getHistory(): DetectedKeyword[] {
    return this.history;
  }

  clearHistory(): void {
    this.history = [];
    this.onHistoryUpdate([]);
  }
}
