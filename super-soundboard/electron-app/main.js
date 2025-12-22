const { app, BrowserWindow, desktopCapturer, ipcMain } = require('electron');
const path = require('path');
const WebSocket = require('ws');

let mainWindow;
let ws;
const BOT_WS_URL = process.env.BOT_WS_URL || 'ws://localhost:8765';

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 400,
    height: 300,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    // 最小化してタスクトレイに
    show: true,
  });

  mainWindow.loadFile('index.html');
  
  // 開発者ツール（デバッグ用）
  // mainWindow.webContents.openDevTools();
}

function connectToBot() {
  console.log(`Connecting to Bot: ${BOT_WS_URL}`);
  
  ws = new WebSocket(BOT_WS_URL);
  
  ws.on('open', () => {
    console.log('✅ Connected to Discord Bot');
    mainWindow?.webContents.send('bot-status', { connected: true });
  });
  
  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      
      if (msg.type === 'discord_audio') {
        // Discord音声をレンダラーに送信して認識
        mainWindow?.webContents.send('discord-audio', msg);
      } else if (msg.type === 'sound_played') {
        console.log(`🔊 Sound played: ${msg.soundFile}`);
      }
    } catch (e) {
      console.error('Parse error:', e);
    }
  });
  
  ws.on('close', () => {
    console.log('❌ Disconnected from Bot, reconnecting in 3s...');
    mainWindow?.webContents.send('bot-status', { connected: false });
    setTimeout(connectToBot, 3000);
  });
  
  ws.on('error', (err) => {
    console.error('WebSocket error:', err.message);
  });
}

// レンダラーからの音声認識結果を受け取る
ipcMain.on('speech-result', (event, text) => {
  console.log(`📝 Recognized: "${text}"`);
  
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'speech_result',
      text: text,
      timestamp: Date.now()
    }));
  }
});

app.whenReady().then(() => {
  createWindow();
  connectToBot();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
