import { io } from 'socket.io-client';

// Cloudflare経由の場合は相対パス、それ以外は直接接続
const SOCKET_URL = window.location.origin.includes('trycloudflare.com')
  ? window.location.origin  // Cloudflare経由: プロキシを使用
  : (import.meta.env.VITE_SOCKET_URL || 'http://localhost:4096');

console.log('Socket.IO connecting to:', SOCKET_URL);

export const socket = io(SOCKET_URL, {
  autoConnect: false,
  transports: ['websocket', 'polling'],
  path: '/socket.io/',
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionAttempts: 5
});

// デバッグ用イベントリスナー
socket.on('connect', () => {
  console.log('✅ Socket.IO connected:', socket.id);
});

socket.on('disconnect', (reason) => {
  console.log('❌ Socket.IO disconnected:', reason);
});

socket.on('connect_error', (error) => {
  console.error('❌ Socket.IO connection error:', error);
});

export const connectSocket = () => {
  if (!socket.connected) {
    console.log('🔌 Connecting socket...');
    socket.connect();
  }
};

export const disconnectSocket = () => {
  if (socket.connected) {
    console.log('🔌 Disconnecting socket...');
    socket.disconnect();
  }
};
