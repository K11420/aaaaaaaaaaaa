// Discord Bot WebSocket Client

export interface DiscordGuild {
  id: string;
  name: string;
  icon: string | null;
}

export interface DiscordChannel {
  id: string;
  name: string;
}

export interface DiscordStatus {
  connected: boolean;
  botName: string | null;
  inVoiceChannel: boolean;
  guildsCount: number;
}

type MessageHandler = (data: any) => void;

export class DiscordClient {
  private ws: WebSocket | null = null;
  private wsUrl: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private messageHandlers: Map<string, MessageHandler[]> = new Map();
  private onStatusChange: (status: DiscordStatus | null) => void;
  private isConnecting = false;

  constructor(onStatusChange: (status: DiscordStatus | null) => void) {
    this.wsUrl = '';
    this.onStatusChange = onStatusChange;
  }

  connect(wsUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isConnecting) {
        reject(new Error('Already connecting'));
        return;
      }

      this.wsUrl = wsUrl;
      this.isConnecting = true;

      try {
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          console.log('🔌 Connected to Discord Bot');
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          this.send({ type: 'get_status' });
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
          } catch (e) {
            console.error('Failed to parse message:', e);
          }
        };

        this.ws.onclose = () => {
          console.log('🔌 Disconnected from Discord Bot');
          this.isConnecting = false;
          this.onStatusChange(null);
          this.tryReconnect();
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.isConnecting = false;
          reject(error);
        };
      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  private tryReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts && this.wsUrl) {
      this.reconnectAttempts++;
      console.log(`Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      setTimeout(() => {
        this.connect(this.wsUrl).catch(() => {});
      }, 2000 * this.reconnectAttempts);
    }
  }

  private handleMessage(data: any) {
    // ステータス更新
    if (data.type === 'status') {
      this.onStatusChange(data as DiscordStatus);
    }

    // 登録されたハンドラーを呼び出し
    const handlers = this.messageHandlers.get(data.type);
    if (handlers) {
      handlers.forEach(handler => handler(data));
    }
  }

  on(type: string, handler: MessageHandler) {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, []);
    }
    this.messageHandlers.get(type)!.push(handler);
  }

  off(type: string, handler: MessageHandler) {
    const handlers = this.messageHandlers.get(type);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }
  }

  private send(data: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  disconnect() {
    this.maxReconnectAttempts = 0; // 再接続を無効化
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  // API Methods
  getGuilds(): Promise<DiscordGuild[]> {
    return new Promise((resolve) => {
      const handler = (data: any) => {
        this.off('guilds', handler);
        resolve(data.guilds);
      };
      this.on('guilds', handler);
      this.send({ type: 'get_guilds' });
    });
  }

  getChannels(guildId: string): Promise<DiscordChannel[]> {
    return new Promise((resolve) => {
      const handler = (data: any) => {
        this.off('channels', handler);
        resolve(data.channels);
      };
      this.on('channels', handler);
      this.send({ type: 'get_channels', guildId });
    });
  }

  joinChannel(guildId: string, channelId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const joinHandler = () => {
        this.off('joined', joinHandler);
        this.off('error', errorHandler);
        resolve();
      };
      const errorHandler = (data: any) => {
        this.off('joined', joinHandler);
        this.off('error', errorHandler);
        reject(new Error(data.message));
      };
      
      this.on('joined', joinHandler);
      this.on('error', errorHandler);
      this.send({ type: 'join_channel', guildId, channelId });
    });
  }

  leaveChannel() {
    this.send({ type: 'leave_channel' });
  }

  playSound(soundName: string, soundData?: string, presetId?: string) {
    this.send({ 
      type: 'play_sound', 
      soundName,
      soundData, // Base64 encoded audio data
      presetId   // プリセットサウンドのID
    });
  }

  playSoundFile(soundName: string, soundFile: string) {
    this.send({ 
      type: 'play_sound', 
      soundName,
      soundFile
    });
  }

  // 音声認識結果をBotに送信
  sendSpeechResult(text: string, timestamp: number) {
    this.send({
      type: 'speech_result',
      text,
      timestamp
    });
  }

  // Discord音声を受け取るハンドラーを設定
  onDiscordAudio(handler: (audioData: string, userId: string, timestamp: number) => void) {
    this.on('discord_audio', (data: any) => {
      handler(data.audioData, data.userId, data.timestamp);
    });
  }
}
