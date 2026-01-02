// Multiplayer Service - Socket.io client for real-time gaming
import { io, Socket } from 'socket.io-client';
import { API_URL } from './api';

// WebSocket URL (same as API but for socket connection)
const WS_URL = API_URL.replace('/api', '').replace('http', 'ws').replace('https', 'wss');

export interface Player {
  id: string;
  ready: boolean;
}

export interface Room {
  id: string;
  gameId: string;
  hostId: string;
  players: Player[];
  state: 'waiting' | 'playing' | 'finished';
  isPrivate: boolean;
  maxPlayers: number;
}

export interface GameState {
  board?: any;
  symbols?: Record<string, string>;
  currentTurn?: string;
  scores?: Record<string, number>;
  [key: string]: any;
}

type EventCallback = (...args: any[]) => void;

class MultiplayerService {
  private socket: Socket | null = null;
  private userId: string | null = null;
  private listeners: Map<string, Set<EventCallback>> = new Map();
  private connected: boolean = false;

  // Connect to the multiplayer server
  connect(userId: string, token: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.socket?.connected) {
        resolve();
        return;
      }

      // Use HTTP URL for socket.io (it handles upgrade to WS)
      const httpUrl = API_URL.replace('/api', '');
      
      this.socket = io(httpUrl, {
        transports: ['websocket', 'polling'],
        autoConnect: true,
      });

      this.socket.on('connect', () => {
        console.log('[MP] Connected to server');
        this.connected = true;
        
        // Authenticate
        this.socket?.emit('auth', { userId, token });
      });

      this.socket.on('auth:success', ({ userId: uid }) => {
        console.log('[MP] Authenticated as', uid);
        this.userId = uid;
        resolve();
      });

      this.socket.on('connect_error', (error) => {
        console.log('[MP] Connection error:', error.message);
        reject(error);
      });

      this.socket.on('disconnect', (reason) => {
        console.log('[MP] Disconnected:', reason);
        this.connected = false;
      });

      this.socket.on('error', ({ message }) => {
        console.log('[MP] Error:', message);
        this.emit('error', { message });
      });

      // Forward all game events to listeners
      const events = [
        'room:created', 'room:playerJoined', 'room:playerLeft', 'room:updated',
        'game:start', 'game:state', 'game:over', 'game:peerUpdate',
        'matchmaking:waiting', 'invite:received',
        'competition:opponentScore', 'competition:opponentFinished',
      ];

      events.forEach(event => {
        this.socket?.on(event, (data) => {
          this.emit(event, data);
        });
      });

      // Timeout for connection
      setTimeout(() => {
        if (!this.connected) {
          reject(new Error('Connection timeout'));
        }
      }, 10000);
    });
  }

  // Disconnect from server
  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
    this.userId = null;
    this.connected = false;
  }

  // Check if connected
  isConnected(): boolean {
    return this.connected && this.socket?.connected === true;
  }

  // Event emitter methods
  on(event: string, callback: EventCallback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)?.add(callback);
  }

  off(event: string, callback: EventCallback) {
    this.listeners.get(event)?.delete(callback);
  }

  private emit(event: string, data: any) {
    this.listeners.get(event)?.forEach(cb => cb(data));
  }

  // ============================================
  // ROOM MANAGEMENT
  // ============================================

  // Create a new game room
  createRoom(gameId: string, isPrivate: boolean = true): void {
    this.socket?.emit('room:create', { gameId, isPrivate });
  }

  // Join an existing room by code
  joinRoom(roomId: string): void {
    this.socket?.emit('room:join', { roomId });
  }

  // Leave current room
  leaveRoom(): void {
    this.socket?.emit('room:leave');
  }

  // Toggle ready status
  setReady(ready: boolean): void {
    this.socket?.emit('room:ready', { ready });
  }

  // ============================================
  // GAMEPLAY
  // ============================================

  // Make a move (turn-based games)
  makeMove(move: any): void {
    this.socket?.emit('game:move', { move });
  }

  // Send real-time update (non-turn-based games)
  sendUpdate(state: any): void {
    this.socket?.emit('game:update', { state });
  }

  // ============================================
  // MATCHMAKING
  // ============================================

  // Find a random opponent
  findMatch(gameId: string): void {
    this.socket?.emit('matchmaking:find', { gameId });
  }

  // Cancel matchmaking
  cancelMatchmaking(): void {
    this.socket?.emit('matchmaking:cancel');
  }

  // ============================================
  // INVITES
  // ============================================

  // Send game invite to a friend
  sendInvite(friendId: string, gameId: string): void {
    this.socket?.emit('invite:send', { friendId, gameId });
  }

  // ============================================
  // SCORE COMPETITION
  // ============================================

  // Update score during score competition
  updateCompetitionScore(score: number): void {
    this.socket?.emit('competition:score', { score });
  }

  // Signal that player finished their game
  finishCompetition(finalScore: number): void {
    this.socket?.emit('competition:finished', { finalScore });
  }
}

// Singleton instance
export const multiplayer = new MultiplayerService();

// React hook for multiplayer
import { useEffect, useState, useCallback } from 'react';

export interface GameOverData {
  winner: string | null;
  reason: string;
  finalScores?: Record<string, number>;
}

export function useMultiplayer(userId?: string, token?: string) {
  const [connected, setConnected] = useState(false);
  const [room, setRoom] = useState<Room | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [currentTurn, setCurrentTurn] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [opponentScore, setOpponentScore] = useState(0);
  const [opponentFinished, setOpponentFinished] = useState(false);
  const [gameOver, setGameOver] = useState<GameOverData | null>(null);
  const [isScoreCompetition, setIsScoreCompetition] = useState(false);
  const [timeLimit, setTimeLimit] = useState<number | null>(null);

  useEffect(() => {
    if (!userId || !token) return;

    multiplayer.connect(userId, token)
      .then(() => setConnected(true))
      .catch(err => setError(err.message));

    // Room events
    const onRoomCreated = ({ room }: { room: Room }) => setRoom(room);
    const onRoomUpdated = ({ room }: { room: Room }) => setRoom(room);
    const onPlayerJoined = ({ room }: { room: Room }) => setRoom(room);
    const onPlayerLeft = ({ room }: { room: Room }) => setRoom(room);

    // Game events
    const onGameStart = ({ room, gameState, currentTurn, isScoreCompetition: isSC, timeLimit: tl }: any) => {
      setRoom(room);
      setGameState(gameState);
      setCurrentTurn(currentTurn);
      setIsScoreCompetition(isSC || false);
      setTimeLimit(tl || null);
      setOpponentScore(0);
      setOpponentFinished(false);
      setGameOver(null);
    };

    const onGameState = ({ gameState, currentTurn }: any) => {
      setGameState(gameState);
      setCurrentTurn(currentTurn);
    };

    const onGameOverEvent = ({ winner, reason, finalScores }: GameOverData) => {
      setRoom(prev => prev ? { ...prev, state: 'finished' } : null);
      setGameOver({ winner, reason, finalScores });
    };

    // Score competition events
    const onOpponentScore = ({ score }: { score: number }) => {
      setOpponentScore(score);
    };

    const onOpponentFinished = ({ score }: { score: number }) => {
      setOpponentScore(score);
      setOpponentFinished(true);
    };

    const onError = ({ message }: { message: string }) => setError(message);

    // Subscribe to events
    multiplayer.on('room:created', onRoomCreated);
    multiplayer.on('room:updated', onRoomUpdated);
    multiplayer.on('room:playerJoined', onPlayerJoined);
    multiplayer.on('room:playerLeft', onPlayerLeft);
    multiplayer.on('game:start', onGameStart);
    multiplayer.on('game:state', onGameState);
    multiplayer.on('game:over', onGameOverEvent);
    multiplayer.on('competition:opponentScore', onOpponentScore);
    multiplayer.on('competition:opponentFinished', onOpponentFinished);
    multiplayer.on('error', onError);

    return () => {
      multiplayer.off('room:created', onRoomCreated);
      multiplayer.off('room:updated', onRoomUpdated);
      multiplayer.off('room:playerJoined', onPlayerJoined);
      multiplayer.off('room:playerLeft', onPlayerLeft);
      multiplayer.off('game:start', onGameStart);
      multiplayer.off('game:state', onGameState);
      multiplayer.off('game:over', onGameOverEvent);
      multiplayer.off('competition:opponentScore', onOpponentScore);
      multiplayer.off('competition:opponentFinished', onOpponentFinished);
      multiplayer.off('error', onError);
    };
  }, [userId, token]);

  const createRoom = useCallback((gameId: string, isPrivate = true) => {
    multiplayer.createRoom(gameId, isPrivate);
  }, []);

  const joinRoom = useCallback((roomId: string) => {
    multiplayer.joinRoom(roomId);
  }, []);

  const leaveRoom = useCallback(() => {
    multiplayer.leaveRoom();
    setRoom(null);
    setGameState(null);
    setGameOver(null);
    setOpponentScore(0);
    setOpponentFinished(false);
  }, []);

  const setReady = useCallback((ready: boolean) => {
    multiplayer.setReady(ready);
  }, []);

  const makeMove = useCallback((move: any) => {
    multiplayer.makeMove(move);
  }, []);

  const findMatch = useCallback((gameId: string) => {
    multiplayer.findMatch(gameId);
  }, []);

  const updateScore = useCallback((score: number) => {
    multiplayer.updateCompetitionScore(score);
  }, []);

  const finishGame = useCallback((finalScore: number) => {
    multiplayer.finishCompetition(finalScore);
  }, []);

  return {
    connected,
    room,
    gameState,
    currentTurn,
    error,
    opponentScore,
    opponentFinished,
    gameOver,
    isScoreCompetition,
    timeLimit,
    createRoom,
    joinRoom,
    leaveRoom,
    setReady,
    makeMove,
    findMatch,
    updateScore,
    finishGame,
  };
}
