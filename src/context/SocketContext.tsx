import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { getToken } from '../services/api';

interface SocketContextType {
    socket: Socket | null;
    isConnected: boolean;
    onlineUsers: string[];
}

const SocketContext = createContext<SocketContextType>({
    socket: null,
    isConnected: false,
    onlineUsers: [],
});

export const useSocket = () => useContext(SocketContext);

const SOCKET_URL = 'https://gametok-backend-production.up.railway.app';

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
    const { isAuthenticated, user } = useAuth();

    useEffect(() => {
        let newSocket: Socket | null = null;

        const setupSocket = async () => {
            if (isAuthenticated && user?.id) {
                const token = await getToken();

                // Connect to Socket.IO server
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

                    // Authenticate with server explicitly for multiplayer/chat routing
                    newSocket?.emit('auth', { userId: user.id, token });
                });

                newSocket.on('disconnect', () => {
                    console.log('[Socket] Disconnected');
                    setIsConnected(false);
                });

                // Global events that this provider manages
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
        };
    }, [isAuthenticated, user?.id]);

    return (
        <SocketContext.Provider value={{ socket, isConnected, onlineUsers }}>
            {children}
        </SocketContext.Provider>
    );
};
