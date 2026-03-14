import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { getToken } from '../services/api';

interface SocketContextType {
    socket: Socket | null;
    chatSocket: Socket | null;
    isConnected: boolean;
    isChatConnected: boolean;
    onlineUsers: string[];
    typingUsers: Map<string, string>; // conversationId -> userId
    joinConversation: (conversationId: string) => void;
    leaveConversation: (conversationId: string) => void;
    sendTyping: (conversationId: string) => void;
    stopTyping: (conversationId: string) => void;
}

const SocketContext = createContext<SocketContextType>({
    socket: null,
    chatSocket: null,
    isConnected: false,
    isChatConnected: false,
    onlineUsers: [],
    typingUsers: new Map(),
    joinConversation: () => {},
    leaveConversation: () => {},
    sendTyping: () => {},
    stopTyping: () => {},
});

export const useSocket = () => useContext(SocketContext);

const SOCKET_URL = 'https://gametok-backend-production.up.railway.app';

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [chatSocket, setChatSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [isChatConnected, setIsChatConnected] = useState(false);
    const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
    const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map());
    const { isAuthenticated, user } = useAuth();

    // Chat socket helper functions
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

    useEffect(() => {
        let newSocket: Socket | null = null;
        let newChatSocket: Socket | null = null;

        const setupSocket = async () => {
            if (isAuthenticated && user?.id) {
                const token = await getToken();

                // Connect to main Socket.IO server (for PK mode, lobby, etc.)
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
                    setOnlineUsers(prev => Array.from(new Set([...prev, userId])));
                });

                newSocket.on('presence:user_left', (userId: string) => {
                    setOnlineUsers(prev => prev.filter(id => id !== userId));
                });

                setSocket(newSocket);

                // Connect to Chat Socket (separate path for messaging)
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
                    // Authenticate with chat server
                    newChatSocket?.emit('chat:auth', { token });
                });

                newChatSocket.on('disconnect', () => {
                    console.log('[ChatSocket] Disconnected');
                    setIsChatConnected(false);
                });

                newChatSocket.on('chat:authenticated', ({ userId }) => {
                    console.log('[ChatSocket] Authenticated as:', userId);
                });

                // Typing indicators
                newChatSocket.on('chat:typing', ({ conversationId, userId }) => {
                    setTypingUsers(prev => {
                        const next = new Map(prev);
                        next.set(conversationId, userId);
                        return next;
                    });
                });

                newChatSocket.on('chat:typing_stop', ({ conversationId }) => {
                    setTypingUsers(prev => {
                        const next = new Map(prev);
                        next.delete(conversationId);
                        return next;
                    });
                });

                setChatSocket(newChatSocket);
            }
        };

        setupSocket();

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
        };
    }, [isAuthenticated, user?.id]);

    return (
        <SocketContext.Provider value={{ 
            socket, 
            chatSocket,
            isConnected, 
            isChatConnected,
            onlineUsers,
            typingUsers,
            joinConversation,
            leaveConversation,
            sendTyping,
            stopTyping,
        }}>
            {children}
        </SocketContext.Provider>
    );
};
