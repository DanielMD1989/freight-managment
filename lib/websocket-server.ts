/**
 * WebSocket Server Setup
 *
 * Phase 2 - Story 15.13: Real-time Notifications
 * Phase 3 - MAP + GPS: Real-time GPS Position Updates
 * Phase 4 - Scalability: Redis adapter for horizontal scaling
 *
 * Handles real-time notification delivery and GPS updates using Socket.io
 * With Redis adapter support for multi-instance deployments
 */

import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import { db } from './db';
import { UserRole, LoadStatus } from '@prisma/client';
import { isRedisEnabled } from './redis';
import { getAllowedOrigins, isOriginAllowed } from './cors';
import { validateSessionByToken } from './auth';

/**
 * Socket session data stored after authentication
 * Used for permission checks on subscription events
 */
interface SocketSessionData {
  userId: string;
  role: UserRole;
  organizationId: string | null;
  isAuthenticated: boolean;
}

/**
 * Permission check result
 */
interface PermissionResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Active trip statuses that allow GPS tracking
 */
const TRACKABLE_TRIP_STATUSES: LoadStatus[] = [
  'ASSIGNED',
  'PICKUP_PENDING',
  'IN_TRANSIT',
];

/**
 * Roles allowed to access all GPS data
 */
const ALL_GPS_ALLOWED_ROLES: UserRole[] = ['ADMIN', 'SUPER_ADMIN', 'DISPATCHER'];

/**
 * Check if user has permission to subscribe to a trip's GPS updates
 *
 * Permission Rules:
 * 1. Admin/SuperAdmin/Dispatcher can access any trip
 * 2. Shipper can only access their own loads
 * 3. Carrier can only access trips they are assigned to
 * 4. State rule: Active trips (ASSIGNED, PICKUP_PENDING, IN_TRANSIT) only
 *    visible to assigned carrier until shipper explicitly subscribes
 */
function checkTripSubscriptionPermission(
  session: SocketSessionData,
  load: {
    id: string;
    status: string;
    shipperId: string;
    assignedTruck?: { carrierId: string } | null;
    trip?: { carrierId: string } | null;
  }
): PermissionResult {
  const { role, organizationId } = session;

  // Admin/Dispatcher can access any trip
  if (ALL_GPS_ALLOWED_ROLES.includes(role)) {
    return { allowed: true };
  }

  // No organization means no permission
  if (!organizationId) {
    return {
      allowed: false,
      reason: 'You must belong to an organization to access trip data',
    };
  }

  // Get carrier ID from trip or assigned truck
  const carrierId = load.trip?.carrierId || load.assignedTruck?.carrierId;

  // SHIPPER: Can access trips for their own loads
  if (role === 'SHIPPER') {
    if (load.shipperId === organizationId) {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason: 'You can only track loads that belong to your organization',
    };
  }

  // CARRIER: Can access trips assigned to them
  if (role === 'CARRIER') {
    if (carrierId === organizationId) {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason: 'You can only track trips assigned to your organization',
    };
  }

  // Default: deny access for unknown roles
  return {
    allowed: false,
    reason: 'Your role does not have permission to access trip data',
  };
}

/**
 * Log security events for audit trail
 */
function logSecurityEvent(
  eventType: 'SUBSCRIBE_DENIED' | 'SUBSCRIBE_ALLOWED',
  userId: string,
  role: string,
  resource: string,
  resourceId: string,
  reason?: string
): void {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    eventType,
    userId,
    role,
    resource,
    resourceId,
    reason,
  };
  }

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
let redisAdapterInitialized = false;

/**
 * Initialize Redis adapter for horizontal scaling
 * Allows WebSocket rooms to be shared across multiple server instances
 */
async function initializeRedisAdapter(socketServer: SocketIOServer): Promise<boolean> {
  if (redisAdapterInitialized) {
    return true;
  }

  const redisUrl = process.env.REDIS_URL;
  if (!isRedisEnabled() || !redisUrl) {
    return false;
  }

  try {
    // Create pub/sub clients for Socket.io adapter
    const pubClient = createClient({ url: redisUrl });
    const subClient = pubClient.duplicate();

    // Connect both clients
    await Promise.all([pubClient.connect(), subClient.connect()]);

    // Attach the Redis adapter
    socketServer.adapter(createAdapter(pubClient, subClient));

    redisAdapterInitialized = true;
    // Handle Redis client errors
    pubClient.on('error', (err) => {
      console.error('[WebSocket Redis Pub] Error:', err.message);
    });

    subClient.on('error', (err) => {
      console.error('[WebSocket Redis Sub] Error:', err.message);
    });

    return true;
  } catch (error) {
    console.error('[WebSocket] Failed to initialize Redis adapter:', error);
    console.log('[WebSocket] Falling back to in-memory adapter');
    return false;
  }
}

/**
 * Initialize WebSocket server
 */
export async function initializeWebSocketServer(httpServer: HTTPServer): Promise<SocketIOServer> {
  if (io) {
    return io;
  }

  // SECURITY FIX v4: Use origin whitelisting instead of single origin
  // This matches the CORS configuration in middleware.ts and lib/cors.ts
  io = new SocketIOServer(httpServer, {
    cors: {
      // Use the centralized allowed origins list for consistent CORS policy
      origin: (origin, callback) => {
        // Allow requests with no origin (server-to-server, mobile apps)
        if (!origin) {
          callback(null, true);
          return;
        }

        // Check if origin is in the allowed list
        if (isOriginAllowed(origin)) {
          callback(null, true);
        } else {
          console.warn(`[WebSocket CORS] Rejected origin: ${origin}`);
          callback(new Error('Origin not allowed by CORS policy'), false);
        }
      },
      methods: ['GET', 'POST'],
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'x-client-type'],
    },
    path: '/api/socket',
    // Connection security options
    allowEIO3: false, // Disable legacy Engine.IO v3 (security)
    pingTimeout: 30000, // 30s ping timeout
    pingInterval: 25000, // 25s ping interval
  });

  // Initialize Redis adapter for horizontal scaling
  await initializeRedisAdapter(io);

  // Log allowed origins on startup
  io.on('connection', (socket) => {
    // Log connection with origin info for security audit
    const origin = socket.handshake.headers.origin || 'unknown';
    const clientIP = socket.handshake.headers['x-forwarded-for']
      || socket.handshake.headers['x-real-ip']
      || socket.handshake.address
      || 'unknown';
    // Authenticate user and store session data for permission checks
    // Accepts either: { userId: string, token?: string } or just userId string (legacy)
    socket.on('authenticate', async (authData: string | { userId: string; token?: string }) => {
      // Parse authentication data (support both legacy and new formats)
      let userId: string;
      let sessionToken: string | undefined;

      if (typeof authData === 'string') {
        // Legacy format: just userId
        userId = authData;
      } else if (authData && typeof authData === 'object') {
        // New format: { userId, token }
        userId = authData.userId;
        sessionToken = authData.token;
      } else {
        socket.emit('error', { code: 'AUTH_REQUIRED', message: 'User ID required for authentication' });
        socket.disconnect();
        return;
      }

      if (!userId) {
        socket.emit('error', { code: 'AUTH_REQUIRED', message: 'User ID required for authentication' });
        socket.disconnect();
        return;
      }

      // P1 FIX: Validate session token if provided (session revocation check)
      if (sessionToken) {
        const sessionValidation = await validateSessionByToken(sessionToken);
        if (!sessionValidation.valid) {
          socket.emit('error', {
            code: 'SESSION_INVALID',
            message: sessionValidation.reason || 'Session is invalid or revoked',
          });
          socket.disconnect();
          return;
        }

        // Verify token belongs to the claimed user
        if (sessionValidation.session && sessionValidation.session.userId !== userId) {
          socket.emit('error', {
            code: 'USER_MISMATCH',
            message: 'Session does not belong to the specified user',
          });
          socket.disconnect();
          return;
        }
      }

      // Verify user exists and get full session data
      const user = await db.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          role: true,
          organizationId: true,
          isActive: true,
          status: true,
        },
      });

      if (!user) {
        socket.emit('error', { code: 'USER_NOT_FOUND', message: 'User not found' });
        socket.disconnect();
        return;
      }

      // Verify user is active
      if (!user.isActive || user.status !== 'ACTIVE') {
        socket.emit('error', { code: 'USER_INACTIVE', message: 'User account is not active' });
        socket.disconnect();
        return;
      }

      // Store session data in socket for permission checks
      const sessionData: SocketSessionData = {
        userId: user.id,
        role: user.role,
        organizationId: user.organizationId,
        isAuthenticated: true,
      };
      socket.data.session = sessionData;

      // Join user-specific room
      socket.join(`user:${userId}`);
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
      });

    // Ping/pong for connection health
    socket.on('ping', () => {
      socket.emit('pong');
    });

    // ==========================================
    // GPS Real-time Tracking (MAP + GPS Phase 3)
    // SECURITY: All subscription events require authentication
    // and organization-based permission checks
    // ==========================================

    /**
     * Subscribe to GPS updates for a specific trip/load
     *
     * PERMISSION RULES:
     * 1. User must be authenticated
     * 2. Admin/SuperAdmin/Dispatcher can access any trip
     * 3. Shipper can only access trips for their own loads
     * 4. Carrier can only access trips they are assigned to
     * 5. State rule: Only trackable statuses (ASSIGNED, PICKUP_PENDING, IN_TRANSIT)
     *    allow GPS tracking. Completed/Cancelled trips are not trackable.
     */
    socket.on('subscribe-trip', async (loadId: string) => {
      // Validate input
      if (!loadId) {
        socket.emit('error', { code: 'INVALID_INPUT', message: 'Load ID is required' });
        return;
      }

      // SECURITY: Require authentication
      const session = socket.data.session as SocketSessionData | undefined;
      if (!session?.isAuthenticated) {
        socket.emit('error', { code: 'AUTH_REQUIRED', message: 'Authentication required to subscribe to trip updates' });
        return;
      }

      // Fetch load with trip and carrier info for permission check
      const load = await db.load.findUnique({
        where: { id: loadId },
        select: {
          id: true,
          status: true,
          shipperId: true,
          assignedTruckId: true,
          assignedTruck: {
            select: {
              id: true,
              carrierId: true,
              currentLocationLat: true,
              currentLocationLon: true,
              locationUpdatedAt: true,
            },
          },
          trip: {
            select: {
              id: true,
              status: true,
              carrierId: true,
            },
          },
        },
      });

      if (!load) {
        socket.emit('error', { code: 'NOT_FOUND', message: 'Load not found' });
        return;
      }

      // PERMISSION CHECK: Determine if user can access this trip
      const permissionResult = checkTripSubscriptionPermission(session, load);
      if (!permissionResult.allowed) {
        socket.emit('error', {
          code: 'PERMISSION_DENIED',
          message: permissionResult.reason || 'You do not have permission to track this load',
        });
        return;
      }

      // STATE RULE: Check if trip is in a trackable status
      const loadStatus = load.status as LoadStatus;
      const isTrackable = TRACKABLE_TRIP_STATUSES.includes(loadStatus);

      // Admin/Dispatcher can see all statuses, but shippers/carriers only see active trips
      if (!isTrackable && !ALL_GPS_ALLOWED_ROLES.includes(session.role)) {
        socket.emit('error', {
          code: 'TRIP_NOT_TRACKABLE',
          message: `Trip is not currently trackable (status: ${load.status}). GPS tracking is only available for active trips.`,
        });
        return;
      }

      // Join trip room
      socket.join(`trip:${loadId}`);
      // Send current position if available
      if (load.assignedTruck) {
        const truck = load.assignedTruck;

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
      const session = socket.data.session as SocketSessionData | undefined;
      socket.leave(`trip:${loadId}`);
      });

    /**
     * Subscribe to all GPS updates for a carrier's fleet
     *
     * PERMISSION RULES:
     * 1. User must be authenticated
     * 2. Admin/SuperAdmin/Dispatcher can access any fleet
     * 3. Carrier/Shipper can only access their own organization's fleet
     * 4. Organization boundary check: user.organizationId must match requested organizationId
     */
    socket.on('subscribe-fleet', async (organizationId: string) => {
      // Validate input
      if (!organizationId) {
        socket.emit('error', { code: 'INVALID_INPUT', message: 'Organization ID is required' });
        return;
      }

      // SECURITY: Require authentication
      const session = socket.data.session as SocketSessionData | undefined;
      if (!session?.isAuthenticated) {
        socket.emit('error', { code: 'AUTH_REQUIRED', message: 'Authentication required to subscribe to fleet updates' });
        return;
      }

      // PERMISSION CHECK: Admin/Dispatcher can see any fleet
      const isPrivilegedRole = ALL_GPS_ALLOWED_ROLES.includes(session.role);

      if (isPrivilegedRole) {
        // Admin/Dispatcher can access any fleet
        socket.join(`fleet:${organizationId}`);
        return;
      }

      // ORGANIZATION BOUNDARY CHECK: Non-privileged users can only see their own fleet
      if (!session.organizationId) {
        socket.emit('error', {
          code: 'NO_ORGANIZATION',
          message: 'You must belong to an organization to access fleet data',
        });
        return;
      }

      if (session.organizationId !== organizationId) {
        socket.emit('error', {
          code: 'ORGANIZATION_MISMATCH',
          message: 'You can only subscribe to your own organization\'s fleet',
        });
        return;
      }

      // Verify organization exists and is a carrier
      const organization = await db.organization.findUnique({
        where: { id: organizationId },
        select: { id: true, type: true, name: true },
      });

      if (!organization) {
        socket.emit('error', { code: 'NOT_FOUND', message: 'Organization not found' });
        return;
      }

      // Only carrier-type organizations have fleets
      const carrierTypes = ['CARRIER_COMPANY', 'CARRIER_INDIVIDUAL', 'CARRIER_ASSOCIATION', 'FLEET_OWNER'];
      if (!carrierTypes.includes(organization.type)) {
        socket.emit('error', {
          code: 'NOT_A_CARRIER',
          message: 'Only carrier organizations have fleet GPS tracking',
        });
        return;
      }

      socket.join(`fleet:${organizationId}`);
      });

    // Unsubscribe from fleet updates
    socket.on('unsubscribe-fleet', (organizationId: string) => {
      const session = socket.data.session as SocketSessionData | undefined;
      socket.leave(`fleet:${organizationId}`);
      });

    /**
     * Subscribe to all GPS updates (admin/dispatcher only)
     *
     * PERMISSION RULES:
     * 1. User must be authenticated
     * 2. Only ADMIN, SUPER_ADMIN, and DISPATCHER roles are allowed
     * 3. This is for platform-wide GPS monitoring
     */
    socket.on('subscribe-all-gps', async () => {
      // SECURITY: Require authentication
      const session = socket.data.session as SocketSessionData | undefined;
      if (!session?.isAuthenticated) {
        socket.emit('error', { code: 'AUTH_REQUIRED', message: 'Authentication required to subscribe to all GPS updates' });
        return;
      }

      // STRICT PERMISSION CHECK: Only admin/dispatcher can see all GPS
      if (!ALL_GPS_ALLOWED_ROLES.includes(session.role)) {
        socket.emit('error', {
          code: 'ADMIN_REQUIRED',
          message: 'Only administrators and dispatchers can subscribe to all GPS updates',
        });
        return;
      }

      socket.join('all-gps');
      });

    // Unsubscribe from all GPS updates
    socket.on('unsubscribe-all-gps', () => {
      const session = socket.data.session as SocketSessionData | undefined;
      socket.leave('all-gps');
      });
  });

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
    where: { role: role as UserRole, isActive: true },
    select: { id: true },
  });

  // Send to each user's room
  users.forEach((user) => {
    io!.to(`user:${user.id}`).emit('notification', {
      ...notification,
      userId: user.id,
    });
  });

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
