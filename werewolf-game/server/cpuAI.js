// CPU AI ロジック

const { ROLES, PHASES } = require('./gameLogic');
const geminiAI = require('./geminiAI');

class CPUPlayer {
  constructor(gameRoom) {
    this.gameRoom = gameRoom;
  }

  // Gemini AIを使った投票判断
  async makeVoteDecisionWithAI(cpuPlayer) {
    const alivePlayers = this.gameRoom.getAlivePlayers().filter(p => p.id !== cpuPlayer.id);
    
    if (alivePlayers.length === 0) return null;

    try {
      const context = {
        cpuPlayer,
        alivePlayers,
        gameHistory: this.gameRoom.history,
        day: this.gameRoom.day
      };

      const targetId = await geminiAI.makeVoteDecision(context);
      return targetId || this.makeVoteDecision(cpuPlayer);
    } catch (error) {
      console.error('AI vote decision error:', error);
      return this.makeVoteDecision(cpuPlayer);
    }
  }

  // Gemini AIを使った夜アクション判断
  async makeNightActionDecisionWithAI(cpuPlayer) {
    const alivePlayers = this.gameRoom.getAlivePlayers().filter(p => p.id !== cpuPlayer.id);
    
    if (alivePlayers.length === 0) return null;

    try {
      const context = {
        cpuPlayer,
        alivePlayers,
        role: cpuPlayer.role,
        gameHistory: this.gameRoom.history,
        day: this.gameRoom.day
      };

      const targetId = await geminiAI.makeNightActionDecision(context);
      
      if (targetId) {
        const action = this.getActionForRole(cpuPlayer.role);
        return { action, targetId };
      }
      
      return this.makeNightActionDecision(cpuPlayer);
    } catch (error) {
      console.error('AI night action error:', error);
      return this.makeNightActionDecision(cpuPlayer);
    }
  }

  // 役職に応じたアクション名を取得
  getActionForRole(role) {
    const actions = {
      [ROLES.WEREWOLF]: 'attack',
      [ROLES.SEER]: 'divine',
      [ROLES.KNIGHT]: 'protect'
    };
    return actions[role];
  }

  // CPUの投票判断
  makeVoteDecision(cpuPlayer) {
    const alivePlayers = this.gameRoom.getAlivePlayers().filter(p => p.id !== cpuPlayer.id);
    
    if (alivePlayers.length === 0) return null;

    // 役職によって投票戦略を変える
    if (cpuPlayer.role === ROLES.WEREWOLF) {
      // 人狼は村人陣営を狙う
      const targets = alivePlayers.filter(p => p.role !== ROLES.WEREWOLF);
      if (targets.length > 0) {
        // 重要な役職を優先的に狙う
        const seer = targets.find(p => p.role === ROLES.SEER);
        const knight = targets.find(p => p.role === ROLES.KNIGHT);
        
        // 30%の確率で占い師、20%で騎士、50%でランダム
        const rand = Math.random();
        if (rand < 0.3 && seer) return seer.id;
        if (rand < 0.5 && knight) return knight.id;
        return targets[Math.floor(Math.random() * targets.length)].id;
      }
    } else {
      // 村人陣営はランダムに投票（簡易版）
      // 実際には疑わしいプレイヤーを選ぶロジックを実装可能
      const rand = Math.random();
      
      // 70%の確率で人狼を見抜けない
      if (rand < 0.7) {
        return alivePlayers[Math.floor(Math.random() * alivePlayers.length)].id;
      } else {
        // 30%の確率で人狼を当てる
        const werewolves = alivePlayers.filter(p => p.role === ROLES.WEREWOLF);
        if (werewolves.length > 0) {
          return werewolves[Math.floor(Math.random() * werewolves.length)].id;
        }
        return alivePlayers[Math.floor(Math.random() * alivePlayers.length)].id;
      }
    }

    return alivePlayers[Math.floor(Math.random() * alivePlayers.length)].id;
  }

  // CPUの夜アクション判断
  makeNightActionDecision(cpuPlayer) {
    const alivePlayers = this.gameRoom.getAlivePlayers().filter(p => p.id !== cpuPlayer.id);
    
    if (alivePlayers.length === 0) return null;

    switch (cpuPlayer.role) {
      case ROLES.WEREWOLF:
        // 人狼は村人陣営を襲撃
        const villagerTargets = alivePlayers.filter(p => p.role !== ROLES.WEREWOLF);
        if (villagerTargets.length > 0) {
          // 占い師や騎士を優先的に襲撃
          const seer = villagerTargets.find(p => p.role === ROLES.SEER);
          const knight = villagerTargets.find(p => p.role === ROLES.KNIGHT);
          
          const rand = Math.random();
          if (rand < 0.4 && seer) {
            return { action: 'attack', targetId: seer.id };
          }
          if (rand < 0.7 && knight) {
            return { action: 'attack', targetId: knight.id };
          }
          return { 
            action: 'attack', 
            targetId: villagerTargets[Math.floor(Math.random() * villagerTargets.length)].id 
          };
        }
        break;

      case ROLES.SEER:
        // 占い師はランダムに占う
        // より高度なAIでは疑わしいプレイヤーを選ぶ
        return { 
          action: 'divine', 
          targetId: alivePlayers[Math.floor(Math.random() * alivePlayers.length)].id 
        };

      case ROLES.KNIGHT:
        // 騎士は重要な役職を守る（占い師がいる場合は優先）
        // 実際のゲームではCOした占い師を守るなどの戦略が可能
        const importantPlayers = alivePlayers.filter(p => 
          p.role === ROLES.SEER || p.role === ROLES.KNIGHT
        );
        
        if (importantPlayers.length > 0) {
          return { 
            action: 'protect', 
            targetId: importantPlayers[Math.floor(Math.random() * importantPlayers.length)].id 
          };
        }
        
        // ランダムに守る
        return { 
          action: 'protect', 
          targetId: alivePlayers[Math.floor(Math.random() * alivePlayers.length)].id 
        };

      default:
        return null;
    }

    return null;
  }

  // CPU発言生成（簡易版）
  generateStatement(cpuPlayer, phase) {
    const statements = {
      day_discussion: [
        '怪しい人がいるような...',
        '誰が人狼だろう？',
        '情報を整理しましょう',
        '占い結果はありますか？',
        '騎士の護衛先は？'
      ],
      voting: [
        '投票します',
        '悩みますが...',
        '決めました'
      ]
    };

    const phaseStatements = statements[phase] || ['...'];
    return phaseStatements[Math.floor(Math.random() * phaseStatements.length)];
  }

  // Gemini AIを使った発言生成
  async generateStatementWithAI(cpuPlayer, phase) {
    try {
      const context = {
        cpuPlayer,
        phase,
        day: this.gameRoom.day,
        gameHistory: this.gameRoom.history,
        alivePlayers: this.gameRoom.getAlivePlayers()
      };

      const message = await geminiAI.generateChatMessage(context);
      return message || this.generateStatement(cpuPlayer, phase);
    } catch (error) {
      console.error('AI statement generation error:', error);
      return this.generateStatement(cpuPlayer, phase);
    }
  }
}

// CPUの自動アクション実行
async function executeCPUActions(gameRoom, io) {
  const cpuPlayers = [...gameRoom.cpuPlayers.values()].filter(p => p.isAlive);
  const cpuAI = new CPUPlayer(gameRoom);

  for (const cpu of cpuPlayers) {
    // ランダムな遅延を追加（人間らしさの演出）
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

    if (gameRoom.phase === PHASES.VOTING) {
      // Gemini AIを使用（利用可能な場合）
      const targetId = geminiAI.isInitialized() 
        ? await cpuAI.makeVoteDecisionWithAI(cpu)
        : cpuAI.makeVoteDecision(cpu);
      
      if (targetId) {
        gameRoom.castVote(cpu.id, targetId);
        io.to(gameRoom.roomId).emit('vote-cast', {
          voterId: cpu.id,
          voterName: cpu.name
        });
      }
    } else if (gameRoom.phase === PHASES.NIGHT) {
      // Gemini AIを使用（利用可能な場合）
      const action = geminiAI.isInitialized()
        ? await cpuAI.makeNightActionDecisionWithAI(cpu)
        : cpuAI.makeNightActionDecision(cpu);
      
      if (action) {
        gameRoom.submitNightAction(cpu.id, action.action, action.targetId);
      }
    }
  }
}

// CPUの発言を定期的に生成
function startCPUChat(gameRoom, io) {
  const cpuAI = new CPUPlayer(gameRoom);
  
  const interval = setInterval(() => {
    if (gameRoom.phase === PHASES.GAME_OVER || gameRoom.phase === PHASES.WAITING) {
      clearInterval(interval);
      return;
    }

    const aliveCPUs = [...gameRoom.cpuPlayers.values()].filter(p => p.isAlive);
    if (aliveCPUs.length === 0) {
      clearInterval(interval);
      return;
    }

    // ランダムにCPUを選んで発言させる
    if (Math.random() < 0.3) { // 30%の確率で発言
      const cpu = aliveCPUs[Math.floor(Math.random() * aliveCPUs.length)];
      
      // Gemini AIを使用（利用可能な場合）
      if (geminiAI.isInitialized()) {
        cpuAI.generateStatementWithAI(cpu, gameRoom.phase).then(statement => {
          io.to(gameRoom.roomId).emit('chat-message', {
            playerId: cpu.id,
            playerName: cpu.name,
            message: statement,
            isCPU: true
          });
        }).catch(error => {
          console.error('AI chat error:', error);
          const statement = cpuAI.generateStatement(cpu, gameRoom.phase);
          io.to(gameRoom.roomId).emit('chat-message', {
            playerId: cpu.id,
            playerName: cpu.name,
            message: statement,
            isCPU: true
          });
        });
      } else {
        const statement = cpuAI.generateStatement(cpu, gameRoom.phase);
        io.to(gameRoom.roomId).emit('chat-message', {
          playerId: cpu.id,
          playerName: cpu.name,
          message: statement,
          isCPU: true
        });
      }
    }
  }, 5000); // 5秒ごとにチェック

  return interval;
}

module.exports = { CPUPlayer, executeCPUActions, startCPUChat };
