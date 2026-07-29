import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { logger } from '@/utils/logger';

interface UseWebSocketOptions {
    enabled?: boolean;
    onConnect?: () => void;
    onDisconnect?: () => void;
    onError?: (error: Error) => void;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
    const { enabled = true, onConnect, onDisconnect, onError } = options;
    const socketRef = useRef<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        if (!enabled) return;

        const token = localStorage.getItem('auth_token');
        if (!token) {
            logger.warn('No auth token found, skipping WebSocket connection');
            return;
        }

        // Same-origin so Vite/Cloudflare tunnel can proxy to the API
        let serverUrl = window.location.origin;
        const configured = import.meta.env.VITE_API_BASE_URL as string | undefined;
        if (configured && /^https?:\/\//i.test(configured)) {
          serverUrl = configured.replace(/\/api\/?$/, '');
        }

        logger.info(`🔌 Connecting to WebSocket server at: ${serverUrl}`);

        // Flag to prevent reconnection after cleanup
        let isCleanedUp = false;

        // Create socket connection
        const socket = io(serverUrl, {
            auth: { token },
            transports: ['websocket', 'polling'], // Try WebSocket first, fallback to polling
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            reconnectionAttempts: 5,
            path: '/socket.io/', // Explicitly set path
        });

        socketRef.current = socket;

        // Connection event handlers
        socket.on('connect', () => {
            if (isCleanedUp) return; // Don't update state if component is unmounted
            logger.info('WebSocket connected');
            setIsConnected(true);
            setError(null);
            onConnect?.();
        });

        socket.on('disconnect', (reason) => {
            if (isCleanedUp) return; // Don't update state if component is unmounted
            logger.info(`WebSocket disconnected: ${reason}`);
            setIsConnected(false);
            onDisconnect?.();
        });

        socket.on('connect_error', (err) => {
            if (isCleanedUp) return; // Don't update state if component is unmounted
            logger.error('WebSocket connection error:', err);
            const error = new Error(`WebSocket connection failed: ${err.message}`);
            setError(error);
            onError?.(error);
        });

        // Cleanup on unmount
        return () => {
            isCleanedUp = true;
            socket.disconnect();
            socketRef.current = null;
            setIsConnected(false); // Immediately set to false on cleanup
        };
    }, [enabled]); // Only re-run if enabled changes, not on callback changes

    // Helper to emit events
    const emit = (event: string, data: any) => {
        if (socketRef.current?.connected) {
            socketRef.current.emit(event, data);
        } else {
            logger.warn(`Cannot emit ${event}: WebSocket not connected`);
        }
    };

    // Helper to listen for events
    const on = (event: string, handler: (...args: any[]) => void) => {
        socketRef.current?.on(event, handler);
    };

    // Helper to remove event listeners
    const off = (event: string, handler?: (...args: any[]) => void) => {
        socketRef.current?.off(event, handler);
    };

    return {
        socket: socketRef.current,
        isConnected,
        error,
        emit,
        on,
        off,
    };
}
