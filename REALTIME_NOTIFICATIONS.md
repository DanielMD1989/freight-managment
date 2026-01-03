# Real-Time Notification System
**Phase 2 - Story 15.13: Real-time WebSocket Notifications**

## Overview

The Freight Management Platform implements a comprehensive real-time notification system using WebSockets (Socket.io) to provide instant updates to users about critical events such as GPS tracking, load status changes, settlements, and bypass detection.

## Architecture

### Components

1. **WebSocket Server** (`lib/websocket-server.ts`)
   - Socket.io server integrated with Next.js HTTP server
   - Room-based messaging for user-specific notifications
   - Authentication and user verification
   - Connection health monitoring (ping/pong)

2. **Custom Next.js Server** (`server.js`)
   - Extends Next.js to support WebSocket connections
   - Initializes WebSocket server on startup
   - Handles both HTTP and WebSocket traffic on the same port

3. **WebSocket Client Hook** (`hooks/useWebSocket.ts`)
   - React hook for WebSocket connection management
   - Auto-reconnection with exponential backoff
   - Browser notification integration
   - Connection state tracking

4. **Notification Preferences** (`components/NotificationPreferences.tsx`)
   - UI for managing notification settings
   - Browser push notification permission management
   - Per-notification-type preferences

5. **Notification API Integration** (`lib/notifications.ts`)
   - Integrated real-time delivery with existing notification system
   - Every database notification automatically sent via WebSocket

## Setup

### 1. Install Dependencies

```bash
npm install socket.io socket.io-client
```

### 2. Environment Variables

Add to your `.env` file:

```env
# WebSocket Configuration
NEXT_PUBLIC_WEBSOCKET_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

For production:
```env
NEXT_PUBLIC_WEBSOCKET_URL=https://your-domain.com
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

### 3. Start the Server

The custom server with WebSocket support is started via:

```bash
node server.js
```

Or for development:
```bash
npm run dev
```

**Note:** Update `package.json` to use the custom server:

```json
{
  "scripts": {
    "dev": "node server.js",
    "build": "next build",
    "start": "NODE_ENV=production node server.js"
  }
}
```

## Usage

### Client-Side Integration

#### 1. Basic WebSocket Connection

```tsx
'use client';

import { useWebSocket } from '@/hooks/useWebSocket';
import { useSession } from 'next-auth/react';

export default function MyComponent() {
  const { data: session } = useSession();

  const { isConnected, socket } = useWebSocket({
    userId: session?.user?.id || null,
    onNotification: (notification) => {
      console.log('Received notification:', notification);
      // Handle notification (show toast, update UI, etc.)
    },
    onConnect: () => {
      console.log('WebSocket connected');
    },
    onDisconnect: () => {
      console.log('WebSocket disconnected');
    },
    autoConnect: true,
  });

  return (
    <div>
      Status: {isConnected ? 'Connected' : 'Disconnected'}
    </div>
  );
}
```

#### 2. Browser Notification Permission

```tsx
import { useNotificationPermission } from '@/hooks/useWebSocket';

export default function NotificationSetup() {
  const { permission, requestPermission, isSupported } = useNotificationPermission();

  const handleEnable = async () => {
    const result = await requestPermission();
    if (result === 'granted') {
      console.log('Notifications enabled');
    }
  };

  return (
    <button onClick={handleEnable}>
      Enable Notifications ({permission})
    </button>
  );
}
```

#### 3. Notification Preferences UI

```tsx
import NotificationPreferences from '@/components/NotificationPreferences';

export default function SettingsPage() {
  return (
    <div>
      <h1>Notification Settings</h1>
      <NotificationPreferences />
    </div>
  );
}
```

### Server-Side Integration

#### Send Real-Time Notification

```typescript
import { sendRealtimeNotification } from '@/lib/websocket-server';
import { createNotification } from '@/lib/notifications';

// Create notification (automatically sends via WebSocket)
await createNotification({
  userId: 'user-id',
  type: 'GPS_OFFLINE',
  title: 'GPS Signal Lost',
  message: 'Truck ABC-123 GPS went offline',
  metadata: { truckId: 'truck-id' },
});
```

#### Broadcast to Role

```typescript
import { broadcastToRole } from '@/lib/websocket-server';

await broadcastToRole('SHIPPER', {
  id: 'notification-id',
  type: 'SYSTEM_UPDATE',
  title: 'Platform Maintenance',
  message: 'Scheduled maintenance at 2am',
  createdAt: new Date(),
});
```

#### Check User Connection Status

```typescript
import { isUserConnected } from '@/lib/websocket-server';

if (isUserConnected('user-id')) {
  console.log('User is online');
}
```

## Notification Types

The system supports the following notification types:

```typescript
export const NotificationType = {
  // GPS Events
  GPS_OFFLINE: 'GPS_OFFLINE',
  TRUCK_AT_PICKUP: 'TRUCK_AT_PICKUP',
  TRUCK_AT_DELIVERY: 'TRUCK_AT_DELIVERY',

  // Settlement Events
  POD_SUBMITTED: 'POD_SUBMITTED',
  POD_VERIFIED: 'POD_VERIFIED',
  COMMISSION_DEDUCTED: 'COMMISSION_DEDUCTED',
  SETTLEMENT_COMPLETE: 'SETTLEMENT_COMPLETE',

  // User Status
  USER_STATUS_CHANGED: 'USER_STATUS_CHANGED',

  // Exceptions
  EXCEPTION_CREATED: 'EXCEPTION_CREATED',
  EXCEPTION_ESCALATED: 'EXCEPTION_ESCALATED',

  // Automation
  AUTOMATION_TRIGGERED: 'AUTOMATION_TRIGGERED',

  // Bypass Detection
  BYPASS_WARNING: 'BYPASS_WARNING',
  ACCOUNT_FLAGGED: 'ACCOUNT_FLAGGED',
};
```

## API Endpoints

### Get Notification Preferences

```
GET /api/user/notification-preferences
```

**Response:**
```json
{
  "preferences": {
    "GPS_OFFLINE": true,
    "TRUCK_AT_PICKUP": true,
    "BYPASS_WARNING": false
  }
}
```

### Update Notification Preferences

```
POST /api/user/notification-preferences
```

**Request Body:**
```json
{
  "preferences": [
    { "type": "GPS_OFFLINE", "enabled": true },
    { "type": "TRUCK_AT_PICKUP", "enabled": false }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Preferences updated successfully"
}
```

## WebSocket Events

### Client → Server

- `authenticate` - Authenticate user and join their room
- `ping` - Health check ping

### Server → Client

- `notification` - New notification received
- `unread-notifications` - List of unread notifications (sent on connect)
- `pong` - Health check response

## Connection Management

### Auto-Reconnection

The client automatically reconnects with exponential backoff:
- Initial delay: 1000ms
- Max delay: 5000ms
- Max attempts: 5

### Connection Health

The system uses ping/pong to monitor connection health:
- Ping interval: 30 seconds
- Automatic reconnection on disconnect

## Browser Notifications

When browser notification permission is granted:

1. **Automatic Display**: All real-time notifications automatically show browser notifications
2. **Notification Properties**:
   - Title: From notification payload
   - Body: From notification message
   - Icon: `/icon-192.png`
   - Badge: `/icon-192.png`
   - Tag: Notification ID (prevents duplicates)

## Security

### Authentication

- Users must authenticate with their user ID after connecting
- Server verifies user exists in database before allowing connection
- Invalid users are immediately disconnected

### Room-Based Isolation

- Each user has a private room: `user:{userId}`
- Notifications only sent to intended recipients
- No cross-user data leakage

### CORS Configuration

```typescript
cors: {
  origin: process.env.NEXT_PUBLIC_APP_URL,
  methods: ['GET', 'POST'],
  credentials: true,
}
```

## Performance

### Scalability Considerations

1. **Connection Pooling**: Each user maintains a single WebSocket connection
2. **Room-Based Messaging**: Efficient targeting of specific users
3. **Event Batching**: Multiple notifications can be sent in rapid succession
4. **Auto-Cleanup**: Disconnected sockets are automatically removed

### Monitoring

Track WebSocket health:

```typescript
import { getConnectedUsersCount } from '@/lib/websocket-server';

const activeConnections = getConnectedUsersCount();
console.log(`Active WebSocket connections: ${activeConnections}`);
```

## Deployment

### Production Considerations

1. **Load Balancing**: Use sticky sessions for WebSocket connections
2. **Redis Adapter**: For multi-instance deployments:
   ```typescript
   import { createAdapter } from '@socket.io/redis-adapter';
   import { createClient } from 'redis';

   const pubClient = createClient({ url: process.env.REDIS_URL });
   const subClient = pubClient.duplicate();
   io.adapter(createAdapter(pubClient, subClient));
   ```

3. **SSL/TLS**: Ensure WebSocket connections use WSS in production
4. **Rate Limiting**: Implement rate limits for notification sending
5. **Monitoring**: Use APM tools to track WebSocket performance

## Troubleshooting

### Common Issues

1. **Connection Fails**
   - Check `NEXT_PUBLIC_WEBSOCKET_URL` is correct
   - Verify server is running with `node server.js`
   - Check browser console for errors

2. **Notifications Not Received**
   - Verify user is authenticated (check `authenticate` event)
   - Check user ID is correct
   - Verify notification preferences allow the notification type

3. **Browser Notifications Not Showing**
   - Check permission status: `Notification.permission`
   - Request permission: `Notification.requestPermission()`
   - Verify notification content is valid

4. **Reconnection Loop**
   - Check server logs for authentication failures
   - Verify database connection
   - Check user exists in database

## Testing

### Manual Testing

1. **Test Connection**:
   ```typescript
   // In browser console
   console.log('WebSocket connected:', socket.connected);
   ```

2. **Test Notification**:
   ```typescript
   await createNotification({
     userId: 'your-user-id',
     type: 'GPS_OFFLINE',
     title: 'Test',
     message: 'Test notification',
   });
   ```

3. **Test Browser Notification**:
   ```typescript
   new Notification('Test', { body: 'Testing browser notifications' });
   ```

### Automated Testing

See `__tests__/websocket.test.ts` for WebSocket integration tests.

## Future Enhancements

1. **Notification Channels**: Group notifications by channel (urgent, info, etc.)
2. **Push Notifications**: Mobile push notifications via FCM/APNS
3. **Email Fallback**: Send email if user not connected
4. **SMS Fallback**: Send SMS for critical notifications
5. **Notification Templates**: Customizable notification templates
6. **Notification History**: View notification history with filtering
7. **Notification Snooze**: Temporarily disable notifications

## Related Documentation

- [Notification System](lib/notifications.ts) - Core notification logic
- [GPS Alerts](lib/gpsAlerts.ts) - GPS-related notifications
- [Email Service](lib/emailService.ts) - Email notification delivery
- [E2E Testing Report](E2E_TEST_REPORT.md) - Test coverage

---

**Last Updated:** 2026-01-03
**Sprint:** Phase 2 - Story 15.13
**Status:** ✅ Complete
