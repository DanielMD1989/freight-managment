/**
 * WebSocket Server Setup
 *
 * Phase 2 - Story 15.13: Real-time Notifications
 * Phase 3 - MAP + GPS: Real-time GPS Position Updates
 *
 * Handles real-time notification delivery and GPS updates using Socket.io
 */

import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { db } from './db';

export interface NotificationPayload {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  metadata?: any;
  createdAt: Date;
}

export interface GpsPositionPayload {
  truckId: string;
  loadId?: string;
  lat: number;
  lng: number;
  speed?: number;
  heading?: number;
  timestamp: string;
}

let io: SocketIOServer | null = null;

/**
 * Initialize WebSocket server
 */
export function initializeWebSocketServer(httpServer: HTTPServer): SocketIOServer {
  if (io) {
    console.log('WebSocket server already initialized');
    return io;
  }

  io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    path: '/api/socket',
  });

  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    // Authenticate user
    socket.on('authenticate', async (userId: string) => {
      if (!userId) {
        socket.disconnect();
        return;
      }

      // Verify user exists
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true },
      });

      if (!user) {
        socket.disconnect();
        return;
      }

      // Join user-specific room
      socket.join(`user:${userId}`);
      console.log(`User ${userId} authenticated and joined room`);

      // Send any unread notifications
      const unreadNotifications = await db.notification.findMany({
        where: {
          userId,
          read: false,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 10,
      });

      socket.emit('unread-notifications', unreadNotifications);
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
    });

    // Ping/pong for connection health
    socket.on('ping', () => {
      socket.emit('pong');
    });

    // ==========================================
    // GPS Real-time Tracking (MAP + GPS Phase 3)
    // ==========================================

    // Subscribe to GPS updates for a specific trip/load
    socket.on('subscribe-trip', async (loadId: string) => {
      if (!loadId) return;

      // Verify load exists
      const load = await db.load.findUnique({
        where: { id: loadId },
        select: {
          id: true,
          status: true,
          organizationId: true,
          assignedTruck: {
            select: { carrierId: true },
          },
        },
      });

      if (!load) {
        socket.emit('error', { message: 'Load not found' });
        return;
      }

      // Join trip room
      socket.join(`trip:${loadId}`);
      console.log(`Socket ${socket.id} subscribed to trip ${loadId}`);

      // Send current position if available
      if (load.assignedTruck) {
        const truck = await db.truck.findUnique({
          where: { id: load.assignedTruck.carrierId },
          select: {
            currentLocationLat: true,
            currentLocationLon: true,
            locationUpdatedAt: true,
          },
        });

        if (truck?.currentLocationLat && truck?.currentLocationLon) {
          socket.emit('gps-position', {
            loadId,
            lat: Number(truck.currentLocationLat),
            lng: Number(truck.currentLocationLon),
            timestamp: truck.locationUpdatedAt?.toISOString(),
          });
        }
      }
    });

    // Unsubscribe from trip updates
    socket.on('unsubscribe-trip', (loadId: string) => {
      socket.leave(`trip:${loadId}`);
      console.log(`Socket ${socket.id} unsubscribed from trip ${loadId}`);
    });

    // Subscribe to all GPS updates for carrier's fleet
    socket.on('subscribe-fleet', async (organizationId: string) => {
      if (!organizationId) return;

      socket.join(`fleet:${organizationId}`);
      console.log(`Socket ${socket.id} subscribed to fleet ${organizationId}`);
    });

    // Unsubscribe from fleet updates
    socket.on('unsubscribe-fleet', (organizationId: string) => {
      socket.leave(`fleet:${organizationId}`);
      console.log(`Socket ${socket.id} unsubscribed from fleet ${organizationId}`);
    });

    // Subscribe to all GPS updates (admin/dispatcher)
    socket.on('subscribe-all-gps', async () => {
      socket.join('all-gps');
      console.log(`Socket ${socket.id} subscribed to all GPS updates`);
    });

    // Unsubscribe from all GPS updates
    socket.on('unsubscribe-all-gps', () => {
      socket.leave('all-gps');
      console.log(`Socket ${socket.id} unsubscribed from all GPS updates`);
    });
  });

  console.log('WebSocket server initialized');
  return io;
}

/**
 * Get WebSocket server instance
 */
export function getWebSocketServer(): SocketIOServer | null {
  return io;
}

/**
 * Send notification to specific user via WebSocket
 */
export async function sendRealtimeNotification(
  userId: string,
  notification: NotificationPayload
): Promise<void> {
  if (!io) {
    console.warn('WebSocket server not initialized');
    return;
  }

  // Send to user's room
  io.to(`user:${userId}`).emit('notification', notification);
  console.log(`Real-time notification sent to user ${userId}`);
}

/**
 * Broadcast notification to all users with specific role
 */
export async function broadcastToRole(
  role: string,
  notification: Omit<NotificationPayload, 'userId'>
): Promise<void> {
  if (!io) {
    console.warn('WebSocket server not initialized');
    return;
  }

  // Get all users with this role
  const users = await db.user.findMany({
    where: { role, isActive: true },
    select: { id: true },
  });

  // Send to each user's room
  users.forEach((user) => {
    io!.to(`user:${user.id}`).emit('notification', {
      ...notification,
      userId: user.id,
    });
  });

  console.log(`Broadcast sent to ${users.length} users with role ${role}`);
}

/**
 * Broadcast notification to all connected clients
 */
export async function broadcastToAll(
  notification: Omit<NotificationPayload, 'userId'>
): Promise<void> {
  if (!io) {
    console.warn('WebSocket server not initialized');
    return;
  }

  io.emit('notification', notification);
  console.log('Broadcast sent to all connected clients');
}

/**
 * Get connected users count
 */
export function getConnectedUsersCount(): number {
  if (!io) return 0;
  return io.sockets.sockets.size;
}

/**
 * Check if user is connected
 */
export function isUserConnected(userId: string): boolean {
  if (!io) return false;
  const room = io.sockets.adapter.rooms.get(`user:${userId}`);
  return room ? room.size > 0 : false;
}

// ==========================================
// GPS Real-time Broadcasting (MAP + GPS Phase 3)
// ==========================================

/**
 * Broadcast GPS position update for a specific trip
 * Called when carrier updates GPS position
 */
export async function broadcastGpsPosition(
  truckId: string,
  loadId: string | null,
  carrierId: string,
  position: GpsPositionPayload
): Promise<void> {
  if (!io) {
    console.warn('WebSocket server not initialized');
    return;
  }

  // Broadcast to trip room (shippers watching their specific load)
  if (loadId) {
    io.to(`trip:${loadId}`).emit('gps-position', {
      ...position,
      loadId,
    });
  }

  // Broadcast to carrier's fleet room
  io.to(`fleet:${carrierId}`).emit('gps-position', position);

  // Broadcast to admin/dispatcher all-gps room
  io.to('all-gps').emit('gps-position', position);

  console.log(`GPS position broadcast for truck ${truckId}`);
}

/**
 * Broadcast trip status change
 * (e.g., when trip starts IN_TRANSIT or completes)
 */
export async function broadcastTripStatusChange(
  loadId: string,
  status: string,
  metadata?: any
): Promise<void> {
  if (!io) {
    console.warn('WebSocket server not initialized');
    return;
  }

  io.to(`trip:${loadId}`).emit('trip-status', {
    loadId,
    status,
    timestamp: new Date().toISOString(),
    ...metadata,
  });

  io.to('all-gps').emit('trip-status', {
    loadId,
    status,
    timestamp: new Date().toISOString(),
    ...metadata,
  });

  console.log(`Trip status broadcast: ${loadId} -> ${status}`);
}

/**
 * Broadcast GPS device status change
 * (e.g., when GPS goes offline or comes back online)
 */
export async function broadcastGpsDeviceStatus(
  truckId: string,
  carrierId: string,
  status: 'ACTIVE' | 'OFFLINE' | 'SIGNAL_LOST'
): Promise<void> {
  if (!io) {
    console.warn('WebSocket server not initialized');
    return;
  }

  const payload = {
    truckId,
    gpsStatus: status,
    timestamp: new Date().toISOString(),
  };

  // Broadcast to carrier's fleet room
  io.to(`fleet:${carrierId}`).emit('gps-device-status', payload);

  // Broadcast to admin/dispatcher
  io.to('all-gps').emit('gps-device-status', payload);

  console.log(`GPS device status broadcast: truck ${truckId} -> ${status}`);
}

/**
 * Get count of subscribers for a trip
 */
export function getTripSubscriberCount(loadId: string): number {
  if (!io) return 0;
  const room = io.sockets.adapter.rooms.get(`trip:${loadId}`);
  return room ? room.size : 0;
}

/**
 * Get count of subscribers for a fleet
 */
export function getFleetSubscriberCount(organizationId: string): number {
  if (!io) return 0;
  const room = io.sockets.adapter.rooms.get(`fleet:${organizationId}`);
  return room ? room.size : 0;
}
