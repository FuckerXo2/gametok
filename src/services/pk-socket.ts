import { io, Socket } from 'socket.io-client';
import { API_URL } from './api';

class PkSocketService {
  private socket: Socket | null = null;
  private matchId: number | null = null;

  connect() {
    if (this.socket?.connected) return;

    this.socket = io(API_URL.replace('/api', ''), {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    });

    this.socket.on('connect', () => {
      console.log('PK Socket connected');
    });

    this.socket.on('disconnect', () => {
      console.log('PK Socket disconnected');
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  joinMatch(matchId: number, userId: number) {
    this.matchId = matchId;
    this.socket?.emit('pk:join', { matchId, userId });
  }

  leaveMatch() {
    if (this.matchId) {
      this.socket?.emit('pk:leave', { matchId: this.matchId });
      this.matchId = null;
    }
  }

  setReady(matchId: number, userId: number) {
    this.socket?.emit('pk:ready', { matchId, userId });
  }

  updateScore(matchId: number, userId: number, score: number) {
    this.socket?.emit('pk:score', { matchId, userId, score });
  }

  gameOver(matchId: number, userId: number, finalScore: number) {
    this.socket?.emit('pk:game_over', { matchId, userId, finalScore });
  }

  sendChat(matchId: number, userId: number, message: string) {
    this.socket?.emit('pk:chat', { matchId, userId, message });
  }

  // Event listeners
  onPlayerJoined(callback: (data: { userId: number }) => void) {
    this.socket?.on('pk:player_joined', callback);
  }

  onPlayerReady(callback: (data: { userId: number }) => void) {
    this.socket?.on('pk:player_ready', callback);
  }

  onCountdownStart(callback: (data: { seconds: number }) => void) {
    this.socket?.on('pk:countdown_start', callback);
  }

  onGameStart(callback: () => void) {
    this.socket?.on('pk:game_start', callback);
  }

  onScoreUpdate(callback: (data: { userId: number; score: number }) => void) {
    this.socket?.on('pk:score_update', callback);
  }

  onMatchEnd(callback: (data: { winnerId: number; scores: any[]; rewards: any[] }) => void) {
    this.socket?.on('pk:match_end', callback);
  }

  onChatMessage(callback: (data: { userId: number; message: string; timestamp: number }) => void) {
    this.socket?.on('pk:chat_message', callback);
  }

  onPlayerLeft(callback: (data: { userId: number }) => void) {
    this.socket?.on('pk:player_left', callback);
  }

  // Cleanup
  removeAllListeners() {
    this.socket?.removeAllListeners();
  }
}

export const pkSocket = new PkSocketService();
