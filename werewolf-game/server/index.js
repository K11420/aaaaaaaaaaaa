const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { GameRoom, PHASES } = require('./gameLogic');
const { executeCPUActions, startCPUChat } = require('./cpuAI');
const geminiAI = require('./geminiAI');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true,
  path: '/socket.io/'
});

app.use(cors());
app.use(express.json());

// デバッグ用ログ
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// ゲームルームの管理
const gameRooms = new Map();
const playerRooms = new Map(); // playerId -> roomId
const cpuChatIntervals = new Map(); // roomId -> interval

// ルーム作成
app.post('/api/rooms/create', (req, res) => {
  const { playerName, settings } = req.body;
  const roomId = generateRoomId();
  
  const gameRoom = new GameRoom(roomId, null, settings || {});
  gameRooms.set(roomId, gameRoom);
  
  res.json({ 
    success: true, 
    roomId,
    message: 'ルームが作成されました'
  });
});

// ルーム一覧取得
app.get('/api/rooms', (req, res) => {
  const rooms = [];
  for (const [roomId, room] of gameRooms.entries()) {
    if (room.phase === PHASES.WAITING) {
      rooms.push({
        roomId,
        playerCount: room.getAllPlayers().length,
        maxPlayers: room.settings.maxPlayers
      });
    }
  }
  res.json({ rooms });
});

// Gemini APIキーの設定
app.post('/api/gemini/set-api-key', (req, res) => {
  try {
    const { apiKey } = req.body;
    
    if (!apiKey || apiKey.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'APIキーが必要です'
      });
    }

    geminiAI.setApiKey(apiKey.trim());
    
    res.json({
      success: true,
      message: 'Gemini APIキーが設定されました',
      isInitialized: geminiAI.isInitialized()
    });
  } catch (error) {
    console.error('API key setup error:', error);
    res.status(500).json({
      success: false,
      error: 'APIキーの設定に失敗しました'
    });
  }
});

// Gemini APIの状態確認
app.get('/api/gemini/status', (req, res) => {
  res.json({
    isInitialized: geminiAI.isInitialized(),
    message: geminiAI.isInitialized() 
      ? 'Gemini APIは有効です' 
      : 'Gemini APIキーが設定されていません（デフォルトのAIを使用）'
  });
});

// Socket.IO接続
io.on('connection', (socket) => {
  console.log(`✅ Player connected: ${socket.id}`);

  // ルームに参加
  socket.on('join-room', ({ roomId, playerName }) => {
    console.log(`📥 Join room request: ${playerName} -> ${roomId}`);
    const gameRoom = gameRooms.get(roomId);
    
    if (!gameRoom) {
      console.log(`❌ Room not found: ${roomId}`);
      socket.emit('error', { message: 'ルームが見つかりません' });
      return;
    }

    if (gameRoom.phase !== PHASES.WAITING) {
      console.log(`❌ Game already started in room: ${roomId}`);
      socket.emit('error', { message: 'ゲームが既に開始されています' });
      return;
    }

    const result = gameRoom.addPlayer(socket.id, playerName, gameRoom.players.size === 0);
    console.log(`👤 Add player result:`, result);
    
    if (!result.success) {
      socket.emit('error', { message: result.error });
      return;
    }

    socket.join(roomId);
    playerRooms.set(socket.id, roomId);
    
    // ルーム情報を全員に送信
    io.to(roomId).emit('room-update', gameRoom.getGameState());
    socket.emit('joined-room', { 
      roomId, 
      playerId: socket.id,
      isHost: result.player.isHost
    });

    console.log(`${playerName} joined room ${roomId}`);
  });

  // CPUプレイヤー追加
  socket.on('add-cpu', ({ roomId }) => {
    const gameRoom = gameRooms.get(roomId);
    const playerId = socket.id;

    if (!gameRoom) {
      socket.emit('error', { message: 'ルームが見つかりません' });
      return;
    }

    const player = gameRoom.players.get(playerId);
    if (!player || !player.isHost) {
      socket.emit('error', { message: 'ホストのみがCPUを追加できます' });
      return;
    }

    const totalPlayers = gameRoom.getAllPlayers().length;
    if (totalPlayers >= gameRoom.settings.maxPlayers) {
      socket.emit('error', { message: 'プレイヤー数が上限に達しています' });
      return;
    }

    const cpuPlayer = gameRoom.addCPUPlayer();
    io.to(roomId).emit('room-update', gameRoom.getGameState());
    io.to(roomId).emit('system-message', { 
      message: `${cpuPlayer.name}が参加しました（CPU）` 
    });
  });

  // CPUプレイヤー削除
  socket.on('remove-cpu', ({ roomId, cpuId }) => {
    const gameRoom = gameRooms.get(roomId);
    const playerId = socket.id;

    if (!gameRoom) {
      socket.emit('error', { message: 'ルームが見つかりません' });
      return;
    }

    const player = gameRoom.players.get(playerId);
    if (!player || !player.isHost) {
      socket.emit('error', { message: 'ホストのみがCPUを削除できます' });
      return;
    }

    const cpuPlayer = gameRoom.cpuPlayers.get(cpuId);
    if (cpuPlayer) {
      gameRoom.removeCPUPlayer(cpuId);
      io.to(roomId).emit('room-update', gameRoom.getGameState());
      io.to(roomId).emit('system-message', { 
        message: `${cpuPlayer.name}が退出しました` 
      });
    }
  });

  // ゲーム設定更新
  socket.on('update-settings', ({ roomId, settings }) => {
    const gameRoom = gameRooms.get(roomId);
    const playerId = socket.id;

    if (!gameRoom) return;

    const player = gameRoom.players.get(playerId);
    if (!player || !player.isHost) {
      socket.emit('error', { message: 'ホストのみが設定を変更できます' });
      return;
    }

    gameRoom.settings = { ...gameRoom.settings, ...settings };
    io.to(roomId).emit('settings-updated', gameRoom.settings);
    io.to(roomId).emit('room-update', gameRoom.getGameState());
  });

  // ゲーム開始
  socket.on('start-game', ({ roomId }) => {
    const gameRoom = gameRooms.get(roomId);
    const playerId = socket.id;

    if (!gameRoom) return;

    const player = gameRoom.players.get(playerId);
    if (!player || !player.isHost) {
      socket.emit('error', { message: 'ホストのみがゲームを開始できます' });
      return;
    }

    const result = gameRoom.startGame();
    
    if (!result.success) {
      socket.emit('error', { message: result.error });
      return;
    }

    // 各プレイヤーに役職を通知
    for (const [pid, p] of gameRoom.players.entries()) {
      io.to(pid).emit('role-assigned', {
        role: p.role,
        roleInfo: getRoleInfo(p.role)
      });
    }

    // CPUプレイヤーの役職も設定されている
    io.to(roomId).emit('game-started', gameRoom.getGameState());
    io.to(roomId).emit('phase-change', { 
      phase: PHASES.DAY_DISCUSSION,
      day: 1 
    });

    // CPUチャット開始
    const chatInterval = startCPUChat(gameRoom, io);
    cpuChatIntervals.set(roomId, chatInterval);

    console.log(`Game started in room ${roomId}`);
  });

  // チャットメッセージ
  socket.on('chat-message', ({ roomId, message }) => {
    const gameRoom = gameRooms.get(roomId);
    if (!gameRoom) return;

    const player = gameRoom.players.get(socket.id);
    if (!player) return;

    io.to(roomId).emit('chat-message', {
      playerId: socket.id,
      playerName: player.name,
      message,
      isCPU: false
    });
  });

  // 投票
  socket.on('vote', ({ roomId, targetId }) => {
    const gameRoom = gameRooms.get(roomId);
    if (!gameRoom) return;

    const result = gameRoom.castVote(socket.id, targetId);
    
    if (result.success) {
      const player = gameRoom.players.get(socket.id);
      io.to(roomId).emit('vote-cast', {
        voterId: socket.id,
        voterName: player.name
      });

      // 全員が投票したかチェック
      const alivePlayers = gameRoom.getAlivePlayers();
      if (gameRoom.votes.size === alivePlayers.length) {
        processVotingPhase(roomId);
      }
    }
  });

  // 夜アクション
  socket.on('night-action', ({ roomId, action, targetId }) => {
    const gameRoom = gameRooms.get(roomId);
    if (!gameRoom) return;

    const result = gameRoom.submitNightAction(socket.id, action, targetId);
    
    if (result.success) {
      socket.emit('action-submitted', { action });

      // 全員がアクションを提出したかチェック
      checkNightActionsComplete(roomId);
    }
  });

  // フェーズ進行（ホストのみ）
  socket.on('next-phase', ({ roomId }) => {
    const gameRoom = gameRooms.get(roomId);
    const playerId = socket.id;

    if (!gameRoom) return;

    const player = gameRoom.players.get(playerId);
    if (!player || !player.isHost) {
      socket.emit('error', { message: 'ホストのみがフェーズを進められます' });
      return;
    }

    advancePhase(roomId);
  });

  // 切断処理
  socket.on('disconnect', () => {
    const roomId = playerRooms.get(socket.id);
    if (roomId) {
      const gameRoom = gameRooms.get(roomId);
      if (gameRoom) {
        gameRoom.removePlayer(socket.id);
        io.to(roomId).emit('room-update', gameRoom.getGameState());
        
        // ルームが空になったら削除
        if (gameRoom.getAllPlayers().length === 0) {
          const interval = cpuChatIntervals.get(roomId);
          if (interval) clearInterval(interval);
          cpuChatIntervals.delete(roomId);
          gameRooms.delete(roomId);
          console.log(`Room ${roomId} deleted`);
        }
      }
      playerRooms.delete(socket.id);
    }
    console.log(`Player disconnected: ${socket.id}`);
  });
});

// 投票フェーズの処理
async function processVotingPhase(roomId) {
  const gameRoom = gameRooms.get(roomId);
  if (!gameRoom) return;

  const result = gameRoom.processVoting();
  
  io.to(roomId).emit('voting-result', result);
  
  // 勝敗判定
  const winCheck = gameRoom.checkWinCondition();
  if (winCheck.gameOver) {
    io.to(roomId).emit('game-over', {
      winner: winCheck.winner,
      players: gameRoom.getAllPlayers()
    });
    
    // CPUチャット停止
    const interval = cpuChatIntervals.get(roomId);
    if (interval) clearInterval(interval);
    cpuChatIntervals.delete(roomId);
    return;
  }

  // 次のフェーズへ
  setTimeout(() => advancePhase(roomId), 3000);
}

// 夜アクションの完了チェック
async function checkNightActionsComplete(roomId) {
  const gameRoom = gameRooms.get(roomId);
  if (!gameRoom) return;

  const alivePlayers = gameRoom.getAlivePlayers();
  const playersWithActions = alivePlayers.filter(p => 
    p.role === 'werewolf' || p.role === 'seer' || p.role === 'knight'
  );

  if (gameRoom.nightActions.size >= playersWithActions.length) {
    processNightPhase(roomId);
  }
}

// 夜フェーズの処理
async function processNightPhase(roomId) {
  const gameRoom = gameRooms.get(roomId);
  if (!gameRoom) return;

  const result = gameRoom.processNightActions();
  
  // 占い結果を占い師に送信
  if (result.seerResult) {
    io.to(result.seerResult.playerId).emit('seer-result', {
      targetName: result.seerResult.targetName,
      isWerewolf: result.seerResult.isWerewolf
    });
  }

  // 夜の結果を全員に送信
  io.to(roomId).emit('night-result', {
    killed: result.killed,
    message: result.killed ? `${result.killed.name}が襲撃されました` : '誰も襲撃されませんでした'
  });

  // 勝敗判定
  const winCheck = gameRoom.checkWinCondition();
  if (winCheck.gameOver) {
    io.to(roomId).emit('game-over', {
      winner: winCheck.winner,
      players: gameRoom.getAllPlayers()
    });
    
    // CPUチャット停止
    const interval = cpuChatIntervals.get(roomId);
    if (interval) clearInterval(interval);
    cpuChatIntervals.delete(roomId);
    return;
  }

  // 次のフェーズへ
  setTimeout(() => advancePhase(roomId), 3000);
}

// フェーズ進行
async function advancePhase(roomId) {
  const gameRoom = gameRooms.get(roomId);
  if (!gameRoom) return;

  gameRoom.nextPhase();
  
  io.to(roomId).emit('phase-change', {
    phase: gameRoom.phase,
    day: gameRoom.day
  });

  io.to(roomId).emit('room-update', gameRoom.getGameState());

  // CPUの自動アクション
  if (gameRoom.phase === PHASES.VOTING || gameRoom.phase === PHASES.NIGHT) {
    setTimeout(() => executeCPUActions(gameRoom, io), 2000);
  }

  // 投票フェーズの自動タイムアウト（60秒）
  if (gameRoom.phase === PHASES.VOTING) {
    setTimeout(() => {
      const room = gameRooms.get(roomId);
      if (room && room.phase === PHASES.VOTING) {
        processVotingPhase(roomId);
      }
    }, 60000);
  }

  // 夜フェーズの自動タイムアウト（45秒）
  if (gameRoom.phase === PHASES.NIGHT) {
    setTimeout(() => {
      const room = gameRooms.get(roomId);
      if (room && room.phase === PHASES.NIGHT) {
        processNightPhase(roomId);
      }
    }, 45000);
  }
}

// ユーティリティ関数
function generateRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function getRoleInfo(role) {
  const roleInfoMap = {
    werewolf: {
      name: '人狼',
      description: '夜に村人を襲撃できます。人狼が全滅すると敗北、村人と同数以上になると勝利です。',
      team: 'werewolf'
    },
    seer: {
      name: '占い師',
      description: '夜に1人を占い、人狼かどうか知ることができます。',
      team: 'villager'
    },
    knight: {
      name: '騎士',
      description: '夜に1人を守り、人狼の襲撃から守ることができます。',
      team: 'villager'
    },
    villager: {
      name: '村人',
      description: '特殊能力はありませんが、議論と投票で人狼を見つけ出しましょう。',
      team: 'villager'
    }
  };
  return roleInfoMap[role];
}

const PORT = process.env.PORT || 4096;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Werewolf server running on port ${PORT}`);
});
