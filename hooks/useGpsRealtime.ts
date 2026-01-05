/**
 * GPS Real-time Hook
 *
 * React hook for subscribing to real-time GPS updates via WebSocket
 *
 * MAP + GPS Implementation - Phase 3
 */

'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

export interface GpsPosition {
  truckId: string;
  loadId?: string;
  lat: number;
  lng: number;
  speed?: number;
  heading?: number;
  timestamp: string;
}

export interface TripStatus {
  loadId: string;
  status: string;
  timestamp: string;
}

export interface GpsDeviceStatus {
  truckId: string;
  gpsStatus: 'ACTIVE' | 'OFFLINE' | 'SIGNAL_LOST';
  timestamp: string;
}

interface UseGpsRealtimeOptions {
  // Subscribe to a specific trip/load
  tripId?: string;
  // Subscribe to a carrier's fleet
  fleetId?: string;
  // Subscribe to all GPS updates (admin/dispatcher)
  subscribeAll?: boolean;
  // Callback when position updates
  onPositionUpdate?: (position: GpsPosition) => void;
  // Callback when trip status changes
  onTripStatusChange?: (status: TripStatus) => void;
  // Callback when GPS device status changes
  onDeviceStatusChange?: (status: GpsDeviceStatus) => void;
  // Auto-connect on mount
  autoConnect?: boolean;
}

interface UseGpsRealtimeReturn {
  // Connection state
  isConnected: boolean;
  // Latest positions by truck ID
  positions: Map<string, GpsPosition>;
  // Connection error
  error: string | null;
  // Manual connect/disconnect
  connect: () => void;
  disconnect: () => void;
  // Subscribe/unsubscribe methods
  subscribeToTrip: (tripId: string) => void;
  unsubscribeFromTrip: (tripId: string) => void;
  subscribeToFleet: (fleetId: string) => void;
  unsubscribeFromFleet: (fleetId: string) => void;
}

export function useGpsRealtime(options: UseGpsRealtimeOptions = {}): UseGpsRealtimeReturn {
  const {
    tripId,
    fleetId,
    subscribeAll = false,
    onPositionUpdate,
    onTripStatusChange,
    onDeviceStatusChange,
    autoConnect = true,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [positions, setPositions] = useState<Map<string, GpsPosition>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  // Handle position update
  const handlePositionUpdate = useCallback((position: GpsPosition) => {
    setPositions((prev) => {
      const next = new Map(prev);
      next.set(position.truckId, position);
      return next;
    });
    onPositionUpdate?.(position);
  }, [onPositionUpdate]);

  // Handle trip status change
  const handleTripStatusChange = useCallback((status: TripStatus) => {
    onTripStatusChange?.(status);
  }, [onTripStatusChange]);

  // Handle device status change
  const handleDeviceStatusChange = useCallback((status: GpsDeviceStatus) => {
    onDeviceStatusChange?.(status);
  }, [onDeviceStatusChange]);

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;

    const socketUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;

    socketRef.current = io(socketUrl, {
      path: '/api/socket',
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current.on('connect', () => {
      console.log('GPS WebSocket connected');
      setIsConnected(true);
      setError(null);

      // Auto-subscribe based on options
      if (tripId) {
        socketRef.current?.emit('subscribe-trip', tripId);
      }
      if (fleetId) {
        socketRef.current?.emit('subscribe-fleet', fleetId);
      }
      if (subscribeAll) {
        socketRef.current?.emit('subscribe-all-gps');
      }
    });

    socketRef.current.on('disconnect', () => {
      console.log('GPS WebSocket disconnected');
      setIsConnected(false);
    });

    socketRef.current.on('connect_error', (err) => {
      console.error('GPS WebSocket connection error:', err);
      setError('Failed to connect to GPS server');
    });

    // GPS event handlers
    socketRef.current.on('gps-position', handlePositionUpdate);
    socketRef.current.on('trip-status', handleTripStatusChange);
    socketRef.current.on('gps-device-status', handleDeviceStatusChange);
  }, [tripId, fleetId, subscribeAll, handlePositionUpdate, handleTripStatusChange, handleDeviceStatusChange]);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setIsConnected(false);
  }, []);

  // Subscribe to specific trip
  const subscribeToTrip = useCallback((id: string) => {
    socketRef.current?.emit('subscribe-trip', id);
  }, []);

  // Unsubscribe from trip
  const unsubscribeFromTrip = useCallback((id: string) => {
    socketRef.current?.emit('unsubscribe-trip', id);
  }, []);

  // Subscribe to fleet
  const subscribeToFleet = useCallback((id: string) => {
    socketRef.current?.emit('subscribe-fleet', id);
  }, []);

  // Unsubscribe from fleet
  const unsubscribeFromFleet = useCallback((id: string) => {
    socketRef.current?.emit('unsubscribe-fleet', id);
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  // Handle tripId changes
  useEffect(() => {
    if (isConnected && tripId) {
      subscribeToTrip(tripId);
      return () => {
        unsubscribeFromTrip(tripId);
      };
    }
  }, [isConnected, tripId, subscribeToTrip, unsubscribeFromTrip]);

  // Handle fleetId changes
  useEffect(() => {
    if (isConnected && fleetId) {
      subscribeToFleet(fleetId);
      return () => {
        unsubscribeFromFleet(fleetId);
      };
    }
  }, [isConnected, fleetId, subscribeToFleet, unsubscribeFromFleet]);

  return {
    isConnected,
    positions,
    error,
    connect,
    disconnect,
    subscribeToTrip,
    unsubscribeFromTrip,
    subscribeToFleet,
    unsubscribeFromFleet,
  };
}

export default useGpsRealtime;
