import { io } from 'socket.io-client';

// Cloudflare経由の場合は相対パス、それ以外は直接接続
const SOCKET_URL = window.location.origin.includes('trycloudflare.com')
  ? window.location.origin  // Cloudflare経由: プロキシを使用
  : (import.meta.env.VITE_SOCKET_URL || 'http://localhost:4096');

export const socket = io(SOCKET_URL, {
  autoConnect: false,
  transports: ['websocket', 'polling']
});

export const connectSocket = () => {
  if (!socket.connected) {
    socket.connect();
  }
};

export const disconnectSocket = () => {
  if (socket.connected) {
    socket.disconnect();
  }
};
