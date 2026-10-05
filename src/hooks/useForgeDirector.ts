import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { API_URL } from '../services/api';

const FORGE_SOCKET_URL = API_URL.replace(/\/api$/, '');

export interface HermesThoughtEvent {
  sessionId: string;
  step: number;
  phase: string;
  message: string;
  details?: any;
  timestamp: number;
}

export interface HermesCommandEvent {
  sessionId: string;
  command: 'NAVIGATE_TO';
  payload: {
    view: 'understanding' | 'directions' | 'building' | 'ready';
    visualDirections?: any[];
    perspectives?: any[];
    requiresPerspectiveSelection?: boolean;
    defaultPerspective?: any;
    selectedDirection?: any;
    selectedPerspective?: any;
    gameTitle?: string;
    prompt?: string;
    gameUrl?: string;
    [key: string]: any;
  };
  timestamp: number;
}

export interface HermesErrorEvent {
  sessionId: string;
  message: string;
  canRetry: boolean;
  timestamp: number;
}

export interface ForgeDirectorHandlers {
  onThought?: (event: HermesThoughtEvent) => void;
  onCommand?: (event: HermesCommandEvent) => void;
  onError?: (event: HermesErrorEvent) => void;
  onSync?: (session: any) => void;
}

/**
 * useForgeDirector — Agent-Driven UI hook.
 *
 * Connects directly to Hermes over WebSockets (`/forge`), receiving live thoughts,
 * progress updates, and explicit navigation commands. Eliminates blind client-side
 * polling, arbitrary timers, and out-of-sync bugs.
 */
export function useForgeDirector(
  sessionId: string | null,
  handlers: ForgeDirectorHandlers,
  enabled: boolean = true
) {
  const [isConnected, setIsConnected] = useState(false);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!sessionId || !enabled) return;

    console.log(`[ForgeDirector] Connecting to /forge socket for session: ${sessionId}`);
    const socket: Socket = io(FORGE_SOCKET_URL, {
      path: '/forge',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 30,
      reconnectionDelay: 1000,
      timeout: 20000,
    });

    socket.on('connect', () => {
      console.log(`[ForgeDirector] Connected to /forge. Subscribing to forge_${sessionId}`);
      setIsConnected(true);
      socket.emit('forge:join', { sessionId });
    });

    socket.on('disconnect', (reason) => {
      console.log(`[ForgeDirector] Disconnected: ${reason}`);
      setIsConnected(false);
    });

    socket.on('connect_error', (err) => {
      console.warn(`[ForgeDirector] Socket connection error:`, err?.message);
    });

    const isSessionMatch = (incomingId?: string) => {
      if (!incomingId || !sessionId) return true;
      if (incomingId === sessionId) return true;
      return incomingId.replace(/^forge_/, '') === sessionId.replace(/^forge_/, '');
    };

    socket.on('hermes:thought', (event: HermesThoughtEvent) => {
      if (event?.sessionId && !isSessionMatch(event.sessionId)) return;
      handlersRef.current.onThought?.(event);
    });

    socket.on('hermes:command', (event: HermesCommandEvent) => {
      if (event?.sessionId && !isSessionMatch(event.sessionId)) return;
      handlersRef.current.onCommand?.(event);
    });

    socket.on('hermes:error', (event: HermesErrorEvent) => {
      if (event?.sessionId && !isSessionMatch(event.sessionId)) return;
      handlersRef.current.onError?.(event);
    });

    socket.on('forge:sync', (session: any) => {
      handlersRef.current.onSync?.(session);
    });

    return () => {
      console.log(`[ForgeDirector] Disconnecting from session: ${sessionId}`);
      socket.disconnect();
    };
  }, [sessionId, enabled]);

  return { isConnected };
}
