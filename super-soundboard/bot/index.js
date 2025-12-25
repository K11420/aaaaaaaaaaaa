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
const STATS_FILE = join(__dirname, 'sound_stats.json');  // 統計データ保存用

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

// ===========================================
// 統計データ管理
// ===========================================
// 統計データ構造:
// {
//   sounds: { keyword: { totalPlays: N, lastPlayed: timestamp } },
//   users: { oderId: { totalTriggers: N, sounds: { keyword: N }, name: 'username' } },
//   daily: { 'YYYY-MM-DD': { plays: N, triggers: { keyword: N } } }
// }

function loadStats() {
  try {
    if (existsSync(STATS_FILE)) {
      return JSON.parse(readFileSync(STATS_FILE, 'utf-8'));
    }
  } catch (e) {
    console.error('Failed to load stats:', e);
  }
  return { sounds: {}, users: {}, daily: {} };
}

function saveStats(stats) {
  try {
    writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2));
  } catch (e) {
    console.error('Failed to save stats:', e);
  }
}

let soundStats = loadStats();

// 統計を記録する関数
function recordSoundPlay(keyword, userId, userName) {
  const now = Date.now();
  const today = new Date().toISOString().split('T')[0];  // YYYY-MM-DD
  
  // サウンド統計
  if (!soundStats.sounds[keyword]) {
    soundStats.sounds[keyword] = { totalPlays: 0, lastPlayed: null };
  }
  soundStats.sounds[keyword].totalPlays++;
  soundStats.sounds[keyword].lastPlayed = now;
  
  // ユーザー統計
  if (userId) {
    if (!soundStats.users[userId]) {
      soundStats.users[userId] = { totalTriggers: 0, sounds: {}, name: userName || 'Unknown' };
    }
    soundStats.users[userId].totalTriggers++;
    soundStats.users[userId].name = userName || soundStats.users[userId].name;
    if (!soundStats.users[userId].sounds[keyword]) {
      soundStats.users[userId].sounds[keyword] = 0;
    }
    soundStats.users[userId].sounds[keyword]++;
  }
  
  // 日別統計
  if (!soundStats.daily[today]) {
    soundStats.daily[today] = { plays: 0, triggers: {} };
  }
  soundStats.daily[today].plays++;
  if (!soundStats.daily[today].triggers[keyword]) {
    soundStats.daily[today].triggers[keyword] = 0;
  }
  soundStats.daily[today].triggers[keyword]++;
  
  // 30日より古いデータを削除
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const cutoffDate = thirtyDaysAgo.toISOString().split('T')[0];
  for (const date of Object.keys(soundStats.daily)) {
    if (date < cutoffDate) {
      delete soundStats.daily[date];
    }
  }
  
  // 保存（デバウンス：1秒後）
  if (recordSoundPlay.saveTimeout) {
    clearTimeout(recordSoundPlay.saveTimeout);
  }
  recordSoundPlay.saveTimeout = setTimeout(() => saveStats(soundStats), 1000);
}

// ランキングを取得
function getSoundRanking(limit = 10) {
  const sorted = Object.entries(soundStats.sounds)
    .sort((a, b) => b[1].totalPlays - a[1].totalPlays)
    .slice(0, limit);
  return sorted.map(([keyword, data], index) => ({
    rank: index + 1,
    keyword,
    plays: data.totalPlays,
    lastPlayed: data.lastPlayed
  }));
}

// ユーザーランキングを取得
function getUserRanking(limit = 10) {
  const sorted = Object.entries(soundStats.users)
    .sort((a, b) => b[1].totalTriggers - a[1].totalTriggers)
    .slice(0, limit);
  return sorted.map(([userId, data], index) => ({
    rank: index + 1,
    userId,
    name: data.name,
    triggers: data.totalTriggers,
    topSound: Object.entries(data.sounds).sort((a, b) => b[1] - a[1])[0]
  }));
}

// 特定ユーザーの統計を取得
function getUserStats(userId) {
  const userData = soundStats.users[userId];
  if (!userData) return null;
  
  const topSounds = Object.entries(userData.sounds)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  
  return {
    name: userData.name,
    totalTriggers: userData.totalTriggers,
    topSounds: topSounds.map(([keyword, count]) => ({ keyword, count }))
  };
}

// 今日の統計を取得
function getTodayStats() {
  const today = new Date().toISOString().split('T')[0];
  const data = soundStats.daily[today] || { plays: 0, triggers: {} };
  
  const topSounds = Object.entries(data.triggers)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  
  return {
    date: today,
    totalPlays: data.plays,
    topSounds: topSounds.map(([keyword, count]) => ({ keyword, count }))
  };
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
  // 統計コマンド
  new SlashCommandBuilder()
    .setName('ranking')
    .setDescription('サウンド再生ランキングを表示します')
    .addIntegerOption(option =>
      option.setName('limit')
        .setDescription('表示件数（デフォルト: 10）')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(25)),
  new SlashCommandBuilder()
    .setName('userstats')
    .setDescription('ユーザーの統計情報を表示します')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('確認するユーザー（省略で自分）')
        .setRequired(false)),
  new SlashCommandBuilder()
    .setName('userranking')
    .setDescription('ユーザー発言ランキングを表示します')
    .addIntegerOption(option =>
      option.setName('limit')
        .setDescription('表示件数（デフォルト: 10）')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(25)),
  new SlashCommandBuilder()
    .setName('todaystats')
    .setDescription('今日のサウンド再生統計を表示します'),
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
      const existingStream = guildData.userStreams.get(userId);
      const streamAge = Date.now() - (existingStream.startTime || 0);
      
      // 5秒以上経過していたら古いストリームを終了して再開
      if (streamAge > 5000) {
        console.log(`🔄 [${userName}] 古いストリームを終了して再開 (${Math.round(streamAge/1000)}秒経過)`);
        if (existingStream.cleanup) {
          existingStream.cleanup();
        } else {
          try {
            if (existingStream.decoder) existingStream.decoder.destroy();
            if (existingStream.ffmpeg) existingStream.ffmpeg.kill('SIGTERM');
            if (existingStream.vosk) existingStream.vosk.kill('SIGTERM');
            if (existingStream.audioStream) existingStream.audioStream.destroy();
          } catch (e) {}
          guildData.userStreams.delete(userId);
        }
      } else {
        // 5秒未満なら処理中としてスキップ
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
    
    // ストリームエラーをログ
    audioStream.on('error', (err) => {
      console.log(`⚠️ [${userName}] ストリームエラー: ${err.message}`);
    });

    if (STT_ENGINE === 'google') {
      // === Google Cloud Speech-to-Text Streaming ===
      if (!speechClient) {
        console.log(`⚠️ [${userName}] Google Speech未設定のためスキップ`);
        audioStream.destroy();
        return;
      }
      startGoogleSpeechRecognition(userId, audioStream, guildData.userStreams, guildId, userName);
    } else if (STT_ENGINE === 'whisper') {
      // === ローカル Whisper ===
      startWhisperRecognition(userId, audioStream, guildData.userStreams, guildId, userName);
    } else if (STT_ENGINE === 'vosk') {
      // === Vosk リアルタイム認識 ===
      startVoskRecognition(userId, audioStream, guildData.userStreams, guildId, userName);
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
function startGoogleSpeechRecognition(userId, audioStream, userStreams, guildId, userName) {
  // 新しいOpusデコーダーを作成
  let decoder;
  try {
    decoder = new prism.opus.Decoder({ 
      rate: 48000, 
      channels: 2, 
      frameSize: 960 
    });
  } catch (e) {
    console.log(`⚠️ [${userName}] デコーダー作成失敗: ${e.message}`);
    return;
  }
  
  decoder.on('error', (err) => {
    console.log(`⚠️ [${userName}] デコーダーエラー: ${err.message}`);
  });
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
            console.log(`\n📝 [${userName}] Google: "${transcript}"`);
            handleRecognitionResult(transcript, guildId, userId, userName);
          } else if (transcript) {
            process.stdout.write(`\r🎙️ [${userName}] "${transcript}"...          `);
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

  // クリーンアップ関数
  const cleanup = () => {
    try {
      if (decoder && !decoder.destroyed) decoder.destroy();
      if (ffmpeg) ffmpeg.kill('SIGTERM');
      if (recognizeStream && !recognizeStream.destroyed) recognizeStream.end();
      if (audioStream && !audioStream.destroyed) audioStream.destroy();
    } catch (e) {}
    userStreams.delete(userId);
  };

  userStreams.set(userId, { 
    audioStream, 
    decoder, 
    ffmpeg, 
    recognizeStream, 
    streamEnded: false,
    startTime: Date.now(),
    cleanup
  });

  audioStream.on('end', () => {
    console.log(`🔇 [${userName}] 発話終了`);
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

// Vosk リアルタイム認識（高速版）- 新しいデコーダーを毎回作成
function startVoskRecognition(userId, audioStream, userStreams, guildId, userName) {
  // 新しいOpusデコーダーを作成（毎回新しいインスタンスを使用）
  let decoder;
  try {
    decoder = new prism.opus.Decoder({ 
      rate: 48000, 
      channels: 2, 
      frameSize: 960 
    });
  } catch (e) {
    console.log(`⚠️ [${userName}] デコーダー作成失敗: ${e.message}`);
    return;
  }
  
  // デコーダーエラーをハンドリング（エラーが出てもストリームを継続）
  let decoderErrorCount = 0;
  decoder.on('error', (err) => {
    decoderErrorCount++;
    if (decoderErrorCount <= 3) {
      console.log(`⚠️ [${userName}] デコーダーエラー #${decoderErrorCount}: ${err.message}`);
    }
  });

  // ffmpeg: 48kHz stereo -> 16kHz mono PCM
  const ffmpeg = spawn('ffmpeg', [
    '-hide_banner', '-loglevel', 'error',
    '-f', 's16le', '-ar', '48000', '-ac', '2', '-i', 'pipe:0',
    '-af', 'volume=2.0,highpass=f=100,lowpass=f=8000',
    '-ar', '16000',
    '-ac', '1',
    '-f', 's16le',
    '-fflags', 'nobuffer',
    '-flags', 'low_delay',
    'pipe:1'
  ], { stdio: ['pipe', 'pipe', 'pipe'] });

  // Vosk認識プロセス
  const voskScript = join(__dirname, 'vosk_transcribe.py');
  const vosk = spawn('python3', ['-u', voskScript], {
    env: { ...process.env, VOSK_MODEL_PATH, VOSK_SAMPLE_RATE: '16000' },
    stdio: ['pipe', 'pipe', 'pipe']
  });

  let lastPartial = '';
  let lastPartialTime = 0;
  let triggeredKeywords = new Set();
  let hasReceivedData = false;
  let totalBytes = 0;
  let isCleanedUp = false;

  const cleanup = () => {
    if (isCleanedUp) return;
    isCleanedUp = true;
    
    try {
      decoder.destroy();
    } catch (e) {}
    try {
      ffmpeg.kill('SIGTERM');
    } catch (e) {}
    try {
      vosk.kill('SIGTERM');
    } catch (e) {}
    
    userStreams.delete(userId);
  };

  ffmpeg.on('error', (err) => {
    if (!err.message.includes('EPIPE')) {
      console.log(`⚠️ [${userName}] ffmpegエラー: ${err.message}`);
    }
  });
  
  ffmpeg.stderr.on('data', (data) => {
    const msg = data.toString().trim();
    if (msg && !msg.includes('pipe')) {
      console.log(`⚠️ [${userName}] ffmpeg: ${msg}`);
    }
  });
  
  vosk.on('error', (err) => {
    console.error(`⚠️ [${userName}] Voskエラー:`, err);
  });
  
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
          handleRecognitionResult(result.text, guildId, userId, userName);
          lastPartial = '';
          triggeredKeywords.clear();
        } else if (result.type === 'partial' && result.text) {
          const now = Date.now();
          if (result.text !== lastPartial && now - lastPartialTime > 100) {
            process.stdout.write(`\r🎙️ [${userName}] "${result.text}"...          `);
            lastPartial = result.text;
            lastPartialTime = now;
            
            const soundFile = getSoundFile(result.text);
            if (soundFile && !triggeredKeywords.has(soundFile)) {
              console.log(`\n⚡ [${userName}] 即時トリガー: "${result.text}" -> ${soundFile}`);
              // 即時トリガーでも統計記録
              const keyword = findMatchingKeyword(result.text);
              if (keyword) {
                recordSoundPlay(keyword, userId, userName);
              }
              playSound(soundFile, 'discord_voice_instant', guildId);
              triggeredKeywords.add(soundFile);
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

  // パイプライン: Discord Opus -> Decoder -> ffmpeg -> Vosk
  audioStream.pipe(decoder).pipe(ffmpeg.stdin);
  ffmpeg.stdout.pipe(vosk.stdin);

  userStreams.set(userId, { 
    audioStream, 
    decoder,
    ffmpeg, 
    vosk, 
    userName,
    startTime: Date.now(),
    cleanup
  });

  audioStream.on('end', () => {
    const streams = userStreams.get(userId);
    const duration = streams ? Math.round((Date.now() - streams.startTime) / 1000) : 0;
    const dataInfo = hasReceivedData ? `${Math.round(totalBytes/1024)}KB` : '受信なし';
    const errorInfo = decoderErrorCount > 0 ? `, エラー${decoderErrorCount}回` : '';
    console.log(`\n🎤 [${userName}] 発話終了 (${duration}秒, ${dataInfo}${errorInfo})`);
    
    cleanup();
    
    if (!hasReceivedData) {
      console.log(`⚠️ [${userName}] 音声データを受信できませんでした`);
    }
  });
  
  // タイムアウト: 30秒以上続いたら強制終了
  setTimeout(() => {
    if (userStreams.has(userId)) {
      console.log(`⏰ [${userName}] タイムアウト（30秒）`);
      cleanup();
    }
  }, 30000);
}

// ローカル Whisper 認識
function startWhisperRecognition(userId, audioStream, userStreams, guildId, userName) {
  // 新しいOpusデコーダーを作成
  let decoder;
  try {
    decoder = new prism.opus.Decoder({ 
      rate: 48000, 
      channels: 2, 
      frameSize: 960 
    });
  } catch (e) {
    console.log(`⚠️ [${userName}] デコーダー作成失敗: ${e.message}`);
    return;
  }
  
  decoder.on('error', (err) => {
    console.log(`⚠️ [${userName}] デコーダーエラー: ${err.message}`);
  });
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
        transcribeWithWhisper(wavPath, guildId);
      });
    }
  });
}

// Whisper Serverに接続して認識（超高速）
const WHISPER_SERVER_PORT = parseInt(process.env.WHISPER_SERVER_PORT || '5555');
let whisperServerAvailable = false;

async function checkWhisperServer() {
  return new Promise((resolve) => {
    const net = require('net');
    const client = new net.Socket();
    client.setTimeout(500);
    client.on('connect', () => {
      client.destroy();
      resolve(true);
    });
    client.on('error', () => resolve(false));
    client.on('timeout', () => {
      client.destroy();
      resolve(false);
    });
    client.connect(WHISPER_SERVER_PORT, 'localhost');
  });
}

async function transcribeWithWhisperServer(wavPath, guildId) {
  return new Promise((resolve, reject) => {
    const net = require('net');
    const client = new net.Socket();
    const startTime = Date.now();
    
    client.setTimeout(10000);
    
    client.on('connect', () => {
      client.write(wavPath + '\n');
    });
    
    client.on('data', (data) => {
      const text = data.toString().trim();
      const elapsed = Date.now() - startTime;
      client.destroy();
      
      if (text && !text.startsWith('ERROR')) {
        console.log(`📝 [Server] ${elapsed}ms: "${text}"`);
        handleRecognitionResult(text, guildId);
        resolve(text);
      } else {
        reject(new Error(text));
      }
    });
    
    client.on('error', (err) => reject(err));
    client.on('timeout', () => {
      client.destroy();
      reject(new Error('Timeout'));
    });
    
    client.connect(WHISPER_SERVER_PORT, 'localhost');
  });
}

// Whisperで文字起こし
async function transcribeWithWhisper(wavPath, guildId) {
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
  
  // まずWhisper Serverを試す（最速）
  if (whisperServerAvailable || await checkWhisperServer()) {
    whisperServerAvailable = true;
    try {
      await transcribeWithWhisperServer(wavPath, guildId);
      try { unlinkSync(wavPath); } catch (e) {}
      return;
    } catch (e) {
      console.log(`⚠️ Whisper Server error: ${e.message}, falling back to direct call`);
      whisperServerAvailable = false;
    }
  }
  
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
        handleRecognitionResult(transcript, guildId);
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
function handleRecognitionResult(transcript, guildId = null, userId = null, userName = null) {
  console.log(`📝 Recognized: "${transcript}"${guildId ? ` [Server:${guildId}]` : ''}${userName ? ` by ${userName}` : ''}`);
  
  const soundFile = getSoundFile(transcript);
  if (soundFile) {
    // キーワードを特定（完全一致を探す）
    const keyword = findMatchingKeyword(transcript);
    
    console.log(`🔊 Playing: ${soundFile}${guildId ? ` [Server:${guildId}]` : ''}`);
    playSound(soundFile, 'discord_voice', guildId);
    
    // 統計を記録
    if (keyword) {
      recordSoundPlay(keyword, userId, userName);
    }
    
    const notification = JSON.stringify({
      type: 'sound_played',
      keyword: keyword || transcript,
      soundFile: soundFile,
      source: 'discord_voice',
      guildId: guildId,
      userId: userId,
      userName: userName
    });
    connectedClients.forEach(client => {
      if (client.readyState === 1) {
        client.send(notification);
      }
    });
  }
}

// マッチしたキーワードを見つける
function findMatchingKeyword(transcript) {
  const lowerTranscript = transcript.toLowerCase();
  
  // カスタムサウンドから検索
  for (const keyword of Object.keys(customSounds)) {
    if (lowerTranscript.includes(keyword.toLowerCase())) {
      return keyword;
    }
  }
  
  // プリセットサウンドから検索
  for (const keyword of Object.keys(presetSounds)) {
    if (lowerTranscript.includes(keyword.toLowerCase())) {
      return keyword;
    }
  }
  
  return null;
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
              name: '📊 統計',
              value: '`/ranking` - サウンド再生ランキング\n`/userranking` - ユーザー発言ランキング\n`/userstats` - 個人の統計\n`/todaystats` - 今日の統計'
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

      // ========== 統計コマンド ==========
      
      case 'ranking': {
        const limit = interaction.options.getInteger('limit') || 10;
        const ranking = getSoundRanking(limit);
        
        if (ranking.length === 0) {
          await interaction.reply({ content: '📊 まだ再生データがありません', ephemeral: true });
          return;
        }
        
        const medals = ['🥇', '🥈', '🥉'];
        const lines = ranking.map((item, i) => {
          const medal = medals[i] || `**${item.rank}.**`;
          const lastPlayed = item.lastPlayed 
            ? `(最終: ${new Date(item.lastPlayed).toLocaleDateString('ja-JP')})`
            : '';
          return `${medal} **${item.keyword}** - ${item.plays}回 ${lastPlayed}`;
        });
        
        const totalPlays = Object.values(soundStats.sounds).reduce((sum, s) => sum + s.totalPlays, 0);
        
        const embed = {
          title: '🏆 サウンド再生ランキング',
          description: lines.join('\n'),
          footer: { text: `総再生回数: ${totalPlays}回 | 登録サウンド: ${Object.keys(customSounds).length}件` },
          color: 0xFFD700,
          timestamp: new Date().toISOString()
        };
        
        await interaction.reply({ embeds: [embed] });
        break;
      }

      case 'userranking': {
        const limit = interaction.options.getInteger('limit') || 10;
        const ranking = getUserRanking(limit);
        
        if (ranking.length === 0) {
          await interaction.reply({ content: '📊 まだユーザーデータがありません', ephemeral: true });
          return;
        }
        
        const medals = ['🥇', '🥈', '🥉'];
        const lines = ranking.map((item, i) => {
          const medal = medals[i] || `**${item.rank}.**`;
          const topSound = item.topSound ? `(お気に入り: ${item.topSound[0]})` : '';
          return `${medal} **${item.name}** - ${item.triggers}回 ${topSound}`;
        });
        
        const embed = {
          title: '👑 ユーザー発言ランキング',
          description: lines.join('\n'),
          footer: { text: 'サウンドをトリガーした回数でランキング' },
          color: 0x9B59B6,
          timestamp: new Date().toISOString()
        };
        
        await interaction.reply({ embeds: [embed] });
        break;
      }

      case 'userstats': {
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const stats = getUserStats(targetUser.id);
        
        if (!stats) {
          const message = targetUser.id === interaction.user.id 
            ? '📊 あなたの統計データはまだありません。ボイスチャンネルでキーワードを発言してみてください！'
            : `📊 ${targetUser.displayName} の統計データはまだありません`;
          await interaction.reply({ content: message, ephemeral: true });
          return;
        }
        
        const topSoundsText = stats.topSounds.length > 0
          ? stats.topSounds.map((s, i) => `${i + 1}. **${s.keyword}** (${s.count}回)`).join('\n')
          : 'なし';
        
        const embed = {
          title: `📊 ${stats.name} の統計`,
          fields: [
            {
              name: '🎯 総トリガー回数',
              value: `**${stats.totalTriggers}回**`,
              inline: true
            },
            {
              name: '🏆 よく使うサウンド TOP5',
              value: topSoundsText,
              inline: false
            }
          ],
          color: 0x3498DB,
          thumbnail: { url: targetUser.displayAvatarURL() },
          timestamp: new Date().toISOString()
        };
        
        await interaction.reply({ embeds: [embed] });
        break;
      }

      case 'todaystats': {
        const stats = getTodayStats();
        
        const topSoundsText = stats.topSounds.length > 0
          ? stats.topSounds.map((s, i) => `${i + 1}. **${s.keyword}** (${s.count}回)`).join('\n')
          : 'まだ再生されていません';
        
        const embed = {
          title: `📅 今日の統計 (${stats.date})`,
          fields: [
            {
              name: '🔊 本日の再生回数',
              value: `**${stats.totalPlays}回**`,
              inline: true
            },
            {
              name: '🔥 人気サウンド TOP5',
              value: topSoundsText,
              inline: false
            }
          ],
          color: 0x2ECC71,
          timestamp: new Date().toISOString()
        };
        
        await interaction.reply({ embeds: [embed] });
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
