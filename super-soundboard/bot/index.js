import { Client, GatewayIntentBits, Events, GuildMember, REST, Routes, SlashCommandBuilder } from 'discord.js';
import { 
  joinVoiceChannel, 
  createAudioPlayer, 
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
  EndBehaviorType
} from '@discordjs/voice';
import { WebSocketServer } from 'ws';
import express from 'express';
import cors from 'cors';
import { createWriteStream, unlinkSync, existsSync, mkdirSync, readFileSync, writeFileSync, statSync, createReadStream } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawn, execSync } from 'child_process';
import prism from 'prism-media';

// Google Cloud Speech (optional)
let speech = null;
try {
  speech = (await import('@google-cloud/speech')).default;
} catch (e) {
  // Google Cloud Speech not installed
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOUNDS_DIR = join(__dirname, 'sounds');
const CUSTOM_SOUNDS_FILE = join(__dirname, 'custom_sounds.json');

// ===========================================
// 音声認識エンジン設定
// ===========================================
// STT_ENGINE 環境変数で切り替え:
//   - "vosk"    : Vosk (リアルタイム、オフライン、無料) ★推奨
//   - "google"  : Google Cloud Speech-to-Text (リアルタイム、要認証)
//   - "whisper" : ローカルWhisper (GPU推奨、オフライン可)
//   - "none"    : 音声認識無効
// ===========================================
const STT_ENGINE = (process.env.STT_ENGINE || 'vosk').toLowerCase();
const WHISPER_MODEL = process.env.WHISPER_MODEL || 'base';  // tiny, base, small, medium, large
const WHISPER_DEVICE = process.env.WHISPER_DEVICE || 'cuda'; // cuda, cpu
const WHISPER_LANGUAGE = process.env.WHISPER_LANGUAGE || 'ja';
const USE_FASTER_WHISPER = process.env.USE_FASTER_WHISPER !== 'false';  // デフォルトでfaster-whisper使用
const VOSK_MODEL_PATH = process.env.VOSK_MODEL_PATH || join(__dirname, 'models', 'vosk-model-ja');

let speechClient = null;
let whisperAvailable = false;
let fasterWhisperAvailable = false;
let voskAvailable = false;

// Google Cloud Speech-to-Text 初期化
if (STT_ENGINE === 'google') {
  const GOOGLE_CREDENTIALS = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (speech && GOOGLE_CREDENTIALS && existsSync(GOOGLE_CREDENTIALS)) {
    speechClient = new speech.SpeechClient();
    console.log('✅ 音声認識エンジン: Google Cloud Speech-to-Text (Streaming)');
  } else {
    console.log('⚠️ Google Cloud Speech-to-Text の設定が不完全です');
    console.log('   1. Create project: https://console.cloud.google.com');
    console.log('   2. Enable Speech-to-Text API');
    console.log('   3. Create service account & download JSON key');
    console.log('   4. Set: export GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json');
  }
}

// ローカル Whisper 初期化
if (STT_ENGINE === 'whisper') {
  // faster-whisperを優先して確認
  console.log(`🔍 USE_FASTER_WHISPER: ${USE_FASTER_WHISPER}`);
  if (USE_FASTER_WHISPER) {
    try {
      execSync('python3 -c "from faster_whisper import WhisperModel"', { stdio: 'pipe' });
      fasterWhisperAvailable = true;
      whisperAvailable = true;
      console.log(`✅ 音声認識エンジン: faster-whisper (高速版)`);
      console.log(`   モデル: ${WHISPER_MODEL}, デバイス: ${WHISPER_DEVICE}, 言語: ${WHISPER_LANGUAGE}`);
    } catch (e) {
      console.log(`⚠️ faster-whisper検出失敗: ${e.message}`);
      // faster-whisperがない場合は通常のwhisperを確認
    }
  }
  
  if (!fasterWhisperAvailable) {
    try {
      execSync('whisper --help', { stdio: 'ignore' });
      whisperAvailable = true;
      console.log(`✅ 音声認識エンジン: ローカルWhisper`);
      console.log(`   モデル: ${WHISPER_MODEL}, デバイス: ${WHISPER_DEVICE}, 言語: ${WHISPER_LANGUAGE}`);
    } catch (e) {
      console.log('⚠️ Whisperがインストールされていません');
      console.log('   高速版: pip install faster-whisper');
      console.log('   通常版: pip install openai-whisper');
      console.log('   GPU版PyTorch: pip install torch --index-url https://download.pytorch.org/whl/cu121');
    }
  }
}

// Vosk 初期化
if (STT_ENGINE === 'vosk') {
  try {
    execSync('python3 -c "from vosk import Model"', { stdio: 'pipe' });
    if (existsSync(VOSK_MODEL_PATH)) {
      voskAvailable = true;
      console.log(`✅ 音声認識エンジン: Vosk (リアルタイム)`);
      console.log(`   モデル: ${VOSK_MODEL_PATH}`);
    } else {
      console.log('⚠️ Voskモデルが見つかりません');
      console.log(`   モデルパス: ${VOSK_MODEL_PATH}`);
      console.log('   ダウンロード: https://alphacephei.com/vosk/models');
      console.log('   日本語モデル: vosk-model-small-ja-0.22');
      console.log('   展開先: models/vosk-model-ja');
    }
  } catch (e) {
    console.log('⚠️ Voskがインストールされていません');
    console.log('   pip install vosk');
  }
}

if (STT_ENGINE === 'none') {
  console.log('ℹ️ 音声認識: 無効');
}

// sounds ディレクトリがなければ作成
if (!existsSync(SOUNDS_DIR)) {
  mkdirSync(SOUNDS_DIR, { recursive: true });
}

// 環境変数またはコマンドライン引数からトークンを取得
const DISCORD_TOKEN = process.env.DISCORD_TOKEN || process.argv[2];
const WS_PORT = parseInt(process.env.WS_PORT || '8765');
const HTTP_PORT = parseInt(process.env.HTTP_PORT || '8766');

if (!DISCORD_TOKEN) {
  console.error('❌ Discord Token が必要です！');
  console.error('使用方法: DISCORD_TOKEN=your_token node index.js');
  console.error('または: node index.js your_token');
  process.exit(1);
}

// カスタムサウンドのロード/セーブ
function loadCustomSounds() {
  try {
    if (existsSync(CUSTOM_SOUNDS_FILE)) {
      return JSON.parse(readFileSync(CUSTOM_SOUNDS_FILE, 'utf-8'));
    }
  } catch (e) {
    console.error('Failed to load custom sounds:', e);
  }
  return {};
}

function saveCustomSounds(sounds) {
  try {
    writeFileSync(CUSTOM_SOUNDS_FILE, JSON.stringify(sounds, null, 2));
  } catch (e) {
    console.error('Failed to save custom sounds:', e);
  }
}

// カスタムサウンド { keyword: { file: 'filename.mp3', addedBy: 'user' } }
let customSounds = loadCustomSounds();

// プリセットサウンドのファイル名マッピング（空）
const presetSounds = {};

// Discord Client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ===========================================
// スラッシュコマンド定義
// ===========================================
const commands = [
  new SlashCommandBuilder()
    .setName('join')
    .setDescription('ボイスチャンネルに参加して音声認識を開始します'),
  new SlashCommandBuilder()
    .setName('leave')
    .setDescription('ボイスチャンネルから退出します'),
  new SlashCommandBuilder()
    .setName('sounds')
    .setDescription('登録されているサウンド一覧を表示します'),
  new SlashCommandBuilder()
    .setName('add')
    .setDescription('新しいサウンドを登録します')
    .addStringOption(option =>
      option.setName('keyword')
        .setDescription('トリガーとなるキーワード')
        .setRequired(true))
    .addAttachmentOption(option =>
      option.setName('file')
        .setDescription('音声ファイル (MP3, WAV, OGG, M4A)')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('description')
        .setDescription('サウンドの説明（どんな音が流れるか）')
        .setRequired(false)),
  new SlashCommandBuilder()
    .setName('delete')
    .setDescription('登録したサウンドを削除します')
    .addStringOption(option =>
      option.setName('keyword')
        .setDescription('削除するキーワード')
        .setRequired(true)
        .setAutocomplete(true)),
  new SlashCommandBuilder()
    .setName('edit')
    .setDescription('登録したサウンドのキーワードや説明を変更します')
    .addStringOption(option =>
      option.setName('keyword')
        .setDescription('編集するサウンドのキーワード')
        .setRequired(true)
        .setAutocomplete(true))
    .addStringOption(option =>
      option.setName('new_keyword')
        .setDescription('新しいキーワード（変更しない場合は空欄）')
        .setRequired(false))
    .addStringOption(option =>
      option.setName('description')
        .setDescription('新しい説明文（変更しない場合は空欄）')
        .setRequired(false)),
  new SlashCommandBuilder()
    .setName('info')
    .setDescription('サウンドの詳細情報を表示します')
    .addStringOption(option =>
      option.setName('keyword')
        .setDescription('確認するサウンドのキーワード')
        .setRequired(true)
        .setAutocomplete(true)),
  new SlashCommandBuilder()
    .setName('play')
    .setDescription('サウンドを手動で再生します')
    .addStringOption(option =>
      option.setName('keyword')
        .setDescription('再生するサウンドのキーワード')
        .setRequired(true)
        .setAutocomplete(true)),
  new SlashCommandBuilder()
    .setName('help')
    .setDescription('使い方を表示します'),
  new SlashCommandBuilder()
    .setName('debug')
    .setDescription('音声認識のデバッグ情報を表示します'),
  new SlashCommandBuilder()
    .setName('test')
    .setDescription('音声認識をテストします（5秒間マイクを監視）'),
].map(command => command.toJSON());

// スラッシュコマンドを登録する関数
async function registerSlashCommands() {
  const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
  
  try {
    console.log('🔄 スラッシュコマンドを登録中...');
    
    // グローバルコマンドとして登録
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands }
    );
    
    console.log('✅ スラッシュコマンドを登録しました');
  } catch (error) {
    console.error('❌ スラッシュコマンドの登録に失敗:', error);
  }
}

// サーバーごとの接続管理 (guildId -> { connection, player, isListening, userStreams })
const guildConnections = new Map();

// サーバーの接続情報を取得（なければ作成）
function getGuildConnection(guildId) {
  if (!guildConnections.has(guildId)) {
    guildConnections.set(guildId, {
      connection: null,
      player: createAudioPlayer(),
      isListening: false,
      userStreams: new Map()
    });
  }
  return guildConnections.get(guildId);
}

// WebSocket Server (オプション - ブラウザ連携用)
const wss = new WebSocketServer({ port: WS_PORT });
console.log(`🔌 WebSocket Server started on port ${WS_PORT}`);

// Express Server for status
const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const connectedClients = new Set();

// WebSocket接続処理
wss.on('connection', (ws) => {
  console.log('🌐 New WebSocket client connected');
  connectedClients.add(ws);

  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString());
      
      switch (message.type) {
        case 'play_sound':
          await handlePlaySound(message, ws);
          break;
        case 'join_channel':
          await handleJoinChannel(message, ws);
          break;
        case 'leave_channel':
          handleLeaveChannel(ws);
          break;
        case 'get_status':
          sendStatus(ws);
          break;
        case 'get_guilds':
          sendGuilds(ws);
          break;
        case 'get_channels':
          sendChannels(message.guildId, ws);
          break;
        case 'speech_result':
          // ブラウザからの音声認識結果を処理
          await handleSpeechResult(message, ws);
          break;
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
      ws.send(JSON.stringify({ type: 'error', message: error.message }));
    }
  });

  ws.on('close', () => {
    console.log('🔌 WebSocket client disconnected');
    connectedClients.delete(ws);
  });

  sendStatus(ws);
});

// ブラウザからの音声認識結果を処理
async function handleSpeechResult(message, ws) {
  const { text, timestamp } = message;
  
  if (!text || text.length === 0) {
    return;
  }
  
  console.log(`🎙️ Browser recognized: "${text}"`);
  
  // キーワードマッチング
  const soundFile = getSoundFile(text);
  if (soundFile) {
    console.log(`🔊 Playing sound for keyword: ${soundFile}`);
    const played = await playSound(soundFile, 'discord_voice');
    
    if (played) {
      // 全クライアントに通知
      const notification = JSON.stringify({
        type: 'sound_played',
        keyword: text,
        soundFile: soundFile,
        source: 'discord_voice'
      });
      connectedClients.forEach(client => {
        if (client.readyState === 1) {
          client.send(notification);
        }
      });
    }
  }
}

// キーワードからサウンドファイルを取得
function getSoundFile(keyword) {
  // カスタムサウンドを優先
  const lowerKeyword = keyword.toLowerCase();
  for (const [key, value] of Object.entries(customSounds)) {
    if (lowerKeyword.includes(key.toLowerCase())) {
      return value.file;
    }
  }
  // プリセット
  for (const [key, file] of Object.entries(presetSounds)) {
    if (lowerKeyword.includes(key.toLowerCase())) {
      return file;
    }
  }
  return null;
}

// サウンド再生（特定のサーバーで再生）
async function playSound(soundFile, source = 'unknown', guildId = null) {
  const audioPath = join(SOUNDS_DIR, soundFile);
  if (!existsSync(audioPath)) {
    console.log('⚠️ Sound file not found:', audioPath);
    return false;
  }

  // guildIdが指定されている場合、そのサーバーで再生
  if (guildId) {
    const guildData = guildConnections.get(guildId);
    if (guildData && guildData.connection) {
      try {
        console.log(`🔊 Playing sound: ${soundFile} (server: ${guildId}, source: ${source})`);
        const resource = createAudioResource(audioPath);
        guildData.player.play(resource);
        return true;
      } catch (error) {
        console.error('Play sound error:', error);
        return false;
      }
    }
  }
  
  // guildIdがない場合、全サーバーで再生
  let played = false;
  for (const [id, guildData] of guildConnections) {
    if (guildData.connection) {
      try {
        console.log(`🔊 Playing sound: ${soundFile} (server: ${id}, source: ${source})`);
        const resource = createAudioResource(audioPath);
        guildData.player.play(resource);
        played = true;
      } catch (error) {
        console.error(`Play sound error (server ${id}):`, error);
      }
    }
  }
  
  if (!played) {
    console.log('⚠️ Not connected to any voice channel');
  }
  return played;
}

// WebSocket経由でサウンド再生
async function handlePlaySound(message, ws) {
  const guildId = message.guildId;
  const guildData = guildId ? guildConnections.get(guildId) : null;
  
  if (guildId && (!guildData || !guildData.connection)) {
    ws.send(JSON.stringify({ type: 'error', message: 'ボイスチャンネルに接続していません' }));
    return;
  }

  try {
    let audioPath;
    let isTemp = false;
    
    if (message.soundData) {
      const buffer = Buffer.from(message.soundData, 'base64');
      audioPath = join(SOUNDS_DIR, `temp_${Date.now()}.mp3`);
      const writeStream = createWriteStream(audioPath);
      writeStream.write(buffer);
      writeStream.end();
      isTemp = true;
      await new Promise((resolve) => writeStream.on('finish', resolve));
    } else if (message.soundFile) {
      audioPath = join(SOUNDS_DIR, message.soundFile);
    } else if (message.presetId) {
      const presetFiles = {
        'preset-1': 'yabai.mp3', 'preset-2': 'sugoi.mp3', 'preset-3': 'kusa.mp3',
        'preset-4': 'daijoubu.mp3', 'preset-5': 'nice.mp3', 'preset-6': 'fail.mp3',
        'preset-7': 'victory.mp3', 'preset-8': 'defeat.mp3', 'preset-9': 'thanks.mp3',
        'preset-10': 'paypay.mp3',
      };
      audioPath = join(SOUNDS_DIR, presetFiles[message.presetId] || '');
    }

    if (!audioPath || !existsSync(audioPath)) {
      ws.send(JSON.stringify({ type: 'error', message: 'サウンドファイルが見つかりません' }));
      return;
    }

    const resource = createAudioResource(audioPath);
    const player = guildData ? guildData.player : null;
    
    if (player) {
      player.play(resource);
      ws.send(JSON.stringify({ type: 'playing', soundName: message.soundName || 'Unknown' }));

      if (isTemp) {
        player.once(AudioPlayerStatus.Idle, () => {
          try { unlinkSync(audioPath); } catch (e) {}
        });
      }
    } else {
      // 全サーバーで再生
      await playSound(message.soundFile || audioPath, 'websocket');
      ws.send(JSON.stringify({ type: 'playing', soundName: message.soundName || 'Unknown' }));
    }
  } catch (error) {
    console.error('Play sound error:', error);
    ws.send(JSON.stringify({ type: 'error', message: error.message }));
  }
}

// チャンネル参加
async function handleJoinChannel(message, ws) {
  try {
    const guild = client.guilds.cache.get(message.guildId);
    if (!guild) {
      ws.send(JSON.stringify({ type: 'error', message: 'サーバーが見つかりません' }));
      return;
    }

    const channel = guild.channels.cache.get(message.channelId);
    if (!channel || !channel.isVoiceBased()) {
      ws.send(JSON.stringify({ type: 'error', message: 'ボイスチャンネルが見つかりません' }));
      return;
    }

    await joinVC(guild, channel);
    
    ws.send(JSON.stringify({ type: 'joined', channelName: channel.name, guildName: guild.name }));
    broadcastStatus();
  } catch (error) {
    console.error('Join channel error:', error);
    ws.send(JSON.stringify({ type: 'error', message: error.message }));
  }
}

// ボイスチャンネルに参加（サーバーごとに独立）
async function joinVC(guild, channel) {
  const guildData = getGuildConnection(guild.id);
  
  // 既存の接続があれば切断
  if (guildData.connection) {
    guildData.connection.destroy();
    guildData.connection = null;
    guildData.isListening = false;
  }

  console.log(`🔊 [${guild.name}] Joining voice channel: ${channel.name}`);
  
  const connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: guild.id,
    adapterCreator: guild.voiceAdapterCreator,
    selfDeaf: false,
    selfMute: false,
  });

  await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
  connection.subscribe(guildData.player);
  
  guildData.connection = connection;

  // 音声認識を開始
  startListening(guild.id);

  console.log(`✅ [${guild.name}] Joined voice channel: ${channel.name}`);
  console.log(`📊 現在の接続数: ${[...guildConnections.values()].filter(g => g.connection).length}サーバー`);
}

// 音声認識開始 - エンジンに応じて処理を分岐（サーバーごと）
function startListening(guildId) {
  const guildData = guildConnections.get(guildId);
  if (!guildData || !guildData.connection || guildData.isListening) return;
  
  // エンジンチェック
  if (STT_ENGINE === 'none') {
    console.log('ℹ️ 音声認識は無効です');
    guildData.isListening = true;
    return;
  }
  
  if (STT_ENGINE === 'google' && !speechClient) {
    console.log('⚠️ Google Cloud Speech not configured - speech recognition disabled');
    guildData.isListening = true;
    return;
  }
  
  if (STT_ENGINE === 'whisper' && !whisperAvailable) {
    console.log('⚠️ Whisper not available - speech recognition disabled');
    guildData.isListening = true;
    return;
  }
  
  if (STT_ENGINE === 'vosk' && !voskAvailable) {
    console.log('⚠️ Vosk not available - speech recognition disabled');
    guildData.isListening = true;
    return;
  }

  const receiver = guildData.connection.receiver;
  guildData.isListening = true;

  receiver.speaking.on('start', (userId) => {
    // ユーザー名を取得
    const guild = client.guilds.cache.get(guildId);
    const member = guild?.members.cache.get(userId);
    const userName = member?.displayName || member?.user?.username || userId;
    
    // 既にストリーム処理中の場合
    if (guildData.userStreams.has(userId)) {
      // 前のストリームが古い場合は強制終了して再開
      const existingStream = guildData.userStreams.get(userId);
      const streamAge = Date.now() - (existingStream.startTime || 0);
      if (streamAge > 10000) { // 10秒以上経過していたら古いストリームを終了
        console.log(`🔄 [${userName}] 古いストリームを終了して再開`);
        try {
          if (existingStream.ffmpeg) existingStream.ffmpeg.kill();
          if (existingStream.vosk) existingStream.vosk.kill();
          if (existingStream.audioStream) existingStream.audioStream.destroy();
        } catch (e) {}
        guildData.userStreams.delete(userId);
      } else {
        console.log(`⏭️ [${userName}] 既に処理中（${Math.round(streamAge/1000)}秒経過）`);
        return;
      }
    }
    
    console.log(`🎤 [${userName}] 発話開始`);
    
    let audioStream;
    try {
      audioStream = receiver.subscribe(userId, {
        end: {
          behavior: EndBehaviorType.AfterSilence,
          duration: 800,  // 800msの無音で終了（少し長めに）
        },
      });
    } catch (e) {
      console.log(`⚠️ [${userName}] ストリームの取得に失敗: ${e.message}`);
      return;
    }

    // Opusデコーダー（48kHz stereo -> 16kHz mono に変換）
    const decoder = new prism.opus.Decoder({ 
      rate: 48000, 
      channels: 2, 
      frameSize: 960 
    });
    
    // デコーダーエラーをログ
    decoder.on('error', (err) => {
      console.log(`⚠️ [${userName}] デコーダーエラー: ${err.message}`);
    });
    
    // ストリームエラーをログ
    audioStream.on('error', (err) => {
      console.log(`⚠️ [${userName}] ストリームエラー: ${err.message}`);
    });

    if (STT_ENGINE === 'google') {
      // === Google Cloud Speech-to-Text Streaming ===
      startGoogleSpeechRecognition(userId, audioStream, decoder, guildData.userStreams, guildId);
    } else if (STT_ENGINE === 'whisper') {
      // === ローカル Whisper ===
      startWhisperRecognition(userId, audioStream, decoder, guildData.userStreams, guildId);
    } else if (STT_ENGINE === 'vosk') {
      // === Vosk リアルタイム認識 ===
      startVoskRecognition(userId, audioStream, decoder, guildData.userStreams, guildId);
    }
  });

  console.log('👂 Started listening to voice channel');
  const engineInfo = {
    'google': 'Google Cloud Speech-to-Text (Streaming)',
    'whisper': `Local Whisper (${WHISPER_MODEL}, ${WHISPER_DEVICE})`,
    'vosk': 'Vosk (リアルタイム・オフライン)'
  };
  console.log(`🚀 Using ${engineInfo[STT_ENGINE] || STT_ENGINE}`);
}

// Google Cloud Speech-to-Text ストリーミング認識
function startGoogleSpeechRecognition(userId, audioStream, decoder, userStreams, guildId) {
  const request = {
    config: {
      encoding: 'LINEAR16',
      sampleRateHertz: 16000,
      languageCode: 'ja-JP',
      enableAutomaticPunctuation: false,
      model: 'latest_short',
    },
    interimResults: true,
  };

  let streamEnded = false;
  let recognizeStream = null;
  
  try {
    recognizeStream = speechClient
      .streamingRecognize(request)
      .on('error', (err) => {
        // "write after end" エラーは無視
        if (err.message && err.message.includes('write after')) {
          return;
        }
        if (err.code !== 11) {
          console.error('❌ Speech API error:', err.message);
        }
      })
      .on('data', (data) => {
        if (data.results[0] && data.results[0].alternatives[0]) {
          const transcript = data.results[0].alternatives[0].transcript;
          const isFinal = data.results[0].isFinal;
          
          if (isFinal && transcript) {
            console.log(`\n📝 [Server:${guildId}] Google: "${transcript}"`);
            handleRecognitionResult(transcript, guildId);
          } else if (transcript) {
            process.stdout.write(`\r🎙️ "${transcript}"...          `);
          }
        }
      })
      .on('end', () => {
        streamEnded = true;
      });
  } catch (e) {
    console.error('Failed to create recognize stream:', e);
    return;
  }

  const ffmpeg = spawn('ffmpeg', [
    '-hide_banner', '-loglevel', 'error',
    '-f', 's16le', '-ar', '48000', '-ac', '2', '-i', 'pipe:0',
    '-ar', '16000', '-ac', '1', '-f', 's16le', 'pipe:1'
  ]);

  ffmpeg.on('error', () => {});
  ffmpeg.stderr.on('data', () => {});

  // パイプを安全に設定
  audioStream.pipe(decoder);
  decoder.pipe(ffmpeg.stdin);
  
  // ffmpegからrecognizeStreamへのパイプを監視付きで設定
  ffmpeg.stdout.on('data', (chunk) => {
    if (!streamEnded && recognizeStream && recognizeStream.writable) {
      try {
        recognizeStream.write(chunk);
      } catch (e) {
        // 書き込みエラーは無視
      }
    }
  });

  userStreams.set(userId, { audioStream, decoder, ffmpeg, recognizeStream, streamEnded: false });

  audioStream.on('end', () => {
    console.log(`\n🎤 [Server:${guildId}] User ${userId} stopped speaking`);
    const streams = userStreams.get(userId);
    if (streams) {
      streams.streamEnded = true;
      try {
        streams.ffmpeg.stdin.end();
      } catch (e) {}
      setTimeout(() => {
        try {
          if (streams.recognizeStream && !streams.recognizeStream.destroyed) {
            streams.recognizeStream.end();
          }
        } catch (e) {}
      }, 100);
      userStreams.delete(userId);
    }
  });
}

// Vosk リアルタイム認識（高速版）
function startVoskRecognition(userId, audioStream, decoder, userStreams, guildId) {
  // ユーザー名を取得
  const guild = client.guilds.cache.get(guildId);
  const member = guild?.members.cache.get(userId);
  const userName = member?.displayName || member?.user?.username || userId;
  
  // ffmpeg: 48kHz stereo -> 16kHz mono PCM（音量正規化付き）
  const ffmpeg = spawn('ffmpeg', [
    '-hide_banner', '-loglevel', 'error',  // エラーは表示
    '-f', 's16le', '-ar', '48000', '-ac', '2', '-i', 'pipe:0',
    '-af', 'pan=mono|c0=0.5*c0+0.5*c1,volume=2.0,highpass=f=100,lowpass=f=8000',  // 音量2倍 + ノイズフィルタ
    '-ar', '16000',
    '-f', 's16le',
    '-fflags', 'nobuffer',  // バッファリング無効
    '-flags', 'low_delay',  // 低遅延モード
    'pipe:1'
  ], { stdio: ['pipe', 'pipe', 'pipe'] });

  // Vosk認識プロセス
  const voskScript = join(__dirname, 'vosk_transcribe.py');
  const vosk = spawn('python3', ['-u', voskScript], {  // -u: unbuffered
    env: { ...process.env, VOSK_MODEL_PATH, VOSK_SAMPLE_RATE: '16000' },
    stdio: ['pipe', 'pipe', 'pipe']
  });

  let lastPartial = '';
  let lastPartialTime = 0;
  let triggeredKeywords = new Set();  // 既にトリガーしたキーワード（重複防止）
  let hasReceivedData = false;  // データ受信フラグ
  let totalBytes = 0;  // 受信バイト数

  ffmpeg.on('error', (err) => {
    console.log(`⚠️ [${userName}] ffmpegエラー: ${err.message}`);
  });
  
  ffmpeg.stderr.on('data', (data) => {
    const msg = data.toString().trim();
    if (msg) console.log(`⚠️ [${userName}] ffmpeg: ${msg}`);
  });
  
  vosk.on('error', (err) => console.error(`⚠️ [${userName}] Voskエラー:`, err));
  
  // ffmpegからのデータを監視
  ffmpeg.stdout.on('data', (chunk) => {
    if (!hasReceivedData) {
      hasReceivedData = true;
      console.log(`📊 [${userName}] 音声データ受信開始`);
    }
    totalBytes += chunk.length;
  });
  
  vosk.stdout.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    for (const line of lines) {
      try {
        const result = JSON.parse(line);
        if (result.type === 'final' && result.text) {
          console.log(`\n📝 [${userName}] 認識結果: "${result.text}"`);
          handleRecognitionResult(result.text, guildId);
          lastPartial = '';
          triggeredKeywords.clear();  // 発話終了でリセット
        } else if (result.type === 'partial' && result.text) {
          const now = Date.now();
          if (result.text !== lastPartial && now - lastPartialTime > 100) {
            process.stdout.write(`\r🎙️ [${userName}] "${result.text}"...          `);
            lastPartial = result.text;
            lastPartialTime = now;
            
            // 🚀 部分結果でもキーワード検出（超高速トリガー）
            const soundFile = getSoundFile(result.text);
            if (soundFile && !triggeredKeywords.has(soundFile)) {
              console.log(`\n⚡ [${userName}] 即時トリガー: "${result.text}" -> ${soundFile}`);
              playSound(soundFile, 'discord_voice_instant', guildId);
              triggeredKeywords.add(soundFile);  // 重複防止
            }
          }
        }
      } catch (e) {}
    }
  });

  vosk.stderr.on('data', (data) => {
    const msg = data.toString();
    if (!msg.includes('LOG') && !msg.includes('vosk') && !msg.includes('Model')) {
      console.error(`⚠️ [${userName}] Vosk:`, msg);
    }
  });

  // パイプライン: Discord -> Opus Decoder -> ffmpeg -> Vosk
  audioStream.pipe(decoder).pipe(ffmpeg.stdin);
  ffmpeg.stdout.pipe(vosk.stdin);

  userStreams.set(userId, { 
    audioStream, 
    decoder, 
    ffmpeg, 
    vosk, 
    userName,
    startTime: Date.now()  // 開始時刻を記録
  });

  audioStream.on('end', () => {
    const streams = userStreams.get(userId);
    const duration = streams ? Math.round((Date.now() - streams.startTime) / 1000) : 0;
    const dataInfo = hasReceivedData ? `${Math.round(totalBytes/1024)}KB` : '受信なし';
    console.log(`\n🎤 [${userName}] 発話終了 (${duration}秒, ${dataInfo})`);
    
    if (streams) {
      try {
        streams.ffmpeg.stdin.end();
        streams.vosk.stdin.end();
      } catch (e) {}
      userStreams.delete(userId);
    }
    
    // データを受信していない場合は警告
    if (!hasReceivedData) {
      console.log(`⚠️ [${userName}] 音声データを受信できませんでした。マイク設定を確認してください。`);
    }
  });
}

// ローカル Whisper 認識
function startWhisperRecognition(userId, audioStream, decoder, userStreams, guildId) {
  const timestamp = Date.now();
  const wavPath = join(SOUNDS_DIR, `temp_speech_${timestamp}.wav`);
  
  // ffmpeg: PCMをWAVに変換
  const ffmpeg = spawn('ffmpeg', [
    '-hide_banner', '-loglevel', 'error',
    '-f', 's16le', '-ar', '48000', '-ac', '2', '-i', 'pipe:0',
    '-ar', '16000', '-ac', '1', '-y', wavPath
  ]);

  ffmpeg.on('error', () => {});
  ffmpeg.stderr.on('data', () => {});

  audioStream.pipe(decoder).pipe(ffmpeg.stdin);

  userStreams.set(userId, { audioStream, decoder, ffmpeg, wavPath });

  audioStream.on('end', () => {
    console.log(`\n🎤 User ${userId} stopped speaking`);
    
    const streams = userStreams.get(userId);
    if (streams) {
      streams.ffmpeg.stdin.end();
      userStreams.delete(userId);
      
      // ffmpegが完了したらWhisperで認識
      streams.ffmpeg.on('close', () => {
        transcribeWithWhisper(wavPath);
      });
    }
  });
}

// Whisperで文字起こし
async function transcribeWithWhisper(wavPath) {
  if (!existsSync(wavPath)) {
    console.log('⚠️ WAV file not found');
    return;
  }

  const stats = statSync(wavPath);
  if (stats.size < 5000) {
    console.log('⚠️ Audio too short, skipping');
    try { unlinkSync(wavPath); } catch (e) {}
    return;
  }

  const startTime = Date.now();
  
  if (fasterWhisperAvailable) {
    // faster-whisper を使用（高速版）
    console.log(`🚀 faster-whisper processing... (${WHISPER_MODEL}, ${WHISPER_DEVICE})`);
    
    const scriptPath = join(__dirname, 'fast_transcribe.py');
    const whisper = spawn('python3', [
      scriptPath,
      wavPath,
      WHISPER_MODEL,
      WHISPER_DEVICE,
      WHISPER_LANGUAGE
    ]);

    let stdout = '';
    let stderr = '';
    whisper.stdout.on('data', (data) => { stdout += data.toString(); });
    whisper.stderr.on('data', (data) => { stderr += data.toString(); });

    whisper.on('close', (code) => {
      const elapsed = Date.now() - startTime;
      
      if (code === 0 && stdout.trim()) {
        const transcript = stdout.trim();
        console.log(`📝 faster-whisper result (${elapsed}ms): "${transcript}"`);
        handleRecognitionResult(transcript);
      } else if (stderr) {
        console.error(`❌ faster-whisper error:`, stderr);
      }
      
      try { unlinkSync(wavPath); } catch (e) {}
    });
  } else {
    // 通常の Whisper を使用
    console.log(`🔄 Whisper processing... (${WHISPER_MODEL}, ${WHISPER_DEVICE})`);

    const whisper = spawn('whisper', [
      wavPath,
      '--model', WHISPER_MODEL,
      '--device', WHISPER_DEVICE,
      '--language', WHISPER_LANGUAGE,
      '--output_format', 'txt',
      '--output_dir', SOUNDS_DIR,
      '--fp16', WHISPER_DEVICE === 'cuda' ? 'True' : 'False',
    ]);

    let stderr = '';
    whisper.stderr.on('data', (data) => { stderr += data.toString(); });

    whisper.on('close', (code) => {
      const elapsed = Date.now() - startTime;
      
      if (code === 0) {
        const txtPath = wavPath.replace('.wav', '.txt');
        if (existsSync(txtPath)) {
          const transcript = readFileSync(txtPath, 'utf-8').trim();
          console.log(`📝 Whisper result (${elapsed}ms): "${transcript}"`);
          
          if (transcript) {
            handleRecognitionResult(transcript);
          }
          
          try { unlinkSync(txtPath); } catch (e) {}
        }
      } else {
        console.error(`❌ Whisper error (code ${code}):`, stderr);
      }
      
      try { unlinkSync(wavPath); } catch (e) {}
    });
  }
}

// 認識結果の処理（共通）- 特定サーバーで再生
function handleRecognitionResult(transcript, guildId = null) {
  console.log(`📝 Recognized: "${transcript}"${guildId ? ` [Server:${guildId}]` : ''}`);
  
  const soundFile = getSoundFile(transcript);
  if (soundFile) {
    console.log(`🔊 Playing: ${soundFile}${guildId ? ` [Server:${guildId}]` : ''}`);
    playSound(soundFile, 'discord_voice', guildId);
    
    const notification = JSON.stringify({
      type: 'sound_played',
      keyword: transcript,
      soundFile: soundFile,
      source: 'discord_voice',
      guildId: guildId
    });
    connectedClients.forEach(client => {
      if (client.readyState === 1) {
        client.send(notification);
      }
    });
  }
}

// WAVバッファを作成
function createWavBuffer(pcmBuffer, sampleRate, channels, bitsPerSample) {
  const byteRate = sampleRate * channels * (bitsPerSample / 8);
  const blockAlign = channels * (bitsPerSample / 8);
  const dataSize = pcmBuffer.length;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;

  const buffer = Buffer.alloc(totalSize);
  
  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(totalSize - 8, 4);
  buffer.write('WAVE', 8);
  
  // fmt chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  
  // data chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  pcmBuffer.copy(buffer, 44);

  return buffer;
}

function handleLeaveChannel(ws, guildId = null) {
  if (guildId) {
    // 特定サーバーから退出
    const guildData = guildConnections.get(guildId);
    if (guildData && guildData.connection) {
      guildData.isListening = false;
      guildData.connection.destroy();
      guildData.connection = null;
      guildData.userStreams.clear();
      console.log(`👋 Left voice channel [Server:${guildId}]`);
      if (ws) ws.send(JSON.stringify({ type: 'left', guildId }));
      broadcastStatus();
    }
  } else {
    // 全サーバーから退出
    for (const [id, guildData] of guildConnections) {
      if (guildData.connection) {
        guildData.isListening = false;
        guildData.connection.destroy();
        guildData.connection = null;
        guildData.userStreams.clear();
        console.log(`👋 Left voice channel [Server:${id}]`);
      }
    }
    if (ws) ws.send(JSON.stringify({ type: 'left' }));
    broadcastStatus();
  }
}

function sendStatus(ws) {
  const sounds = { ...presetSounds };
  Object.keys(customSounds).forEach(k => sounds[k] = customSounds[k].file);
  
  // 接続中のサーバー数をカウント
  const connectedGuilds = [...guildConnections.entries()]
    .filter(([_, data]) => data.connection)
    .map(([id, data]) => ({ id, isListening: data.isListening }));
  
  ws.send(JSON.stringify({
    type: 'status',
    connected: client.isReady(),
    botName: client.user?.tag || null,
    inVoiceChannel: connectedGuilds.length > 0,
    connectedGuilds: connectedGuilds,
    guildsCount: client.guilds.cache.size,
    customSoundsCount: Object.keys(customSounds).length
  }));
}

function sendGuilds(ws) {
  const guilds = client.guilds.cache.map(g => ({ id: g.id, name: g.name, icon: g.iconURL() }));
  ws.send(JSON.stringify({ type: 'guilds', guilds }));
}

function sendChannels(guildId, ws) {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return ws.send(JSON.stringify({ type: 'error', message: 'サーバーが見つかりません' }));
  const channels = guild.channels.cache.filter(ch => ch.isVoiceBased()).map(ch => ({ id: ch.id, name: ch.name }));
  ws.send(JSON.stringify({ type: 'channels', channels }));
}

function broadcastStatus() {
  const connectedGuilds = [...guildConnections.entries()]
    .filter(([_, data]) => data.connection)
    .map(([id, data]) => ({ id, isListening: data.isListening }));
    
  const status = {
    type: 'status',
    connected: client.isReady(),
    botName: client.user?.tag || null,
    inVoiceChannel: connectedGuilds.length > 0,
    connectedGuilds: connectedGuilds,
    guildsCount: client.guilds.cache.size
  };
  connectedClients.forEach(ws => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(status));
  });
}

// HTTP API
app.get('/status', (req, res) => {
  const connectedGuilds = [...guildConnections.entries()]
    .filter(([_, data]) => data.connection)
    .map(([id, data]) => ({ 
      id, 
      isListening: data.isListening,
      userStreams: data.userStreams.size
    }));
    
  res.json({
    connected: client.isReady(),
    botName: client.user?.tag || null,
    connectedGuilds: connectedGuilds,
    connectedCount: connectedGuilds.length,
    guildsCount: client.guilds.cache.size,
    wsClients: connectedClients.size,
    customSounds: Object.keys(customSounds),
    sttEngine: STT_ENGINE,
    whisperModel: WHISPER_MODEL,
    whisperDevice: WHISPER_DEVICE
  });
});

app.get('/sounds', (req, res) => {
  const all = { preset: presetSounds, custom: customSounds };
  res.json(all);
});

app.listen(HTTP_PORT, () => {
  console.log(`📡 HTTP Server started on port ${HTTP_PORT}`);
});

// Discord Bot Events
client.once(Events.ClientReady, async () => {
  console.log(`✅ Discord Bot logged in as ${client.user.tag}`);
  
  // スラッシュコマンドを登録
  await registerSlashCommands();
  
  console.log('');
  console.log('🔧 現在の設定:');
  console.log(`   音声認識エンジン: ${STT_ENGINE}`);
  if (STT_ENGINE === 'whisper') {
    console.log(`   Whisperモデル: ${WHISPER_MODEL}`);
    console.log(`   デバイス: ${WHISPER_DEVICE}`);
  }
  console.log('');
  console.log('📝 使い方:');
  console.log('  【スラッシュコマンド】');
  console.log('  /join - ボイスチャンネルに参加');
  console.log('  /leave - ボイスチャンネルから退出');
  console.log('  /sounds - サウンド一覧');
  console.log('  /add - サウンド追加');
  console.log('  /edit - キーワード編集');
  console.log('  /delete - サウンド削除');
  console.log('  /play - サウンド再生');
  console.log('');
  console.log('  【テキストコマンド（従来互換）】');
  console.log('  トリガ:キーワード + 音声ファイル添付');
  console.log('  !sounds, !delete, !join, !leave');
  console.log('');
  broadcastStatus();
});

// ===========================================
// スラッシュコマンド処理
// ===========================================
client.on(Events.InteractionCreate, async (interaction) => {
  // オートコンプリート処理
  if (interaction.isAutocomplete()) {
    const focusedOption = interaction.options.getFocused(true);
    const keywords = Object.keys(customSounds);
    
    const filtered = keywords
      .filter(keyword => keyword.toLowerCase().includes(focusedOption.value.toLowerCase()))
      .slice(0, 25);
    
    await interaction.respond(
      filtered.map(keyword => ({ name: keyword, value: keyword }))
    );
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  try {
    switch (commandName) {
      case 'join': {
        const voiceChannel = interaction.member?.voice?.channel;
        if (!voiceChannel) {
          await interaction.reply({ content: '❌ 先にボイスチャンネルに参加してください', ephemeral: true });
          return;
        }
        await interaction.deferReply();
        try {
          await joinVC(interaction.guild, voiceChannel);
          await interaction.editReply(`✅ ${voiceChannel.name} に参加しました！音声認識を開始します🎤`);
        } catch (error) {
          await interaction.editReply('❌ 参加に失敗しました: ' + error.message);
        }
        break;
      }

      case 'leave': {
        handleLeaveChannel(null, interaction.guild.id);
        await interaction.reply('👋 ボイスチャンネルから退出しました');
        break;
      }

      case 'sounds': {
        const customList = Object.entries(customSounds)
          .map(([keyword, data]) => {
            const desc = data.description ? ` - ${data.description}` : '';
            return `• **${keyword}**${desc}`;
          })
          .join('\n') || 'カスタムサウンドはまだ登録されていません';
        
        const embed = {
          title: '🎵 登録済みサウンド',
          description: '説明文がないサウンドは `/edit` で追加できます',
          fields: [
            {
              name: `カスタムサウンド (${Object.keys(customSounds).length}件)`,
              value: customList.slice(0, 1024)
            }
          ],
          color: 0x5865F2
        };
        await interaction.reply({ embeds: [embed] });
        break;
      }

      case 'add': {
        const keyword = interaction.options.getString('keyword');
        const attachment = interaction.options.getAttachment('file');
        const description = interaction.options.getString('description');
        
        const validExtensions = ['.mp3', '.wav', '.ogg', '.m4a'];
        const ext = attachment.name.toLowerCase().slice(attachment.name.lastIndexOf('.'));
        
        if (!validExtensions.includes(ext)) {
          await interaction.reply({ content: '❌ 対応していないファイル形式です（MP3, WAV, OGG, M4A のみ）', ephemeral: true });
          return;
        }

        await interaction.deferReply();
        
        try {
          const response = await fetch(attachment.url);
          const buffer = Buffer.from(await response.arrayBuffer());
          const filename = `custom_${Date.now()}${ext}`;
          const filepath = join(SOUNDS_DIR, filename);
          
          writeFileSync(filepath, buffer);

          customSounds[keyword] = {
            file: filename,
            description: description || null,
            addedBy: interaction.user.tag,
            addedAt: new Date().toISOString()
          };
          saveCustomSounds(customSounds);

          const descText = description ? `\n説明: ${description}` : '';
          console.log(`✅ New sound registered: "${keyword}" -> ${filename}${description ? ` (${description})` : ''}`);
          await interaction.editReply(`✅ サウンドを登録しました！\nキーワード: **${keyword}**${descText}\nボイスチャンネルで「${keyword}」と言うと再生されます🔊`);
        } catch (error) {
          console.error('Failed to save sound:', error);
          await interaction.editReply('❌ サウンドの保存に失敗しました');
        }
        break;
      }

      case 'delete': {
        const keyword = interaction.options.getString('keyword');
        
        if (customSounds[keyword]) {
          const file = customSounds[keyword].file;
          delete customSounds[keyword];
          saveCustomSounds(customSounds);
          try { unlinkSync(join(SOUNDS_DIR, file)); } catch (e) {}
          await interaction.reply(`✅ サウンド「${keyword}」を削除しました`);
        } else {
          await interaction.reply({ content: `❌ サウンド「${keyword}」は見つかりませんでした`, ephemeral: true });
        }
        break;
      }

      case 'edit': {
        const keyword = interaction.options.getString('keyword');
        const newKeyword = interaction.options.getString('new_keyword');
        const newDescription = interaction.options.getString('description');
        
        if (!customSounds[keyword]) {
          await interaction.reply({ content: `❌ サウンド「${keyword}」は見つかりませんでした`, ephemeral: true });
          return;
        }
        
        // 何も変更しない場合
        if (!newKeyword && newDescription === null) {
          await interaction.reply({ content: '❌ 新しいキーワードまたは説明文を指定してください', ephemeral: true });
          return;
        }
        
        // 新しいキーワードが既に存在する場合
        if (newKeyword && newKeyword !== keyword && customSounds[newKeyword]) {
          await interaction.reply({ content: `❌ キーワード「${newKeyword}」は既に使用されています`, ephemeral: true });
          return;
        }
        
        const changes = [];
        
        // 説明文を更新
        if (newDescription !== null) {
          customSounds[keyword].description = newDescription || null;
          changes.push(newDescription ? `説明: ${newDescription}` : '説明を削除');
        }
        
        // キーワードを変更
        if (newKeyword && newKeyword !== keyword) {
          customSounds[newKeyword] = {
            ...customSounds[keyword],
            editedBy: interaction.user.tag,
            editedAt: new Date().toISOString()
          };
          delete customSounds[keyword];
          changes.push(`キーワード: 「${keyword}」→「${newKeyword}」`);
        } else {
          customSounds[keyword].editedBy = interaction.user.tag;
          customSounds[keyword].editedAt = new Date().toISOString();
        }
        
        saveCustomSounds(customSounds);
        
        console.log(`✏️ Sound edited: "${keyword}" - ${changes.join(', ')}`);
        await interaction.reply(`✅ サウンドを編集しました！\n${changes.join('\n')}`);
        break;
      }

      case 'info': {
        const keyword = interaction.options.getString('keyword');
        
        if (!customSounds[keyword]) {
          await interaction.reply({ content: `❌ サウンド「${keyword}」は見つかりませんでした`, ephemeral: true });
          return;
        }
        
        const data = customSounds[keyword];
        const addedDate = new Date(data.addedAt).toLocaleDateString('ja-JP');
        
        const embed = {
          title: `🔊 ${keyword}`,
          fields: [
            {
              name: '📝 説明',
              value: data.description || '_説明なし（`/edit` で追加できます）_'
            },
            {
              name: '👤 登録者',
              value: data.addedBy,
              inline: true
            },
            {
              name: '📅 登録日',
              value: addedDate,
              inline: true
            }
          ],
          color: 0x5865F2
        };
        
        if (data.editedBy) {
          const editedDate = new Date(data.editedAt).toLocaleDateString('ja-JP');
          embed.fields.push({
            name: '✏️ 最終編集',
            value: `${data.editedBy} (${editedDate})`,
            inline: true
          });
        }
        
        await interaction.reply({ embeds: [embed] });
        break;
      }

      case 'play': {
        const keyword = interaction.options.getString('keyword');
        const guildData = guildConnections.get(interaction.guild.id);
        
        if (!guildData || !guildData.connection) {
          await interaction.reply({ content: '❌ ボイスチャンネルに接続していません。先に `/join` を実行してください', ephemeral: true });
          return;
        }
        
        const soundFile = customSounds[keyword]?.file;
        if (!soundFile) {
          await interaction.reply({ content: `❌ サウンド「${keyword}」は見つかりませんでした`, ephemeral: true });
          return;
        }
        
        const played = await playSound(soundFile, 'slash_command', interaction.guild.id);
        if (played) {
          await interaction.reply(`🔊 「${keyword}」を再生しました！`);
        } else {
          await interaction.reply({ content: '❌ 再生に失敗しました', ephemeral: true });
        }
        break;
      }

      case 'help': {
        const embed = {
          title: '🎵 Super Soundboard Bot',
          description: 'ボイスチャンネルでキーワードを話すと自動でサウンドが再生されるBotです',
          fields: [
            {
              name: '🔊 基本的な使い方',
              value: '1. `/join` でBotをVCに呼ぶ\n2. VCでキーワードを言う\n3. 自動でサウンドが再生される！'
            },
            {
              name: '📝 サウンド管理',
              value: '`/add` - 新しいサウンドを追加\n`/edit` - キーワードを変更\n`/delete` - サウンドを削除\n`/sounds` - 一覧を表示'
            },
            {
              name: '🎮 その他',
              value: '`/play` - サウンドを手動再生\n`/join` - VCに参加\n`/leave` - VCから退出'
            },
            {
              name: '🔧 デバッグ',
              value: '`/debug` - 音声認識の状態を確認\n`/test` - マイクテスト'
            },
            {
              name: '💡 テキストコマンド（従来互換）',
              value: '`トリガ:キーワード` + ファイル添付\n`!sounds`, `!delete`, `!join`, `!leave`'
            }
          ],
          color: 0x5865F2
        };
        await interaction.reply({ embeds: [embed] });
        break;
      }

      case 'debug': {
        const guildData = guildConnections.get(interaction.guild.id);
        const voiceChannel = interaction.member?.voice?.channel;
        
        const vcMembers = voiceChannel 
          ? voiceChannel.members.filter(m => !m.user.bot).map(m => m.displayName).join(', ')
          : 'VCに参加していません';
        
        const activeStreams = guildData?.userStreams 
          ? [...guildData.userStreams.entries()].map(([id, data]) => {
              const member = interaction.guild.members.cache.get(id);
              const name = member?.displayName || id;
              const age = Math.round((Date.now() - (data.startTime || 0)) / 1000);
              return `${name} (${age}秒)`;
            }).join(', ') || 'なし'
          : 'なし';
        
        const embed = {
          title: '🔧 デバッグ情報',
          fields: [
            {
              name: '🔌 接続状態',
              value: guildData?.connection ? '✅ 接続中' : '❌ 未接続',
              inline: true
            },
            {
              name: '👂 リスニング',
              value: guildData?.isListening ? '✅ 有効' : '❌ 無効',
              inline: true
            },
            {
              name: '🎤 音声認識エンジン',
              value: STT_ENGINE.toUpperCase(),
              inline: true
            },
            {
              name: '👥 VCメンバー',
              value: vcMembers || 'なし'
            },
            {
              name: '📡 アクティブストリーム',
              value: activeStreams
            },
            {
              name: '🔊 登録サウンド数',
              value: `${Object.keys(customSounds).length}件`,
              inline: true
            }
          ],
          color: 0x5865F2,
          footer: { text: '音声が認識されない場合は、マイクの入力レベルを確認してください' }
        };
        await interaction.reply({ embeds: [embed] });
        break;
      }

      case 'test': {
        const voiceChannel = interaction.member?.voice?.channel;
        if (!voiceChannel) {
          await interaction.reply({ content: '❌ 先にボイスチャンネルに参加してください', ephemeral: true });
          return;
        }
        
        const guildData = guildConnections.get(interaction.guild.id);
        if (!guildData?.connection) {
          await interaction.reply({ content: '❌ Botがボイスチャンネルに参加していません。先に `/join` を実行してください', ephemeral: true });
          return;
        }
        
        await interaction.reply('🎤 **マイクテスト開始！**\n5秒間、何か話してみてください...\nコンソールにログが表示されます。');
        
        // 5秒後に結果を報告
        setTimeout(async () => {
          const streams = guildData.userStreams;
          const activeUsers = [...streams.entries()].map(([id, data]) => {
            const member = interaction.guild.members.cache.get(id);
            return member?.displayName || id;
          });
          
          if (activeUsers.length > 0) {
            await interaction.followUp(`✅ 音声を検出しました: ${activeUsers.join(', ')}`);
          } else {
            await interaction.followUp('⚠️ 音声が検出されませんでした。\n\n**確認事項:**\n• マイクがミュートになっていないか\n• 入力デバイスが正しく選択されているか\n• Discordの音声設定で「入力感度」が適切か');
          }
        }, 5000);
        break;
      }
    }
  } catch (error) {
    console.error('Slash command error:', error);
    const reply = { content: '❌ コマンドの実行中にエラーが発生しました', ephemeral: true };
    if (interaction.deferred) {
      await interaction.editReply(reply.content);
    } else if (!interaction.replied) {
      await interaction.reply(reply);
    }
  }
});

// メッセージでサウンド登録（従来互換）
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;

  const content = message.content.trim();

  // サウンド登録: トリガ:キーワード または トリガ:キーワード:説明文 + ファイル添付
  if (content.startsWith('トリガ:') || content.startsWith('トリガ：')) {
    const parts = content.replace(/^トリガ[:：]/, '').trim().split(/[:：]/);
    const keyword = parts[0]?.trim();
    const description = parts[1]?.trim() || null;
    
    if (!keyword) {
      return message.reply('❌ キーワードを指定してください\n例: `トリガ:やったー` または `トリガ:やったー:歓声が流れる`');
    }

    if (message.attachments.size === 0) {
      return message.reply('❌ 音声ファイルを添付してください（MP3, WAV, OGG）');
    }

    const attachment = message.attachments.first();
    const validExtensions = ['.mp3', '.wav', '.ogg', '.m4a'];
    const ext = attachment.name.toLowerCase().slice(attachment.name.lastIndexOf('.'));
    
    if (!validExtensions.includes(ext)) {
      return message.reply('❌ 対応していないファイル形式です（MP3, WAV, OGG, M4A のみ）');
    }

    try {
      // ファイルをダウンロード
      const response = await fetch(attachment.url);
      const buffer = Buffer.from(await response.arrayBuffer());
      const filename = `custom_${Date.now()}${ext}`;
      const filepath = join(SOUNDS_DIR, filename);
      
      writeFileSync(filepath, buffer);

      // カスタムサウンドに登録
      customSounds[keyword] = {
        file: filename,
        description: description,
        addedBy: message.author.tag,
        addedAt: new Date().toISOString()
      };
      saveCustomSounds(customSounds);

      const descText = description ? `\n説明: ${description}` : '';
      console.log(`✅ New sound registered: "${keyword}" -> ${filename}${description ? ` (${description})` : ''}`);
      message.reply(`✅ サウンドを登録しました！\nキーワード: **${keyword}**${descText}\nボイスチャンネルで「${keyword}」と言うと再生されます🔊`);
    } catch (error) {
      console.error('Failed to save sound:', error);
      message.reply('❌ サウンドの保存に失敗しました');
    }
    return;
  }

  // コマンド
  if (content === '!sounds' || content === '!サウンド') {
    const customList = Object.entries(customSounds)
      .map(([keyword, data]) => {
        const desc = data.description ? ` - ${data.description}` : '';
        return `• **${keyword}**${desc}`;
      })
      .join('\n') || 'なし';
    
    message.reply(`🎵 **登録済みサウンド** (${Object.keys(customSounds).length}件)\n\n${customList}`);
    return;
  }

  // サウンド情報確認: !info キーワード
  if (content.startsWith('!info ')) {
    const keyword = content.replace(/^!info\s+/, '').trim();
    
    if (!customSounds[keyword]) {
      message.reply(`❌ サウンド「${keyword}」は見つかりませんでした`);
      return;
    }
    
    const data = customSounds[keyword];
    const desc = data.description || '（説明なし）';
    const addedDate = new Date(data.addedAt).toLocaleDateString('ja-JP');
    
    let reply = `🔊 **${keyword}**\n📝 ${desc}\n👤 登録者: ${data.addedBy}\n📅 登録日: ${addedDate}`;
    if (data.editedBy) {
      const editedDate = new Date(data.editedAt).toLocaleDateString('ja-JP');
      reply += `\n✏️ 編集: ${data.editedBy} (${editedDate})`;
    }
    
    message.reply(reply);
    return;
  }

  if (content.startsWith('!delete ') || content.startsWith('!削除 ')) {
    const keyword = content.replace(/^!(delete|削除)\s+/, '').trim();
    if (customSounds[keyword]) {
      const file = customSounds[keyword].file;
      delete customSounds[keyword];
      saveCustomSounds(customSounds);
      try { unlinkSync(join(SOUNDS_DIR, file)); } catch (e) {}
      message.reply(`✅ サウンド「${keyword}」を削除しました`);
    } else {
      message.reply(`❌ サウンド「${keyword}」は見つかりませんでした`);
    }
    return;
  }

  // トリガ編集: !edit 旧キーワード 新キーワード
  if (content.startsWith('!edit ') || content.startsWith('!編集 ')) {
    const args = content.replace(/^!(edit|編集)\s+/, '').trim().split(/\s+/);
    if (args.length < 2) {
      message.reply('❌ 使用方法: `!edit 旧キーワード 新キーワード`');
      return;
    }
    const oldKeyword = args[0];
    const newKeyword = args[1];
    
    if (!customSounds[oldKeyword]) {
      message.reply(`❌ サウンド「${oldKeyword}」は見つかりませんでした`);
      return;
    }
    
    if (customSounds[newKeyword]) {
      message.reply(`❌ キーワード「${newKeyword}」は既に使用されています`);
      return;
    }
    
    customSounds[newKeyword] = {
      ...customSounds[oldKeyword],
      editedBy: message.author.tag,
      editedAt: new Date().toISOString()
    };
    delete customSounds[oldKeyword];
    saveCustomSounds(customSounds);
    
    console.log(`✏️ Sound keyword edited: "${oldKeyword}" -> "${newKeyword}"`);
    message.reply(`✅ キーワードを変更しました！\n「${oldKeyword}」→「${newKeyword}」`);
    return;
  }

  if (content === '!join' || content === '!参加') {
    const voiceChannel = message.member?.voice?.channel;
    if (!voiceChannel) {
      return message.reply('❌ 先にボイスチャンネルに参加してください');
    }
    try {
      await joinVC(message.guild, voiceChannel);
      message.reply(`✅ ${voiceChannel.name} に参加しました！音声認識を開始します🎤`);
    } catch (error) {
      message.reply('❌ 参加に失敗しました: ' + error.message);
    }
    return;
  }

  if (content === '!leave' || content === '!退出') {
    handleLeaveChannel(null, message.guild.id);
    message.reply('👋 ボイスチャンネルから退出しました');
    return;
  }

  if (content === '!help' || content === '!ヘルプ') {
    message.reply(`🎵 **Super Soundboard Bot**

**スラッシュコマンド（推奨）:**
• \`/join\` - ボイスチャンネルに参加
• \`/leave\` - ボイスチャンネルから退出
• \`/sounds\` - 登録済みサウンド一覧
• \`/add\` - サウンドを追加（説明文付き可）
• \`/edit\` - キーワードや説明を編集
• \`/info\` - サウンドの詳細を確認
• \`/delete\` - サウンドを削除
• \`/play\` - サウンドを手動再生

**テキストコマンド（従来互換）:**
• \`トリガ:キーワード\` + ファイル添付
• \`トリガ:キーワード:説明文\` + ファイル添付
• \`!info キーワード\` - サウンドの詳細
• \`!edit 旧 新\` - キーワード編集
• \`!delete キーワード\` - サウンド削除
• \`!sounds\`, \`!join\`, \`!leave\`

**使い方:**
1. \`/join\` でBotをVCに呼ぶ
2. VCでキーワードを言う
3. 自動でサウンドが再生される！`);
    return;
  }
});

client.on(Events.Error, (error) => {
  console.error('Discord client error:', error);
});

client.on(Events.VoiceStateUpdate, (oldState, newState) => {
  // Botが退出した場合
  if (oldState.member?.id === client.user?.id && !newState.channel) {
    const guildId = oldState.guild.id;
    const guildData = guildConnections.get(guildId);
    if (guildData) {
      guildData.connection = null;
      guildData.isListening = false;
      guildData.userStreams.clear();
      console.log(`👋 Bot disconnected from server: ${guildId}`);
    }
    broadcastStatus();
  }
});

// Botにログイン
console.log('🚀 Starting Discord Bot...');
client.login(DISCORD_TOKEN).catch((error) => {
  console.error('❌ Failed to login:', error.message);
  process.exit(1);
});

process.on('SIGINT', () => {
  console.log('\n👋 Shutting down...');
  // 全サーバーから切断
  for (const [_, guildData] of guildConnections) {
    if (guildData.connection) {
      guildData.connection.destroy();
    }
  }
  client.destroy();
  process.exit(0);
});
