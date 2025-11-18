// ゲームロジック管理

const ROLES = {
  WEREWOLF: 'werewolf',
  SEER: 'seer',
  KNIGHT: 'knight',
  VILLAGER: 'villager'
};

const PHASES = {
  WAITING: 'waiting',
  DAY_DISCUSSION: 'day_discussion',
  VOTING: 'voting',
  NIGHT: 'night',
  GAME_OVER: 'game_over'
};

class GameRoom {
  constructor(roomId, creatorId, settings) {
    this.roomId = roomId;
    this.creatorId = creatorId;
    this.players = new Map(); // playerId -> player object
    this.cpuPlayers = new Map(); // cpuId -> cpu player object
    this.phase = PHASES.WAITING;
    this.day = 0;
    this.votes = new Map();
    this.nightActions = new Map();
    this.history = [];
    this.settings = {
      maxPlayers: settings.maxPlayers || 10,
      werewolfCount: settings.werewolfCount || 2,
      seerCount: settings.seerCount || 1,
      knightCount: settings.knightCount || 1,
      cpuCount: settings.cpuCount || 0
    };
    this.winner = null;
    this.protectedPlayer = null;
  }

  addPlayer(playerId, playerName, isHost = false) {
    if (this.players.size >= this.settings.maxPlayers) {
      return { success: false, error: 'ルームが満員です' };
    }

    const player = {
      id: playerId,
      name: playerName,
      role: null,
      isAlive: true,
      isHost: isHost,
      isCPU: false
    };

    this.players.set(playerId, player);
    return { success: true, player };
  }

  addCPUPlayer() {
    const cpuId = `cpu_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const cpuNames = ['AI太郎', 'ロボ子', 'CPU三郎', 'ボット花子', 'AI五郎', 'デジ子', 'サイバー七', 'ネット八'];
    const usedNames = [...this.players.values(), ...this.cpuPlayers.values()].map(p => p.name);
    const availableNames = cpuNames.filter(name => !usedNames.includes(name));
    const cpuName = availableNames[Math.floor(Math.random() * availableNames.length)] || `CPU${this.cpuPlayers.size + 1}`;

    const cpuPlayer = {
      id: cpuId,
      name: cpuName,
      role: null,
      isAlive: true,
      isHost: false,
      isCPU: true
    };

    this.cpuPlayers.set(cpuId, cpuPlayer);
    return cpuPlayer;
  }

  removeCPUPlayer(cpuId) {
    return this.cpuPlayers.delete(cpuId);
  }

  removePlayer(playerId) {
    return this.players.delete(playerId);
  }

  getAllPlayers() {
    return [...this.players.values(), ...this.cpuPlayers.values()];
  }

  getAlivePlayers() {
    return this.getAllPlayers().filter(p => p.isAlive);
  }

  startGame() {
    const allPlayers = this.getAllPlayers();
    if (allPlayers.length < 3) {
      return { success: false, error: '最低3人のプレイヤーが必要です' };
    }

    // 役職の配布
    this.assignRoles();
    this.phase = PHASES.DAY_DISCUSSION;
    this.day = 1;

    this.history.push({
      day: 0,
      phase: 'game_start',
      message: 'ゲームが開始されました'
    });

    return { success: true };
  }

  assignRoles() {
    const allPlayers = this.getAllPlayers();
    const shuffled = [...allPlayers].sort(() => Math.random() - 0.5);
    
    let index = 0;
    
    // 人狼の配布
    for (let i = 0; i < Math.min(this.settings.werewolfCount, shuffled.length); i++) {
      shuffled[index].role = ROLES.WEREWOLF;
      index++;
    }
    
    // 占い師の配布
    for (let i = 0; i < Math.min(this.settings.seerCount, shuffled.length - index); i++) {
      shuffled[index].role = ROLES.SEER;
      index++;
    }
    
    // 騎士の配布
    for (let i = 0; i < Math.min(this.settings.knightCount, shuffled.length - index); i++) {
      shuffled[index].role = ROLES.KNIGHT;
      index++;
    }
    
    // 残りは村人
    for (let i = index; i < shuffled.length; i++) {
      shuffled[i].role = ROLES.VILLAGER;
    }

    // マップに反映
    allPlayers.forEach(player => {
      if (this.players.has(player.id)) {
        this.players.set(player.id, player);
      } else if (this.cpuPlayers.has(player.id)) {
        this.cpuPlayers.set(player.id, player);
      }
    });
  }

  castVote(playerId, targetId) {
    const player = this.players.get(playerId) || this.cpuPlayers.get(playerId);
    if (!player || !player.isAlive || this.phase !== PHASES.VOTING) {
      return { success: false, error: '投票できません' };
    }

    this.votes.set(playerId, targetId);
    return { success: true };
  }

  processVoting() {
    const voteCounts = new Map();
    
    // 投票を集計
    for (const [voter, targetId] of this.votes.entries()) {
      const count = voteCounts.get(targetId) || 0;
      voteCounts.set(targetId, count + 1);
    }

    // 最多得票者を見つける
    let maxVotes = 0;
    let executed = null;
    
    for (const [targetId, count] of voteCounts.entries()) {
      if (count > maxVotes) {
        maxVotes = count;
        executed = targetId;
      }
    }

    if (executed) {
      const executedPlayer = this.players.get(executed) || this.cpuPlayers.get(executed);
      if (executedPlayer) {
        executedPlayer.isAlive = false;
        this.history.push({
          day: this.day,
          phase: 'voting',
          message: `${executedPlayer.name}が処刑されました`,
          executedPlayer: executedPlayer.name,
          role: executedPlayer.role
        });
      }
    }

    this.votes.clear();
    return { executed, voteCounts: Object.fromEntries(voteCounts) };
  }

  submitNightAction(playerId, action, targetId) {
    const player = this.players.get(playerId) || this.cpuPlayers.get(playerId);
    if (!player || !player.isAlive || this.phase !== PHASES.NIGHT) {
      return { success: false, error: 'アクションを実行できません' };
    }

    this.nightActions.set(playerId, { action, targetId });
    return { success: true };
  }

  processNightActions() {
    let attacked = null;
    let protectedTarget = null;
    let seerResult = null;

    // 各役職のアクションを処理
    for (const [playerId, action] of this.nightActions.entries()) {
      const player = this.players.get(playerId) || this.cpuPlayers.get(playerId);
      
      if (player.role === ROLES.WEREWOLF && action.action === 'attack') {
        attacked = action.targetId;
      } else if (player.role === ROLES.KNIGHT && action.action === 'protect') {
        protectedTarget = action.targetId;
      } else if (player.role === ROLES.SEER && action.action === 'divine') {
        const target = this.players.get(action.targetId) || this.cpuPlayers.get(action.targetId);
        if (target) {
          seerResult = {
            playerId: playerId,
            targetName: target.name,
            isWerewolf: target.role === ROLES.WEREWOLF
          };
        }
      }
    }

    // 攻撃と防御の判定
    let killed = null;
    if (attacked && attacked !== protectedTarget) {
      const attackedPlayer = this.players.get(attacked) || this.cpuPlayers.get(attacked);
      if (attackedPlayer) {
        attackedPlayer.isAlive = false;
        killed = attackedPlayer;
        this.history.push({
          day: this.day,
          phase: 'night',
          message: `${attackedPlayer.name}が人狼に襲撃されました`,
          killedPlayer: attackedPlayer.name
        });
      }
    } else if (attacked && attacked === protectedTarget) {
      this.history.push({
        day: this.day,
        phase: 'night',
        message: '騎士の護衛により、誰も死にませんでした'
      });
    }

    this.protectedPlayer = protectedTarget;
    this.nightActions.clear();
    
    return { killed, protected: protectedTarget, seerResult };
  }

  checkWinCondition() {
    const alivePlayers = this.getAlivePlayers();
    const aliveWerewolves = alivePlayers.filter(p => p.role === ROLES.WEREWOLF);
    const aliveVillagers = alivePlayers.filter(p => p.role !== ROLES.WEREWOLF);

    if (aliveWerewolves.length === 0) {
      this.winner = 'villagers';
      this.phase = PHASES.GAME_OVER;
      return { gameOver: true, winner: 'villagers' };
    }

    if (aliveWerewolves.length >= aliveVillagers.length) {
      this.winner = 'werewolves';
      this.phase = PHASES.GAME_OVER;
      return { gameOver: true, winner: 'werewolves' };
    }

    return { gameOver: false };
  }

  nextPhase() {
    switch (this.phase) {
      case PHASES.DAY_DISCUSSION:
        this.phase = PHASES.VOTING;
        break;
      case PHASES.VOTING:
        this.phase = PHASES.NIGHT;
        break;
      case PHASES.NIGHT:
        this.day++;
        this.phase = PHASES.DAY_DISCUSSION;
        break;
      default:
        break;
    }
  }

  getGameState() {
    return {
      roomId: this.roomId,
      phase: this.phase,
      day: this.day,
      players: this.getAllPlayers().map(p => ({
        id: p.id,
        name: p.name,
        isAlive: p.isAlive,
        isHost: p.isHost,
        isCPU: p.isCPU
      })),
      alivePlayers: this.getAlivePlayers().length,
      winner: this.winner,
      history: this.history.slice(-5) // 最新5件のみ
    };
  }

  getPlayerPrivateState(playerId) {
    const player = this.players.get(playerId) || this.cpuPlayers.get(playerId);
    if (!player) return null;

    return {
      role: player.role,
      isAlive: player.isAlive
    };
  }
}

module.exports = { GameRoom, ROLES, PHASES };
