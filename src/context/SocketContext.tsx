import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { getToken } from '../services/api';

export type PresenceStatus = 'online' | 'in-game' | 'idle' | 'offline';

interface SocketContextType {
    socket: Socket | null;
    chatSocket: Socket | null;
    presenceSocket: Socket | null;
    isConnected: boolean;
    isChatConnected: boolean;
    isPresenceConnected: boolean;
    onlineUsers: string[];
    typingUsers: Map<string, string>;
    presenceMap: Map<string, PresenceStatus>;
    myStatus: PresenceStatus;
    setMyStatus: (status: PresenceStatus) => void;
    joinConversation: (conversationId: string) => void;
    leaveConversation: (conversationId: string) => void;
    sendTyping: (conversationId: string) => void;
    stopTyping: (conversationId: string) => void;
}

const SocketContext = createContext<SocketContextType>({
    socket: null,
    chatSocket: null,
    presenceSocket: null,
    isConnected: false,
    isChatConnected: false,
    isPresenceConnected: false,
    onlineUsers: [],
    typingUsers: new Map(),
    presenceMap: new Map(),
    myStatus: 'offline',
    setMyStatus: () => {},
    joinConversation: () => {},
    leaveConversation: () => {},
    sendTyping: () => {},
    stopTyping: () => {},
});

export const useSocket = () => useContext(SocketContext);

const SOCKET_URL = 'https://gametok-backend-production.up.railway.app';
const HEARTBEAT_INTERVAL_MS = 25_000;

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [chatSocket, setChatSocket] = useState<Socket | null>(null);
    const [presenceSocket, setPresenceSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [isChatConnected, setIsChatConnected] = useState(false);
    const [isPresenceConnected, setIsPresenceConnected] = useState(false);
    const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
    const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map());
    const [presenceMap, setPresenceMap] = useState<Map<string, PresenceStatus>>(new Map());
    const [myStatus, setMyStatusState] = useState<PresenceStatus>('offline');
    const presenceSocketRef = useRef<Socket | null>(null);
    const myStatusRef = useRef<PresenceStatus>('offline');
    const { isAuthenticated, user } = useAuth();

    const joinConversation = useCallback((conversationId: string) => {
        chatSocket?.emit('chat:join', { conversationId });
    }, [chatSocket]);

    const leaveConversation = useCallback((conversationId: string) => {
        chatSocket?.emit('chat:leave', { conversationId });
    }, [chatSocket]);

    const sendTyping = useCallback((conversationId: string) => {
        chatSocket?.emit('chat:typing', { conversationId });
    }, [chatSocket]);

    const stopTyping = useCallback((conversationId: string) => {
        chatSocket?.emit('chat:typing_stop', { conversationId });
    }, [chatSocket]);

    const setMyStatus = useCallback((status: PresenceStatus) => {
        myStatusRef.current = status;
        setMyStatusState(status);
        const sock = presenceSocketRef.current;
        if (sock?.connected && status !== 'offline') {
            sock.emit('presence:set', { status });
        }
    }, []);

    useEffect(() => {
        let newSocket: Socket | null = null;
        let newChatSocket: Socket | null = null;
        let newPresenceSocket: Socket | null = null;
        let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

        const setupSocket = async () => {
            if (isAuthenticated && user?.id) {
                const token = await getToken();

                newSocket = io(SOCKET_URL, {
                    auth: { token },
                    transports: ['websocket'],
                    reconnection: true,
                    reconnectionAttempts: 5,
                    reconnectionDelay: 1000,
                });

                newSocket.on('connect', () => {
                    console.log('[Socket] Connected:', newSocket?.id);
                    setIsConnected(true);
                    newSocket?.emit('auth', { userId: user.id, token });
                });

                newSocket.on('disconnect', () => {
                    console.log('[Socket] Disconnected');
                    setIsConnected(false);
                });

                newSocket.on('presence:online_users', (userIds: string[]) => {
                    setOnlineUsers(userIds);
                });

                newSocket.on('presence:user_joined', (userId: string) => {
                    setOnlineUsers((prev) => Array.from(new Set([...prev, userId])));
                });

                newSocket.on('presence:user_left', (userId: string) => {
                    setOnlineUsers((prev) => prev.filter((id) => id !== userId));
                });

                setSocket(newSocket);

                newChatSocket = io(SOCKET_URL, {
                    path: '/chat',
                    auth: { token },
                    transports: ['websocket'],
                    reconnection: true,
                    reconnectionAttempts: 5,
                    reconnectionDelay: 1000,
                });

                newChatSocket.on('connect', () => {
                    console.log('[ChatSocket] Connected:', newChatSocket?.id);
                    setIsChatConnected(true);
                    newChatSocket?.emit('chat:auth', { token });
                });

                newChatSocket.on('disconnect', () => {
                    console.log('[ChatSocket] Disconnected');
                    setIsChatConnected(false);
                });

                newChatSocket.on('chat:authenticated', ({ userId }) => {
                    console.log('[ChatSocket] Authenticated as:', userId);
                });

                newChatSocket.on('chat:typing', ({ conversationId, userId }) => {
                    setTypingUsers((prev) => {
                        const next = new Map(prev);
                        next.set(conversationId, userId);
                        return next;
                    });
                });

                newChatSocket.on('chat:typing_stop', ({ conversationId }) => {
                    setTypingUsers((prev) => {
                        const next = new Map(prev);
                        next.delete(conversationId);
                        return next;
                    });
                });

                setChatSocket(newChatSocket);

                // Presence socket — own connection, lightweight, sends heartbeats
                newPresenceSocket = io(SOCKET_URL, {
                    path: '/presence',
                    auth: { userId: user.id },
                    transports: ['websocket'],
                    reconnection: true,
                    reconnectionAttempts: 5,
                    reconnectionDelay: 1500,
                });

                newPresenceSocket.on('connect', () => {
                    console.log('[Presence] Connected:', newPresenceSocket?.id);
                    setIsPresenceConnected(true);
                    myStatusRef.current = 'online';
                    setMyStatusState('online');
                });

                newPresenceSocket.on('disconnect', () => {
                    console.log('[Presence] Disconnected');
                    setIsPresenceConnected(false);
                });

                newPresenceSocket.on('presence:update', ({ userId, status }: { userId: string; status: PresenceStatus }) => {
                    setPresenceMap((prev) => {
                        const next = new Map(prev);
                        if (status === 'offline') {
                            next.delete(userId);
                        } else {
                            next.set(userId, status);
                        }
                        return next;
                    });
                });

                presenceSocketRef.current = newPresenceSocket;
                setPresenceSocket(newPresenceSocket);

                heartbeatTimer = setInterval(() => {
                    presenceSocketRef.current?.emit('presence:beat');
                }, HEARTBEAT_INTERVAL_MS);
            }
        };

        setupSocket();

        // App-state listener: idle when background, online when foreground
        const appStateSub = AppState.addEventListener('change', (state: AppStateStatus) => {
            if (state === 'active') {
                if (myStatusRef.current === 'idle' || myStatusRef.current === 'offline') {
                    setMyStatus('online');
                }
            } else if (state === 'background' || state === 'inactive') {
                setMyStatus('idle');
            }
        });

        return () => {
            if (newSocket) {
                console.log('[Socket] Cleaning up connection');
                newSocket.disconnect();
                setSocket(null);
                setIsConnected(false);
            }
            if (newChatSocket) {
                console.log('[ChatSocket] Cleaning up connection');
                newChatSocket.disconnect();
                setChatSocket(null);
                setIsChatConnected(false);
            }
            if (newPresenceSocket) {
                console.log('[Presence] Cleaning up connection');
                newPresenceSocket.disconnect();
                presenceSocketRef.current = null;
                setPresenceSocket(null);
                setIsPresenceConnected(false);
            }
            if (heartbeatTimer) clearInterval(heartbeatTimer);
            appStateSub.remove();
        };
    }, [isAuthenticated, user?.id, setMyStatus]);

    return (
        <SocketContext.Provider
            value={{
                socket,
                chatSocket,
                presenceSocket,
                isConnected,
                isChatConnected,
                isPresenceConnected,
                onlineUsers,
                typingUsers,
                presenceMap,
                myStatus,
                setMyStatus,
                joinConversation,
                leaveConversation,
                sendTyping,
                stopTyping,
            }}
        >
            {children}
        </SocketContext.Provider>
    );
};
