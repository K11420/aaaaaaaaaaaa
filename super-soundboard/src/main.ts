import { SpeechRecognizer } from './speechRecognition';
import { SoundManager } from './soundManager';
import { DiscordClient, DiscordStatus, DiscordGuild, DiscordChannel } from './discordClient';
import { styles } from './styles';
import type { SoundMapping, DetectedKeyword } from './types';

const EMOJI_OPTIONS = ['🎵', '🔔', '🎺', '🥁', '🎸', '🎹', '🎤', '📢', '💥', '⚡', '🔥', '❄️', '🌟', '💫', '🎊', '🎯'];

class SuperSoundboard {
  private speechRecognizer: SpeechRecognizer;
  private soundManager: SoundManager;
  private discordClient: DiscordClient;
  private isListening = false;
  private transcriptFinal = '';
  private transcriptInterim = '';
  private error: string | null = null;
  private history: DetectedKeyword[] = [];
  private mappings: SoundMapping[] = [];
  private showModal = false;
  private selectedEmoji = '🎵';
  private isInitialized = false;
  
  // Discord state
  private discordStatus: DiscordStatus | null = null;
  private discordGuilds: DiscordGuild[] = [];
  private discordChannels: DiscordChannel[] = [];
  private selectedGuildId: string = '';
  private selectedChannelId: string = '';
  private wsUrl: string = '';

  constructor() {
    this.injectStyles();
    
    this.discordClient = new DiscordClient((status) => {
      this.discordStatus = status;
      this.renderDiscordStatus();
    });
    
    this.soundManager = new SoundManager(
      (history) => {
        this.history = history;
        this.renderHistory();
      },
      (mappings) => {
        this.mappings = mappings;
        if (this.isInitialized) {
          this.renderSoundboard();
        }
      }
    );

    // Discord連携時のサウンド再生コールバック
    this.soundManager.setOnSoundPlay((soundName, soundData, presetId) => {
      if (this.discordClient.isConnected() && this.discordStatus?.inVoiceChannel) {
        this.discordClient.playSound(soundName, soundData, presetId);
      }
    });

    this.speechRecognizer = new SpeechRecognizer(
      (final, interim) => this.handleTranscript(final, interim),
      (listening) => {
        this.isListening = listening;
        this.renderControls();
      },
      (error) => {
        this.error = error;
        this.renderError();
      }
    );

    // 保存されたWebSocket URLを復元
    this.wsUrl = localStorage.getItem('discord_ws_url') || '';

    // Discord音声受信ハンドラー
    this.discordClient.onDiscordAudio((audioData, userId, timestamp) => {
      this.handleDiscordAudio(audioData, userId, timestamp);
    });

    // 音声再生通知ハンドラー
    this.discordClient.on('sound_played', (data: any) => {
      console.log(`🔊 Sound played: ${data.soundFile} (keyword: ${data.keyword})`);
    });

    this.init();
  }

  // Discord音声受信時の処理（ログのみ - マイクは別途Discordの音声を拾う想定）
  private async handleDiscordAudio(base64Audio: string, userId: string, _timestamp: number) {
    // Discord音声はブラウザでは再生しない
    // ユーザーはDiscordクライアントで音声を聞き、
    // ブラウザのマイクはDiscordの音声出力（スピーカー）を拾う想定
    
    // 音声を受信したことをログに表示
    const audioSize = Math.round(base64Audio.length * 0.75 / 1024); // Base64 -> KB
    console.log(`🎙️ Discord audio received: user=${userId}, size=${audioSize}KB`);
    
    // デバッグ用: 音声データを保持（必要に応じて再生可能）
    // this.lastDiscordAudio = base64Audio;
  }

  private async init() {
    await this.soundManager.init();
    this.mappings = this.soundManager.getMappings();
    this.isInitialized = true;
    this.render();
    
    // 保存されたURLがあれば自動接続を試みる
    if (this.wsUrl) {
      this.connectToDiscord();
    }
  }

  private injectStyles() {
    const styleElement = document.createElement('style');
    styleElement.textContent = styles;
    document.head.appendChild(styleElement);
  }

  private handleTranscript(final: string, interim: string) {
    if (final) {
      this.transcriptFinal += final;
      this.soundManager.checkAndPlay(final);
    }
    
    this.transcriptInterim = interim;
    
    if (interim) {
      this.soundManager.checkAndPlay(interim);
    }
    
    this.renderTranscript();
    
    if (final) {
      setTimeout(() => {
        if (this.transcriptFinal.includes(final)) {
          this.transcriptFinal = '';
          this.renderTranscript();
        }
      }, 5000);
    }
  }

  private render() {
    const app = document.getElementById('app');
    if (!app) return;

    app.innerHTML = `
      <header class="header">
        <h1>🎵 Super Soundboard</h1>
        <p>話すと自動でサウンドエフェクトが再生されるよ！</p>
      </header>

      <div id="error-container"></div>

      <!-- Discord Status Bar -->
      <div class="discord-bar" id="discord-bar">
        <div class="discord-status">
          <span class="discord-icon">🎮</span>
          <span id="discord-status-text">Discord未接続</span>
        </div>
        <button id="discord-connect-btn" class="discord-btn">接続設定</button>
      </div>

      <div class="main-controls">
        <button id="mic-button" class="mic-button inactive">
          🎤
        </button>
      </div>

      <div id="status" class="status idle">
        マイクボタンを押して開始
      </div>

      <div class="transcript-container">
        <h3>📝 認識中のテキスト</h3>
        <div id="transcript" class="transcript-text">
          <span class="interim">ここに音声が表示されます...</span>
        </div>
      </div>

      <div class="soundboard-container">
        <h3>
          <span>🎹 サウンドボード</span>
          <button id="add-sound-btn" class="add-sound-btn">＋ 音源を追加</button>
        </h3>
        <div id="soundboard" class="soundboard-grid"></div>
      </div>

      <div class="history-container">
        <h3>
          <span>📜 再生履歴</span>
          <button id="clear-history">クリア</button>
        </h3>
        <div id="history" class="history-list"></div>
      </div>
      
      <div id="modal-container"></div>
    `;

    this.setupEventListeners();
    this.renderSoundboard();
    this.renderHistory();
    this.renderDiscordStatus();
  }

  private setupEventListeners() {
    const micButton = document.getElementById('mic-button');
    if (micButton) {
      micButton.addEventListener('click', () => {
        this.speechRecognizer.toggle();
      });
    }

    const clearHistoryBtn = document.getElementById('clear-history');
    if (clearHistoryBtn) {
      clearHistoryBtn.addEventListener('click', () => {
        this.soundManager.clearHistory();
      });
    }

    const addSoundBtn = document.getElementById('add-sound-btn');
    if (addSoundBtn) {
      addSoundBtn.addEventListener('click', () => {
        this.showAddSoundModal();
      });
    }

    const discordConnectBtn = document.getElementById('discord-connect-btn');
    if (discordConnectBtn) {
      discordConnectBtn.addEventListener('click', () => {
        this.showDiscordSettingsModal();
      });
    }
  }

  private renderDiscordStatus() {
    const statusText = document.getElementById('discord-status-text');
    const connectBtn = document.getElementById('discord-connect-btn');
    const discordBar = document.getElementById('discord-bar');
    
    if (!statusText || !connectBtn || !discordBar) return;

    if (this.discordStatus?.connected) {
      discordBar.classList.add('connected');
      if (this.discordStatus.inVoiceChannel) {
        statusText.textContent = `🔊 ${this.discordStatus.botName} - VC接続中`;
        connectBtn.textContent = '設定';
      } else {
        statusText.textContent = `✅ ${this.discordStatus.botName} - 待機中`;
        connectBtn.textContent = 'VC参加';
      }
    } else if (this.discordClient.isConnected()) {
      discordBar.classList.remove('connected');
      statusText.textContent = '⏳ Bot接続待ち...';
      connectBtn.textContent = '設定';
    } else {
      discordBar.classList.remove('connected');
      statusText.textContent = 'Discord未接続';
      connectBtn.textContent = '接続設定';
    }
  }

  private async connectToDiscord() {
    if (!this.wsUrl) return;
    
    try {
      await this.discordClient.connect(this.wsUrl);
      localStorage.setItem('discord_ws_url', this.wsUrl);
    } catch (error) {
      console.error('Failed to connect to Discord bot:', error);
      this.error = 'Discord Botへの接続に失敗しました';
      this.renderError();
    }
  }

  private showDiscordSettingsModal() {
    this.renderDiscordModal();
  }

  private hideDiscordModal() {
    const container = document.getElementById('modal-container');
    if (container) {
      container.innerHTML = '';
    }
  }

  private async renderDiscordModal() {
    const container = document.getElementById('modal-container');
    if (!container) return;

    // サーバー一覧を取得
    if (this.discordClient.isConnected() && this.discordStatus?.connected) {
      try {
        this.discordGuilds = await this.discordClient.getGuilds();
      } catch (e) {
        console.error('Failed to get guilds:', e);
      }
    }

    container.innerHTML = `
      <div class="modal-overlay" id="modal-overlay">
        <div class="modal discord-modal">
          <h2>🎮 Discord Bot 設定</h2>
          
          <div class="form-group">
            <label>WebSocket URL</label>
            <input type="text" id="ws-url" placeholder="ws://localhost:8765" value="${this.escapeHtml(this.wsUrl)}" />
            <small>Discord Botが起動しているサーバーのWebSocket URL</small>
          </div>

          <div class="form-group">
            <button id="ws-connect-btn" class="btn-primary">
              ${this.discordClient.isConnected() ? '再接続' : '接続'}
            </button>
            ${this.discordClient.isConnected() ? '<button id="ws-disconnect-btn" class="btn-danger">切断</button>' : ''}
          </div>

          ${this.discordStatus?.connected ? `
            <hr class="divider" />
            
            <div class="form-group">
              <label>サーバー選択</label>
              <select id="guild-select">
                <option value="">サーバーを選択...</option>
                ${this.discordGuilds.map(g => `
                  <option value="${g.id}" ${g.id === this.selectedGuildId ? 'selected' : ''}>${this.escapeHtml(g.name)}</option>
                `).join('')}
              </select>
            </div>

            <div class="form-group" id="channel-select-group" style="${this.selectedGuildId ? '' : 'display:none'}">
              <label>ボイスチャンネル選択</label>
              <select id="channel-select">
                <option value="">チャンネルを選択...</option>
                ${this.discordChannels.map(c => `
                  <option value="${c.id}" ${c.id === this.selectedChannelId ? 'selected' : ''}>${this.escapeHtml(c.name)}</option>
                `).join('')}
              </select>
            </div>

            <div class="form-group">
              ${this.discordStatus.inVoiceChannel ? 
                '<button id="leave-vc-btn" class="btn-danger">ボイスチャンネルから退出</button>' :
                '<button id="join-vc-btn" class="btn-primary" disabled>ボイスチャンネルに参加</button>'
              }
            </div>
          ` : ''}

          <div class="modal-actions">
            <button class="btn-cancel" id="discord-modal-close">閉じる</button>
          </div>
        </div>
      </div>
    `;

    // イベントリスナー
    document.getElementById('modal-overlay')?.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).id === 'modal-overlay') {
        this.hideDiscordModal();
      }
    });

    document.getElementById('discord-modal-close')?.addEventListener('click', () => {
      this.hideDiscordModal();
    });

    document.getElementById('ws-connect-btn')?.addEventListener('click', async () => {
      const urlInput = document.getElementById('ws-url') as HTMLInputElement;
      this.wsUrl = urlInput.value.trim();
      if (this.wsUrl) {
        await this.connectToDiscord();
        this.renderDiscordModal();
      }
    });

    document.getElementById('ws-disconnect-btn')?.addEventListener('click', () => {
      this.discordClient.disconnect();
      this.discordStatus = null;
      this.renderDiscordStatus();
      this.renderDiscordModal();
    });

    document.getElementById('guild-select')?.addEventListener('change', async (e) => {
      this.selectedGuildId = (e.target as HTMLSelectElement).value;
      this.selectedChannelId = '';
      
      if (this.selectedGuildId) {
        this.discordChannels = await this.discordClient.getChannels(this.selectedGuildId);
      } else {
        this.discordChannels = [];
      }
      
      this.renderDiscordModal();
    });

    document.getElementById('channel-select')?.addEventListener('change', (e) => {
      this.selectedChannelId = (e.target as HTMLSelectElement).value;
      const joinBtn = document.getElementById('join-vc-btn') as HTMLButtonElement;
      if (joinBtn) {
        joinBtn.disabled = !this.selectedChannelId;
      }
    });

    document.getElementById('join-vc-btn')?.addEventListener('click', async () => {
      if (this.selectedGuildId && this.selectedChannelId) {
        try {
          await this.discordClient.joinChannel(this.selectedGuildId, this.selectedChannelId);
          this.hideDiscordModal();
        } catch (error: any) {
          alert(`参加失敗: ${error.message}`);
        }
      }
    });

    document.getElementById('leave-vc-btn')?.addEventListener('click', () => {
      this.discordClient.leaveChannel();
      this.hideDiscordModal();
    });
  }

  private renderControls() {
    const micButton = document.getElementById('mic-button');
    const status = document.getElementById('status');

    if (micButton) {
      micButton.className = `mic-button ${this.isListening ? 'active' : 'inactive'}`;
      micButton.textContent = this.isListening ? '🔴' : '🎤';
    }

    if (status) {
      status.className = `status ${this.isListening ? 'listening' : 'idle'}`;
      let statusText = this.isListening 
        ? '🎧 聴いています... 何か話してみて！' 
        : 'マイクボタンを押して開始';
      
      if (this.discordStatus?.inVoiceChannel) {
        statusText += ' (Discord連携中🎮)';
      }
      
      status.textContent = statusText;
    }
  }

  private renderTranscript() {
    const transcript = document.getElementById('transcript');
    if (transcript) {
      if (this.transcriptFinal || this.transcriptInterim) {
        transcript.innerHTML = `
          <span class="final">${this.escapeHtml(this.transcriptFinal)}</span>
          <span class="interim">${this.escapeHtml(this.transcriptInterim)}</span>
        `;
      } else {
        transcript.innerHTML = '<span class="interim">ここに音声が表示されます...</span>';
      }
    }
  }

  private renderSoundboard() {
    const soundboard = document.getElementById('soundboard');
    if (!soundboard) return;

    soundboard.innerHTML = this.mappings.map(mapping => `
      <div class="sound-card ${mapping.enabled ? '' : 'disabled'} ${mapping.isPreset ? '' : 'custom'}" data-id="${mapping.id}">
        <div class="card-actions">
          <button class="toggle" data-toggle="${mapping.id}" title="${mapping.enabled ? '無効にする' : '有効にする'}">
            ${mapping.enabled ? '✓' : '✗'}
          </button>
          ${!mapping.isPreset ? `<button class="delete-btn" data-delete="${mapping.id}" title="削除">🗑</button>` : ''}
        </div>
        <div class="emoji">${mapping.emoji}</div>
        <div class="name">${this.escapeHtml(mapping.name)}</div>
        <div class="keywords">${mapping.keywords.slice(0, 3).map(k => this.escapeHtml(k)).join(', ')}</div>
      </div>
    `).join('');

    soundboard.querySelectorAll('.sound-card').forEach(card => {
      card.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (target.classList.contains('toggle') || target.classList.contains('delete-btn')) return;
        
        const id = card.getAttribute('data-id');
        if (id) {
          this.soundManager.playById(id);
          card.classList.add('playing');
          setTimeout(() => card.classList.remove('playing'), 500);
        }
      });
    });

    soundboard.querySelectorAll('.toggle').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = (btn as HTMLElement).getAttribute('data-toggle');
        if (id) {
          this.soundManager.toggleMapping(id);
        }
      });
    });

    soundboard.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = (btn as HTMLElement).getAttribute('data-delete');
        if (id && confirm('このサウンドを削除しますか？')) {
          await this.soundManager.removeMapping(id);
        }
      });
    });
  }

  private showAddSoundModal() {
    this.showModal = true;
    this.selectedEmoji = '🎵';
    this.renderModal();
  }

  private hideModal() {
    this.showModal = false;
    const container = document.getElementById('modal-container');
    if (container) {
      container.innerHTML = '';
    }
  }

  private renderModal() {
    const container = document.getElementById('modal-container');
    if (!container) return;

    if (!this.showModal) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = `
      <div class="modal-overlay" id="modal-overlay">
        <div class="modal">
          <h2>🎵 新しいサウンドを追加</h2>
          
          <div class="form-group">
            <label>サウンド名</label>
            <input type="text" id="sound-name" placeholder="例: ドラムロール" />
          </div>
          
          <div class="form-group">
            <label>キーワード（カンマ区切り）</label>
            <input type="text" id="sound-keywords" placeholder="例: ドラム, たいこ, ロール" />
          </div>
          
          <div class="form-group">
            <label>アイコン</label>
            <div class="emoji-picker" id="emoji-picker">
              ${EMOJI_OPTIONS.map(emoji => `
                <button type="button" data-emoji="${emoji}" class="${emoji === this.selectedEmoji ? 'selected' : ''}">${emoji}</button>
              `).join('')}
            </div>
          </div>
          
          <div class="form-group">
            <label>音源ファイル（MP3, WAV, OGG）</label>
            <input type="file" id="sound-file" accept="audio/*" />
          </div>
          
          <div class="modal-actions">
            <button class="btn-cancel" id="modal-cancel">キャンセル</button>
            <button class="btn-save" id="modal-save">追加する</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('modal-overlay')?.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).id === 'modal-overlay') {
        this.hideModal();
      }
    });

    document.getElementById('modal-cancel')?.addEventListener('click', () => {
      this.hideModal();
    });

    document.getElementById('emoji-picker')?.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        this.selectedEmoji = btn.getAttribute('data-emoji') || '🎵';
        document.getElementById('emoji-picker')?.querySelectorAll('button').forEach(b => {
          b.classList.toggle('selected', b.getAttribute('data-emoji') === this.selectedEmoji);
        });
      });
    });

    document.getElementById('modal-save')?.addEventListener('click', async () => {
      await this.handleSaveSound();
    });
  }

  private async handleSaveSound() {
    const nameInput = document.getElementById('sound-name') as HTMLInputElement;
    const keywordsInput = document.getElementById('sound-keywords') as HTMLInputElement;
    const fileInput = document.getElementById('sound-file') as HTMLInputElement;

    const name = nameInput?.value.trim();
    const keywordsStr = keywordsInput?.value.trim();
    const file = fileInput?.files?.[0];

    if (!name) {
      alert('サウンド名を入力してください');
      return;
    }

    if (!keywordsStr) {
      alert('キーワードを入力してください');
      return;
    }

    if (!file) {
      alert('音源ファイルを選択してください');
      return;
    }

    const keywords = keywordsStr.split(/[,、]/).map(k => k.trim()).filter(k => k);

    if (keywords.length === 0) {
      alert('有効なキーワードを入力してください');
      return;
    }

    try {
      await this.soundManager.addCustomSound(name, this.selectedEmoji, keywords, file);
      this.hideModal();
    } catch (err) {
      console.error('Failed to add sound:', err);
      alert('サウンドの追加に失敗しました');
    }
  }

  private renderHistory() {
    const historyContainer = document.getElementById('history');
    if (!historyContainer) return;

    if (this.history.length === 0) {
      historyContainer.innerHTML = '<div class="history-empty">まだ履歴がありません</div>';
      return;
    }

    historyContainer.innerHTML = this.history.map(item => `
      <div class="history-item">
        <span class="time">${this.formatTime(item.timestamp)}</span>
        <span class="keyword">"${this.escapeHtml(item.keyword)}"</span>
        <span class="sound-name">→ ${this.escapeHtml(item.soundName)}</span>
      </div>
    `).join('');
  }

  private renderError() {
    const errorContainer = document.getElementById('error-container');
    if (!errorContainer) return;

    if (this.error) {
      errorContainer.innerHTML = `<div class="error-message">⚠️ ${this.escapeHtml(this.error)}</div>`;
      // 5秒後にエラーをクリア
      setTimeout(() => {
        this.error = null;
        this.renderError();
      }, 5000);
    } else {
      errorContainer.innerHTML = '';
    }
  }

  private formatTime(date: Date): string {
    return date.toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// アプリ起動
new SuperSoundboard();
