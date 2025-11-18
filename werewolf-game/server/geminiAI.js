// Gemini AI統合モジュール

const { GoogleGenerativeAI } = require('@google/generative-ai');

class GeminiAI {
  constructor() {
    this.genAI = null;
    this.model = null;
    this.apiKey = null;
  }

  // APIキーを設定
  setApiKey(apiKey) {
    if (!apiKey) {
      throw new Error('API key is required');
    }
    
    this.apiKey = apiKey;
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });
    
    console.log('✅ Gemini API initialized');
  }

  // APIキーが設定されているか確認
  isInitialized() {
    return this.genAI !== null && this.model !== null;
  }

  // CPUプレイヤーの発言を生成
  async generateChatMessage(context) {
    if (!this.isInitialized()) {
      // Gemini APIが設定されていない場合は、デフォルトのメッセージを返す
      return this.getDefaultMessage(context);
    }

    try {
      const prompt = this.buildChatPrompt(context);
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      return text.trim();
    } catch (error) {
      console.error('Gemini API error:', error);
      return this.getDefaultMessage(context);
    }
  }

  // 投票判断をGemini AIに依頼
  async makeVoteDecision(context) {
    if (!this.isInitialized()) {
      return this.getDefaultVoteDecision(context);
    }

    try {
      const prompt = this.buildVotePrompt(context);
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text().trim();
      
      // プレイヤー名を抽出
      const playerNames = context.alivePlayers.map(p => p.name);
      const selectedPlayer = playerNames.find(name => text.includes(name));
      
      if (selectedPlayer) {
        const player = context.alivePlayers.find(p => p.name === selectedPlayer);
        return player ? player.id : null;
      }
      
      return this.getDefaultVoteDecision(context);
    } catch (error) {
      console.error('Gemini API error:', error);
      return this.getDefaultVoteDecision(context);
    }
  }

  // 夜アクション判断をGemini AIに依頼
  async makeNightActionDecision(context) {
    if (!this.isInitialized()) {
      return this.getDefaultNightAction(context);
    }

    try {
      const prompt = this.buildNightActionPrompt(context);
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text().trim();
      
      // プレイヤー名を抽出
      const playerNames = context.alivePlayers.map(p => p.name);
      const selectedPlayer = playerNames.find(name => text.includes(name));
      
      if (selectedPlayer) {
        const player = context.alivePlayers.find(p => p.name === selectedPlayer);
        return player ? player.id : null;
      }
      
      return this.getDefaultNightAction(context);
    } catch (error) {
      console.error('Gemini API error:', error);
      return this.getDefaultNightAction(context);
    }
  }

  // チャットプロンプトの構築
  buildChatPrompt(context) {
    const { cpuPlayer, phase, day, gameHistory, alivePlayers } = context;
    
    let roleDescription = '';
    if (cpuPlayer.role === 'werewolf') {
      roleDescription = 'あなたは人狼です。正体を隠しながら村人を誘導してください。';
    } else if (cpuPlayer.role === 'seer') {
      roleDescription = 'あなたは占い師です。占い結果を元に推理を共有してください。';
    } else if (cpuPlayer.role === 'knight') {
      roleDescription = 'あなたは騎士です。村人を守るために推理してください。';
    } else {
      roleDescription = 'あなたは村人です。人狼を見つけ出してください。';
    }

    const prompt = `
人狼ゲーム中です。あなたは「${cpuPlayer.name}」という${roleDescription}

現在の状況:
- ${day}日目、${phase === 'day_discussion' ? '昼の議論フェーズ' : '投票フェーズ'}
- 生存プレイヤー: ${alivePlayers.map(p => p.name).join(', ')}

ゲーム履歴:
${gameHistory.slice(-3).map(h => h.message).join('\n')}

短い発言（20文字以内）を1つ生成してください。自然で人間らしい発言にしてください。
発言のみを返してください。説明は不要です。
`;

    return prompt;
  }

  // 投票プロンプトの構築
  buildVotePrompt(context) {
    const { cpuPlayer, alivePlayers, gameHistory } = context;
    
    const prompt = `
人狼ゲームの投票フェーズです。あなたは「${cpuPlayer.name}」で、役職は${cpuPlayer.role}です。

生存プレイヤー:
${alivePlayers.map(p => `- ${p.name}`).join('\n')}

ゲーム履歴:
${gameHistory.slice(-5).map(h => h.message).join('\n')}

投票したいプレイヤーの名前を1人だけ答えてください。
名前のみを返してください。説明は不要です。
`;

    return prompt;
  }

  // 夜アクションプロンプトの構築
  buildNightActionPrompt(context) {
    const { cpuPlayer, alivePlayers, role } = context;
    
    let actionDescription = '';
    if (role === 'werewolf') {
      actionDescription = '襲撃する村人を選んでください';
    } else if (role === 'seer') {
      actionDescription = '占う対象を選んでください';
    } else if (role === 'knight') {
      actionDescription = '守る対象を選んでください';
    }

    const prompt = `
人狼ゲームの夜フェーズです。あなたは「${cpuPlayer.name}」で、役職は${role}です。

${actionDescription}

生存プレイヤー:
${alivePlayers.map(p => `- ${p.name}`).join('\n')}

対象のプレイヤー名を1人だけ答えてください。
名前のみを返してください。説明は不要です。
`;

    return prompt;
  }

  // デフォルトのメッセージ（Gemini未設定時）
  getDefaultMessage(context) {
    const messages = [
      '怪しい人がいるような...',
      '誰が人狼だろう？',
      '情報を整理しましょう',
      '占い結果はありますか？',
      '騎士の護衛先は？',
      'この状況は難しいですね',
      '慎重に考えましょう'
    ];
    return messages[Math.floor(Math.random() * messages.length)];
  }

  // デフォルトの投票判断
  getDefaultVoteDecision(context) {
    const { alivePlayers } = context;
    if (alivePlayers.length === 0) return null;
    return alivePlayers[Math.floor(Math.random() * alivePlayers.length)].id;
  }

  // デフォルトの夜アクション
  getDefaultNightAction(context) {
    const { alivePlayers } = context;
    if (alivePlayers.length === 0) return null;
    return alivePlayers[Math.floor(Math.random() * alivePlayers.length)].id;
  }
}

// シングルトンインスタンス
const geminiAI = new GeminiAI();

module.exports = geminiAI;
