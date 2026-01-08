/**
 * WebSocket Client Hook
 *
 * Phase 2 - Story 15.13: Real-time Notifications
 *
 * React hook for connecting to WebSocket server and receiving real-time notifications
 */

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

export interface RealtimeNotification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  metadata?: any;
  createdAt: Date;
}

interface UseWebSocketOptions {
  userId: string | null;
  onNotification?: (notification: RealtimeNotification) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  autoConnect?: boolean;
}

interface UseWebSocketReturn {
  isConnected: boolean;
  connect: () => void;
  disconnect: () => void;
  socket: Socket | null;
}

export function useWebSocket({
  userId,
  onNotification,
  onConnect,
  onDisconnect,
  autoConnect = true,
}: UseWebSocketOptions): UseWebSocketReturn {
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const reconnectAttemptsRef = useRef(0);
  const MAX_RECONNECT_ATTEMPTS = 5;

  const connect = useCallback(() => {
    if (!userId || socketRef.current?.connected) {
      return;
    }

    const socketUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL || window.location.origin;

    const socket = io(socketUrl, {
      path: '/api/socket',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
    });

    socketRef.current = socket;

    // Connection event handlers
    socket.on('connect', () => {
      console.log('WebSocket connected');
      setIsConnected(true);
      reconnectAttemptsRef.current = 0;

      // Authenticate with user ID
      socket.emit('authenticate', userId);

      onConnect?.();
    });

    socket.on('disconnect', (reason) => {
      console.log('WebSocket disconnected:', reason);
      setIsConnected(false);
      onDisconnect?.();

      // Handle reconnection
      if (reason === 'io server disconnect') {
        // Server disconnected us, attempt manual reconnect
        if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current++;
            socket.connect();
          }, 2000);
        }
      }
    });

    socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      setIsConnected(false);
    });

    // Notification event handlers
    socket.on('notification', (notification: RealtimeNotification) => {
      console.log('Received real-time notification:', notification);
      onNotification?.(notification);

      // Show browser notification if permission granted
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(notification.title, {
          body: notification.message,
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          tag: notification.id,
        });
      }
    });

    socket.on('unread-notifications', (notifications: RealtimeNotification[]) => {
      console.log(`Received ${notifications.length} unread notifications`);
      notifications.forEach((notification) => {
        onNotification?.(notification);
      });
    });

    // Ping/pong for connection health
    socket.on('pong', () => {
      // Connection is alive
    });

    // Send ping every 30 seconds
    const pingInterval = setInterval(() => {
      if (socket.connected) {
        socket.emit('ping');
      }
    }, 30000);

    // Cleanup ping interval on disconnect
    socket.on('disconnect', () => {
      clearInterval(pingInterval);
    });

  }, [userId, onNotification, onConnect, onDisconnect]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    setIsConnected(false);
  }, []);

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (autoConnect && userId) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [userId, autoConnect, connect, disconnect]);

  return {
    isConnected,
    connect,
    disconnect,
    socket: socketRef.current,
  };
}

/**
 * Hook to request browser notification permission
 */
export function useNotificationPermission() {
  const [permission, setPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) {
      console.warn('This browser does not support notifications');
      return 'denied';
    }

    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  }, []);

  return {
    permission,
    requestPermission,
    isSupported: 'Notification' in window,
  };
}
