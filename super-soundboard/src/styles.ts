export const styles = `
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Noto Sans JP', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  min-height: 100vh;
  color: #e4e6eb;
}

#app {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

/* Header */
.header {
  text-align: center;
  margin-bottom: 30px;
  animation: fadeInDown 0.5s ease;
}

.header h1 {
  font-size: 2.5rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 10px;
}

.header p {
  color: #b0b3b8;
  font-size: 1rem;
}

/* Main Controls */
.main-controls {
  display: flex;
  justify-content: center;
  gap: 20px;
  margin-bottom: 30px;
}

.mic-button {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  font-size: 3rem;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.mic-button.inactive {
  background: linear-gradient(135deg, #4a4e69 0%, #22223b 100%);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
}

.mic-button.active {
  background: linear-gradient(135deg, #f72585 0%, #7209b7 100%);
  box-shadow: 0 10px 40px rgba(247, 37, 133, 0.4);
  animation: pulse 1.5s infinite;
}

.mic-button:hover {
  transform: scale(1.05);
}

.mic-button:active {
  transform: scale(0.95);
}

@keyframes pulse {
  0%, 100% {
    box-shadow: 0 10px 40px rgba(247, 37, 133, 0.4);
  }
  50% {
    box-shadow: 0 10px 60px rgba(247, 37, 133, 0.6);
  }
}

/* Status */
.status {
  text-align: center;
  margin-bottom: 30px;
  font-size: 1.1rem;
}

.status.listening {
  color: #4cc9f0;
}

.status.idle {
  color: #b0b3b8;
}

/* Transcript Display */
.transcript-container {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 30px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.transcript-container h3 {
  color: #4cc9f0;
  margin-bottom: 15px;
  font-size: 1rem;
  display: flex;
  align-items: center;
  gap: 8px;
}

.transcript-text {
  min-height: 60px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 12px;
  padding: 15px;
  font-size: 1.1rem;
  line-height: 1.6;
}

.transcript-text .final {
  color: #e4e6eb;
}

.transcript-text .interim {
  color: #b0b3b8;
  font-style: italic;
}

/* Sound Board Grid */
.soundboard-container {
  margin-bottom: 30px;
}

.soundboard-container h3 {
  color: #4cc9f0;
  margin-bottom: 15px;
  font-size: 1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.soundboard-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 15px;
}

.sound-card {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  padding: 15px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
  border: 1px solid rgba(255, 255, 255, 0.1);
  position: relative;
}

.sound-card:hover {
  background: rgba(255, 255, 255, 0.1);
  transform: translateY(-3px);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
}

.sound-card.disabled {
  opacity: 0.5;
}

.sound-card.custom {
  border-color: rgba(102, 126, 234, 0.5);
}

.sound-card .emoji {
  font-size: 2.5rem;
  margin-bottom: 10px;
}

.sound-card .name {
  font-size: 0.9rem;
  color: #e4e6eb;
  margin-bottom: 5px;
}

.sound-card .keywords {
  font-size: 0.7rem;
  color: #b0b3b8;
}

.sound-card .card-actions {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  gap: 4px;
}

.sound-card .toggle,
.sound-card .delete-btn {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  font-size: 0.8rem;
  background: rgba(0, 0, 0, 0.3);
  color: #e4e6eb;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sound-card .toggle:hover {
  background: rgba(76, 201, 240, 0.5);
}

.sound-card .delete-btn:hover {
  background: rgba(247, 37, 133, 0.5);
}

/* Add Sound Button */
.add-sound-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  padding: 8px 16px;
  border-radius: 8px;
  color: white;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 6px;
}

.add-sound-btn:hover {
  transform: scale(1.05);
  box-shadow: 0 5px 20px rgba(102, 126, 234, 0.4);
}

/* Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.2s ease;
}

.modal {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  border-radius: 16px;
  padding: 30px;
  max-width: 500px;
  width: 90%;
  border: 1px solid rgba(255, 255, 255, 0.1);
  animation: slideUp 0.3s ease;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.modal h2 {
  color: #4cc9f0;
  margin-bottom: 20px;
  font-size: 1.3rem;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  color: #b0b3b8;
  font-size: 0.9rem;
}

.form-group input[type="text"],
.form-group input[type="file"] {
  width: 100%;
  padding: 12px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(0, 0, 0, 0.3);
  color: #e4e6eb;
  font-size: 1rem;
}

.form-group input[type="text"]:focus {
  outline: none;
  border-color: #667eea;
}

.form-group input[type="file"] {
  cursor: pointer;
}

.form-group input[type="file"]::file-selector-button {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  color: white;
  cursor: pointer;
  margin-right: 10px;
}

.emoji-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.emoji-picker button {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  border: 2px solid transparent;
  background: rgba(0, 0, 0, 0.3);
  font-size: 1.3rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.emoji-picker button:hover {
  background: rgba(255, 255, 255, 0.1);
}

.emoji-picker button.selected {
  border-color: #667eea;
  background: rgba(102, 126, 234, 0.2);
}

.modal-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 25px;
}

.btn-cancel {
  background: rgba(255, 255, 255, 0.1);
  border: none;
  padding: 10px 20px;
  border-radius: 8px;
  color: #e4e6eb;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-cancel:hover {
  background: rgba(255, 255, 255, 0.2);
}

.btn-save {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  padding: 10px 20px;
  border-radius: 8px;
  color: white;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-save:hover {
  transform: scale(1.05);
}

.btn-save:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

/* History */
.history-container {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  padding: 20px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.history-container h3 {
  color: #4cc9f0;
  margin-bottom: 15px;
  font-size: 1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.history-container h3 button {
  background: rgba(247, 37, 133, 0.3);
  border: none;
  padding: 5px 12px;
  border-radius: 8px;
  color: #e4e6eb;
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.history-container h3 button:hover {
  background: rgba(247, 37, 133, 0.5);
}

.history-list {
  max-height: 300px;
  overflow-y: auto;
}

.history-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  margin-bottom: 8px;
}

.history-item:last-child {
  margin-bottom: 0;
}

.history-item .time {
  color: #b0b3b8;
  font-size: 0.8rem;
  min-width: 60px;
}

.history-item .keyword {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 0.85rem;
}

.history-item .sound-name {
  color: #4cc9f0;
  font-size: 0.85rem;
}

.history-empty {
  text-align: center;
  color: #b0b3b8;
  padding: 30px;
}

/* Error */
.error-message {
  background: rgba(247, 37, 133, 0.2);
  border: 1px solid rgba(247, 37, 133, 0.5);
  border-radius: 12px;
  padding: 15px;
  text-align: center;
  color: #f72585;
  margin-bottom: 20px;
}

/* Animations */
@keyframes fadeInDown {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.sound-card.playing {
  animation: soundPlaying 0.5s ease;
}

@keyframes soundPlaying {
  0%, 100% {
    transform: scale(1);
    box-shadow: none;
  }
  50% {
    transform: scale(1.1);
    box-shadow: 0 0 30px rgba(76, 201, 240, 0.5);
  }
}

/* Scrollbar */
::-webkit-scrollbar {
  width: 8px;
}

::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb {
  background: rgba(102, 126, 234, 0.5);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(102, 126, 234, 0.7);
}

/* Discord Bar */
.discord-bar {
  background: rgba(88, 101, 242, 0.2);
  border: 1px solid rgba(88, 101, 242, 0.3);
  border-radius: 12px;
  padding: 12px 20px;
  margin-bottom: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: all 0.3s ease;
}

.discord-bar.connected {
  background: rgba(87, 242, 135, 0.2);
  border-color: rgba(87, 242, 135, 0.3);
}

.discord-status {
  display: flex;
  align-items: center;
  gap: 10px;
}

.discord-icon {
  font-size: 1.5rem;
}

.discord-btn {
  background: linear-gradient(135deg, #5865F2 0%, #7289DA 100%);
  border: none;
  padding: 8px 16px;
  border-radius: 8px;
  color: white;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.discord-btn:hover {
  transform: scale(1.05);
  box-shadow: 0 5px 20px rgba(88, 101, 242, 0.4);
}

/* Discord Modal */
.discord-modal {
  max-width: 450px;
}

.discord-modal small {
  color: #888;
  font-size: 0.75rem;
  display: block;
  margin-top: 5px;
}

.form-group select {
  width: 100%;
  padding: 12px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(0, 0, 0, 0.3);
  color: #e4e6eb;
  font-size: 1rem;
  cursor: pointer;
}

.form-group select:focus {
  outline: none;
  border-color: #667eea;
}

.form-group select option {
  background: #1a1a2e;
  color: #e4e6eb;
}

.btn-primary {
  background: linear-gradient(135deg, #5865F2 0%, #7289DA 100%);
  border: none;
  padding: 10px 20px;
  border-radius: 8px;
  color: white;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-right: 10px;
}

.btn-primary:hover {
  transform: scale(1.05);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.btn-danger {
  background: linear-gradient(135deg, #f72585 0%, #b5179e 100%);
  border: none;
  padding: 10px 20px;
  border-radius: 8px;
  color: white;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-danger:hover {
  transform: scale(1.05);
}

.divider {
  border: none;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  margin: 20px 0;
}

/* Responsive */
@media (max-width: 768px) {
  .header h1 {
    font-size: 1.8rem;
  }
  
  .mic-button {
    width: 100px;
    height: 100px;
    font-size: 2.5rem;
  }
  
  .soundboard-grid {
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  }
  
  .modal {
    padding: 20px;
  }
  
  .discord-bar {
    flex-direction: column;
    gap: 10px;
    text-align: center;
  }
}
`;
