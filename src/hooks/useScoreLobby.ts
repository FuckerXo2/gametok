/**
 * useScoreLobby — connects to the /score-lobby Socket.IO namespace and exposes
 * a live leaderboard for a specific game.
 *
 * Usage:
 *   const { players, isLive, joinError, sendScore } = useScoreLobby(gameId, isActive);
 *   sendScore(currentScore);  // call whenever the local game's score updates
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';

const SOCKET_URL = 'https://gametok-backend-production.up.railway.app';

export interface ScoreLobbyPlayer {
    userId: string;
    score: number;
    displayName: string;
    avatar?: string;
    verified?: boolean;
    lastUpdate: number;
}

export interface UseScoreLobbyResult {
    players: ScoreLobbyPlayer[];
    isLive: boolean;
    joinError: string | null;
    sendScore: (score: number) => void;
}

export function useScoreLobby(gameId: string | null, active: boolean): UseScoreLobbyResult {
    const { user } = useAuth();
    const socketRef = useRef<Socket | null>(null);
    const lastSentScoreRef = useRef<number>(0);
    const [players, setPlayers] = useState<ScoreLobbyPlayer[]>([]);
    const [isLive, setIsLive] = useState(false);
    const [joinError, setJoinError] = useState<string | null>(null);

    useEffect(() => {
        if (!active || !gameId || !user?.id) {
            return;
        }
        let sock: Socket | null = null;
        try {
            sock = io(SOCKET_URL, {
                path: '/score-lobby',
                auth: { userId: user.id },
                transports: ['websocket'],
                reconnection: true,
                reconnectionAttempts: 3,
            });

            sock.on('connect', () => {
                setIsLive(true);
                setJoinError(null);
                sock?.emit('lobby:join', { gameId });
            });

            sock.on('disconnect', () => {
                setIsLive(false);
            });

            sock.on('lobby:joined', ({ snapshot }) => {
                if (snapshot?.players) setPlayers(snapshot.players);
            });

            sock.on('lobby:state', ({ players: next, gameId: gId }: { players: ScoreLobbyPlayer[]; gameId: string }) => {
                if (gId !== gameId) return;
                setPlayers(next || []);
            });

            sock.on('lobby:error', ({ message }: { message: string }) => {
                setJoinError(message);
                setIsLive(false);
            });
        } catch (err) {
            setJoinError((err as Error).message);
        }
        socketRef.current = sock;

        return () => {
            sock?.emit('lobby:leave', { gameId });
            sock?.disconnect();
            socketRef.current = null;
            setIsLive(false);
            setPlayers([]);
            lastSentScoreRef.current = 0;
        };
    }, [active, gameId, user?.id]);

    const sendScore = useCallback(
        (score: number) => {
            if (!gameId) return;
            const sock = socketRef.current;
            if (!sock?.connected) return;
            const numScore = Math.max(0, Math.floor(Number(score) || 0));
            if (numScore <= lastSentScoreRef.current) return;
            lastSentScoreRef.current = numScore;
            sock.emit('lobby:score', { gameId, score: numScore });
        },
        [gameId]
    );

    return { players, isLive, joinError, sendScore };
}
