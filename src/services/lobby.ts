/**
 * Game Lobby Service
 * 
 * Real-time socket connection for game lobbies:
 * - See who's online in each game lobby
 * - Challenge any player directly
 * - Accept/decline incoming challenges
 * - Auto-find opponents
 */

import { io, Socket } from 'socket.io-client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { API_URL } from './api';

const LOBBY_URL = API_URL.replace('/api', '');

export interface LobbyPlayer {
    id: string;
    username: string;
    displayName?: string;
    avatar?: string;
}

export interface IncomingChallenge {
    challengeId: string;
    from: LobbyPlayer;
    gameId: string;
    gameName: string;
}

export interface MatchReady {
    matchId: string;
    gameId: string;
    gameName: string;
    matchType: string;
    opponent: LobbyPlayer;
}

class LobbyService {
    private socket: Socket | null = null;
    private authenticated = false;
    private listeners: Map<string, Set<(...args: any[]) => void>> = new Map();

    connect(token: string): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.socket?.connected && this.authenticated) {
                resolve();
                return;
            }

            // Disconnect old socket if exists
            if (this.socket) {
                this.socket.disconnect();
            }

            this.socket = io(LOBBY_URL, {
                path: '/lobby',
                transports: ['websocket', 'polling'],
                autoConnect: true,
                reconnection: true,
                reconnectionDelay: 2000,
                reconnectionAttempts: 10,
            });

            this.socket.on('connect', () => {
                console.log('[Lobby] Socket connected');
                this.socket?.emit('lobby:auth', { token });
            });

            this.socket.on('lobby:authenticated', (data) => {
                console.log('[Lobby] Authenticated, online:', data.onlineCount);
                this.authenticated = true;
                resolve();
            });

            this.socket.on('connect_error', (err) => {
                console.log('[Lobby] Connection error:', err.message);
                if (!this.authenticated) reject(err);
            });

            this.socket.on('disconnect', (reason) => {
                console.log('[Lobby] Disconnected:', reason);
                this.authenticated = false;
            });

            // Forward all lobby events to listeners
            const events = [
                'lobby:game_joined',
                'lobby:player_joined',
                'lobby:player_left',
                'lobby:challenge_received',
                'lobby:challenge_sent',
                'lobby:challenge_declined',
                'lobby:challenge_cancelled',
                'lobby:challenge_expired',
                'lobby:match_ready',
                'lobby:no_opponents',
                'lobby:auto_challenging',
                'lobby:error',
                'lobby:kicked',
            ];

            events.forEach(event => {
                this.socket?.on(event, (data) => {
                    this.emit(event, data);
                });
            });

            setTimeout(() => {
                if (!this.authenticated) {
                    reject(new Error('Lobby connection timeout'));
                }
            }, 15000);
        });
    }

    disconnect() {
        this.socket?.disconnect();
        this.socket = null;
        this.authenticated = false;
    }

    isConnected(): boolean {
        return this.authenticated && this.socket?.connected === true;
    }

    // Join a specific game's lobby
    joinGameLobby(gameId: string) {
        this.socket?.emit('lobby:join_game', { gameId });
    }

    // Leave current game lobby
    leaveGameLobby() {
        this.socket?.emit('lobby:leave_game');
    }

    // Challenge a specific player
    challengePlayer(targetUserId: string, gameId: string, gameName: string) {
        this.socket?.emit('lobby:challenge', { targetUserId, gameId, gameName });
    }

    // Accept an incoming challenge
    acceptChallenge(challengeId: string) {
        this.socket?.emit('lobby:challenge_accept', { challengeId });
    }

    // Decline an incoming challenge
    declineChallenge(challengeId: string) {
        this.socket?.emit('lobby:challenge_decline', { challengeId });
    }

    // Cancel a sent challenge
    cancelChallenge(challengeId: string) {
        this.socket?.emit('lobby:challenge_cancel', { challengeId });
    }

    // Auto-find an opponent in the lobby
    findAnyone(gameId: string, gameName: string) {
        this.socket?.emit('lobby:find_anyone', { gameId, gameName });
    }

    // Event system
    on(event: string, callback: (...args: any[]) => void) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event)?.add(callback);
    }

    off(event: string, callback: (...args: any[]) => void) {
        this.listeners.get(event)?.delete(callback);
    }

    private emit(event: string, data: any) {
        this.listeners.get(event)?.forEach(cb => cb(data));
    }
}

// Singleton
export const lobbyService = new LobbyService();

/**
 * React hook for the game lobby
 */
export function useGameLobby(token: string | null, gameId: string | null, gameName: string) {
    const [connected, setConnected] = useState(false);
    const [players, setPlayers] = useState<LobbyPlayer[]>([]);
    const [playerCount, setPlayerCount] = useState(0);
    const [incomingChallenge, setIncomingChallenge] = useState<IncomingChallenge | null>(null);
    const [sentChallenge, setSentChallenge] = useState<{ challengeId: string; to: LobbyPlayer } | null>(null);
    const [matchReady, setMatchReady] = useState<MatchReady | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [finding, setFinding] = useState(false);

    // Connect to lobby
    useEffect(() => {
        if (!token) return;

        lobbyService.connect(token)
            .then(() => setConnected(true))
            .catch(err => {
                console.log('[Lobby Hook] Connection error:', err.message);
                setError('Could not connect to lobby');
            });

        return () => {
            // Don't disconnect - keep connection alive across lobbies
        };
    }, [token]);

    // Join/leave game lobby
    useEffect(() => {
        if (!connected || !gameId) return;

        lobbyService.joinGameLobby(gameId);

        return () => {
            lobbyService.leaveGameLobby();
            setPlayers([]);
            setPlayerCount(0);
            setSentChallenge(null);
            setIncomingChallenge(null);
        };
    }, [connected, gameId]);

    // Subscribe to lobby events
    useEffect(() => {
        if (!connected) return;

        const onGameJoined = (data: { players: LobbyPlayer[]; playerCount: number }) => {
            setPlayers(data.players);
            setPlayerCount(data.playerCount);
        };

        const onPlayerJoined = (data: LobbyPlayer & { playerCount: number }) => {
            setPlayers(prev => {
                // Don't add duplicates
                if (prev.find(p => p.id === data.id)) return prev;
                return [...prev, { id: data.id, username: data.username, displayName: data.displayName, avatar: data.avatar }];
            });
            setPlayerCount(data.playerCount);
        };

        const onPlayerLeft = (data: { userId: string; playerCount: number }) => {
            setPlayers(prev => prev.filter(p => p.id !== data.userId));
            setPlayerCount(data.playerCount);
        };

        const onChallengeReceived = (data: IncomingChallenge) => {
            setIncomingChallenge(data);
        };

        const onChallengeSent = (data: { challengeId: string; to: LobbyPlayer }) => {
            setSentChallenge(data);
            setFinding(false);
        };

        const onChallengeDeclined = (data: { challengeId: string }) => {
            if (sentChallenge?.challengeId === data.challengeId) {
                setSentChallenge(null);
                setError('Challenge declined');
                setTimeout(() => setError(null), 3000);
            }
        };

        const onChallengeCancelled = (data: { challengeId: string }) => {
            if (incomingChallenge?.challengeId === data.challengeId) {
                setIncomingChallenge(null);
            }
        };

        const onChallengeExpired = (data: { challengeId: string }) => {
            if (sentChallenge?.challengeId === data.challengeId) {
                setSentChallenge(null);
                setError('Challenge expired');
                setTimeout(() => setError(null), 3000);
            }
            if (incomingChallenge?.challengeId === data.challengeId) {
                setIncomingChallenge(null);
            }
        };

        const onMatchReady = (data: MatchReady) => {
            setMatchReady(data);
            setSentChallenge(null);
            setIncomingChallenge(null);
        };

        const onNoOpponents = () => {
            setFinding(false);
            setError('No opponents available right now');
            setTimeout(() => setError(null), 3000);
        };

        const onError = (data: { message: string }) => {
            setError(data.message);
            setFinding(false);
            setTimeout(() => setError(null), 5000);
        };

        lobbyService.on('lobby:game_joined', onGameJoined);
        lobbyService.on('lobby:player_joined', onPlayerJoined);
        lobbyService.on('lobby:player_left', onPlayerLeft);
        lobbyService.on('lobby:challenge_received', onChallengeReceived);
        lobbyService.on('lobby:challenge_sent', onChallengeSent);
        lobbyService.on('lobby:challenge_declined', onChallengeDeclined);
        lobbyService.on('lobby:challenge_cancelled', onChallengeCancelled);
        lobbyService.on('lobby:challenge_expired', onChallengeExpired);
        lobbyService.on('lobby:match_ready', onMatchReady);
        lobbyService.on('lobby:no_opponents', onNoOpponents);
        lobbyService.on('lobby:error', onError);

        return () => {
            lobbyService.off('lobby:game_joined', onGameJoined);
            lobbyService.off('lobby:player_joined', onPlayerJoined);
            lobbyService.off('lobby:player_left', onPlayerLeft);
            lobbyService.off('lobby:challenge_received', onChallengeReceived);
            lobbyService.off('lobby:challenge_sent', onChallengeSent);
            lobbyService.off('lobby:challenge_declined', onChallengeDeclined);
            lobbyService.off('lobby:challenge_cancelled', onChallengeCancelled);
            lobbyService.off('lobby:challenge_expired', onChallengeExpired);
            lobbyService.off('lobby:match_ready', onMatchReady);
            lobbyService.off('lobby:no_opponents', onNoOpponents);
            lobbyService.off('lobby:error', onError);
        };
    }, [connected, sentChallenge, incomingChallenge]);

    const challengePlayer = useCallback((targetUserId: string) => {
        if (!gameId) return;
        lobbyService.challengePlayer(targetUserId, gameId, gameName);
    }, [gameId, gameName]);

    const acceptChallenge = useCallback((challengeId: string) => {
        lobbyService.acceptChallenge(challengeId);
        setIncomingChallenge(null);
    }, []);

    const declineChallenge = useCallback((challengeId: string) => {
        lobbyService.declineChallenge(challengeId);
        setIncomingChallenge(null);
    }, []);

    const cancelChallenge = useCallback(() => {
        if (sentChallenge) {
            lobbyService.cancelChallenge(sentChallenge.challengeId);
            setSentChallenge(null);
        }
    }, [sentChallenge]);

    const findAnyone = useCallback(() => {
        if (!gameId) return;
        setFinding(true);
        lobbyService.findAnyone(gameId, gameName);
    }, [gameId, gameName]);

    const clearMatch = useCallback(() => {
        setMatchReady(null);
    }, []);

    return {
        connected,
        players,
        playerCount,
        incomingChallenge,
        sentChallenge,
        matchReady,
        error,
        finding,
        challengePlayer,
        acceptChallenge,
        declineChallenge,
        cancelChallenge,
        findAnyone,
        clearMatch,
    };
}
