// ========================================
// 東京都AI チャットアプリケーション
// ========================================

class TokyoAIChat {
    constructor() {
        // API設定
        this.apiBaseUrl = window.location.origin;
        this.sessionId = this.generateUUID();
        
        // DOM要素
        this.elements = {
            chatMessages: document.getElementById('chatMessages'),
            messageInput: document.getElementById('messageInput'),
            sendButton: document.getElementById('sendButton'),
            modelSelect: document.getElementById('modelSelect'),
            streamToggle: document.getElementById('streamToggle'),
            clearChat: document.getElementById('clearChat'),
            charCount: document.getElementById('charCount'),
            statusIndicator: document.getElementById('statusIndicator')
        };
        
        // 状態管理
        this.chatHistory = [];
        this.isProcessing = false;
        this.maxChars = 5000;
        
        // 初期化
        this.init();
    }
    
    // ========================================
    // 初期化
    // ========================================
    init() {
        console.log('🚀 東京都AI チャット初期化');
        console.log('📡 Session ID:', this.sessionId);
        
        // イベントリスナー設定
        this.setupEventListeners();
        
        // 設定の読み込み
        this.loadSettings();
        
        // ウェルカムメッセージ表示
        this.displayWelcomeMessage();
        
        // ヘルスチェック
        this.checkHealth();
    }
    
    // ========================================
    // イベントリスナー設定
    // ========================================
    setupEventListeners() {
        // 送信ボタン
        this.elements.sendButton.addEventListener('click', () => this.sendMessage());
        
        // Enterキーで送信（Shift+Enterで改行）
        this.elements.messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        
        // 文字数カウント
        this.elements.messageInput.addEventListener('input', () => {
            this.updateCharCount();
            this.autoResizeTextarea();
        });
        
        // モデル選択
        this.elements.modelSelect.addEventListener('change', () => {
            this.saveSettings();
        });
        
        // ストリーミング切り替え
        this.elements.streamToggle.addEventListener('change', () => {
            this.saveSettings();
        });
        
        // チャットクリア
        this.elements.clearChat.addEventListener('click', () => {
            this.clearChatHistory();
        });
    }
    
    // ========================================
    // メッセージ送信
    // ========================================
    async sendMessage() {
        const message = this.elements.messageInput.value.trim();
        
        if (!message || this.isProcessing) {
            return;
        }
        
        if (message.length > this.maxChars) {
            this.showError(`メッセージは${this.maxChars}文字以内で入力してください`);
            return;
        }
        
        // 処理中フラグ
        this.isProcessing = true;
        this.elements.sendButton.disabled = true;
        this.elements.messageInput.disabled = true;
        
        // ウェルカムメッセージを削除
        this.removeWelcomeMessage();
        
        // ユーザーメッセージ表示
        this.displayMessage('user', message);
        
        // 入力欄クリア
        this.elements.messageInput.value = '';
        this.updateCharCount();
        this.autoResizeTextarea();
        
        // ストリーミングモード判定
        const isStreaming = this.elements.streamToggle.checked;
        const model = this.elements.modelSelect.value;
        
        try {
            if (isStreaming) {
                await this.sendStreamingMessage(message, model);
            } else {
                await this.sendNormalMessage(message, model);
            }
        } catch (error) {
            console.error('メッセージ送信エラー:', error);
            this.showError('メッセージの送信に失敗しました');
        } finally {
            this.isProcessing = false;
            this.elements.sendButton.disabled = false;
            this.elements.messageInput.disabled = false;
            this.elements.messageInput.focus();
        }
    }
    
    // ========================================
    // 通常メッセージ送信
    // ========================================
    async sendNormalMessage(message, model) {
        console.log('📤 通常メッセージ送信:', { message, model });
        
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    sessionId: this.sessionId,
                    message: message,
                    model: model,
                    isStream: false
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'APIエラー');
            }
            
            const data = await response.json();
            console.log('📥 レスポンス受信:', data);
            
            // レスポンスからメッセージを抽出
            let aiMessage = '';
            if (data.message && data.message.content) {
                aiMessage = data.message.content;
            } else if (typeof data === 'string') {
                aiMessage = data;
            } else {
                aiMessage = JSON.stringify(data);
            }
            
            this.displayMessage('assistant', aiMessage);
            
        } catch (error) {
            console.error('通常メッセージ送信エラー:', error);
            throw error;
        }
    }
    
    // ========================================
    // ストリーミングメッセージ送信
    // ========================================
    async sendStreamingMessage(message, model) {
        console.log('📤 ストリーミングメッセージ送信:', { message, model });
        
        // AIメッセージのプレースホルダー作成
        const messageElement = this.createMessageElement('assistant', '');
        messageElement.classList.add('streaming');
        
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/chat/stream`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    sessionId: this.sessionId,
                    message: message,
                    model: model
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'APIエラー');
            }
            
            // Server-Sent Eventsの読み取り
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let fullMessage = '';
            
            while (true) {
                const { done, value } = await reader.read();
                
                if (done) {
                    console.log('✅ ストリーミング完了');
                    break;
                }
                
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6).trim();
                        
                        if (data === '[DONE]') {
                            continue;
                        }
                        
                        try {
                            const parsed = JSON.parse(data);
                            
                            if (parsed.done) {
                                continue;
                            }
                            
                            if (parsed.error) {
                                throw new Error(parsed.error);
                            }
                            
                            // メッセージの差分を抽出
                            if (parsed.message && parsed.message.content) {
                                fullMessage = parsed.message.content;
                            } else if (parsed.content) {
                                fullMessage += parsed.content;
                            } else if (parsed.delta) {
                                fullMessage += parsed.delta;
                            }
                            
                            // メッセージを更新
                            const bubbleElement = messageElement.querySelector('.message-bubble');
                            if (bubbleElement) {
                                bubbleElement.textContent = fullMessage;
                                this.scrollToBottom();
                            }
                            
                        } catch (e) {
                            // JSONパースエラーは無視
                            console.warn('JSONパースエラー:', data);
                        }
                    }
                }
            }
            
            // ストリーミング完了
            messageElement.classList.remove('streaming');
            
            // 最終メッセージが空の場合のフォールバック
            if (!fullMessage) {
                fullMessage = 'レスポンスを受信できませんでした';
            }
            
            console.log('📥 最終メッセージ:', fullMessage);
            
        } catch (error) {
            console.error('ストリーミングメッセージ送信エラー:', error);
            messageElement.classList.remove('streaming');
            const bubbleElement = messageElement.querySelector('.message-bubble');
            if (bubbleElement) {
                bubbleElement.textContent = 'エラーが発生しました: ' + error.message;
                bubbleElement.style.background = 'var(--danger-color)';
                bubbleElement.style.color = 'white';
            }
            throw error;
        }
    }
    
    // ========================================
    // メッセージ表示
    // ========================================
    displayMessage(role, content) {
        const messageElement = this.createMessageElement(role, content);
        this.chatHistory.push({ role, content, timestamp: new Date() });
        this.scrollToBottom();
    }
    
    createMessageElement(role, content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}`;
        
        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.innerHTML = role === 'user' ? '<i class="fas fa-user"></i>' : '<i class="fas fa-robot"></i>';
        
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        
        const bubble = document.createElement('div');
        bubble.className = 'message-bubble';
        bubble.textContent = content;
        
        const timestamp = document.createElement('div');
        timestamp.className = 'message-timestamp';
        timestamp.textContent = this.formatTime(new Date());
        
        messageContent.appendChild(bubble);
        messageContent.appendChild(timestamp);
        
        messageDiv.appendChild(avatar);
        messageDiv.appendChild(messageContent);
        
        this.elements.chatMessages.appendChild(messageDiv);
        
        return messageDiv;
    }
    
    // ========================================
    // ウェルカムメッセージ
    // ========================================
    displayWelcomeMessage() {
        // 既存のウェルカムメッセージがある場合は何もしない
        if (this.elements.chatMessages.querySelector('.welcome-message')) {
            return;
        }
        
        const welcomeDiv = document.createElement('div');
        welcomeDiv.className = 'welcome-message';
        welcomeDiv.innerHTML = `
            <i class="fas fa-comments"></i>
            <h2>東京都AI アシスタントへようこそ</h2>
            <p>何でもお気軽にお尋ねください</p>
        `;
        
        this.elements.chatMessages.appendChild(welcomeDiv);
    }
    
    removeWelcomeMessage() {
        const welcomeMessage = this.elements.chatMessages.querySelector('.welcome-message');
        if (welcomeMessage) {
            welcomeMessage.remove();
        }
    }
    
    // ========================================
    // チャット履歴クリア
    // ========================================
    clearChatHistory() {
        if (!confirm('チャット履歴をクリアしますか？')) {
            return;
        }
        
        this.chatHistory = [];
        this.elements.chatMessages.innerHTML = '';
        this.displayWelcomeMessage();
        
        console.log('🗑️ チャット履歴をクリアしました');
    }
    
    // ========================================
    // ユーティリティ
    // ========================================
    updateCharCount() {
        const length = this.elements.messageInput.value.length;
        this.elements.charCount.textContent = `${length} / ${this.maxChars}`;
        
        if (length > this.maxChars) {
            this.elements.charCount.style.color = 'var(--danger-color)';
        } else {
            this.elements.charCount.style.color = 'var(--gray-400)';
        }
    }
    
    autoResizeTextarea() {
        const textarea = this.elements.messageInput;
        textarea.style.height = 'auto';
        textarea.style.height = textarea.scrollHeight + 'px';
    }
    
    scrollToBottom() {
        this.elements.chatMessages.scrollTop = this.elements.chatMessages.scrollHeight;
    }
    
    formatTime(date) {
        return date.toLocaleTimeString('ja-JP', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }
    
    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
    
    showError(message) {
        // 簡易的なエラー表示
        alert(message);
    }
    
    // ========================================
    // 設定の保存・読み込み
    // ========================================
    saveSettings() {
        const settings = {
            model: this.elements.modelSelect.value,
            streaming: this.elements.streamToggle.checked
        };
        
        localStorage.setItem('tokyoAiChatSettings', JSON.stringify(settings));
        console.log('💾 設定を保存しました:', settings);
    }
    
    loadSettings() {
        const savedSettings = localStorage.getItem('tokyoAiChatSettings');
        
        if (savedSettings) {
            try {
                const settings = JSON.parse(savedSettings);
                
                if (settings.model) {
                    this.elements.modelSelect.value = settings.model;
                }
                
                if (typeof settings.streaming === 'boolean') {
                    this.elements.streamToggle.checked = settings.streaming;
                }
                
                console.log('📂 設定を読み込みました:', settings);
            } catch (error) {
                console.error('設定の読み込みエラー:', error);
            }
        }
    }
    
    // ========================================
    // ヘルスチェック
    // ========================================
    async checkHealth() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/health`);
            const data = await response.json();
            
            console.log('💚 ヘルスチェック:', data);
            
            if (data.status === 'healthy') {
                this.elements.statusIndicator.innerHTML = '<i class="fas fa-circle"></i> オンライン';
                this.elements.statusIndicator.style.color = 'var(--secondary-color)';
            }
        } catch (error) {
            console.error('ヘルスチェックエラー:', error);
            this.elements.statusIndicator.innerHTML = '<i class="fas fa-circle"></i> オフライン';
            this.elements.statusIndicator.style.color = 'var(--danger-color)';
        }
    }
}

// ========================================
// アプリケーション起動
// ========================================
document.addEventListener('DOMContentLoaded', () => {
    window.tokyoAIChat = new TokyoAIChat();
});
