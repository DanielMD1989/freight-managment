/**
 * WebSocket Server Setup
 *
 * Phase 2 - Story 15.13: Real-time Notifications
 *
 * Handles real-time notification delivery using Socket.io
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
