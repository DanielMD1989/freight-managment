# PHASE 2 USER STORIES - PLATFORM
## Core Platform Features (Stories 16.9A - 16.15)

**Document Version:** 1.0
**Date:** 2026-01-01
**Status:** Ready for Development
**Sprint:** Phase 2A & 2B

---

## OVERVIEW

This document contains **complete user stories** for Phase 2 core platform features. These stories align with the new master plan requirements and address the 5 frozen roles architecture.

**Total Stories:** 7
**Total Tasks:** 64
**Estimated Effort:** 58-73 days (~12-15 weeks)

**Story Breakdown:**
- Story 16.9A: SuperAdmin Tools (8 tasks, 12-15 days) - P0
- Story 16.9B: Company Admin Tools (5 tasks, 8-10 days) - P1
- Story 16.10: Notifications Expanded (15 tasks, 3-4 days) - P1
- Story 16.12: Load Lifecycle & State Machine (12 tasks, 10-12 days) - P0
- Story 16.13: Exception & Escalation System (15 tasks, 15-18 days) - P0
- Story 16.14: User Status Flow (8 tasks, 8-10 days) - P0
- Story 16.15: Shipper-Led Truck Matching (6 tasks, 6-8 days) - P2

---

## STORY 16.14: USER STATUS FLOW
**Priority:** P0 (Critical - BLOCKER for all admin features)
**Effort:** 8-10 days
**Sprint:** Phase 2A - Week 1-2

### User Story
**As a SuperAdmin**, I need a user approval workflow so that I can verify new users before they access the platform and suspend fraudulent accounts.

**As a new user**, I need to know my account status so that I understand why I can't access certain features.

### Background & Rationale
**Current State:** Users are immediately active after registration, allowing potential fraudulent accounts.

**New Requirement:** Implement **Registered → Pending → Active → Suspended → Banned** status flow as defined in master plan.

**Business Impact:**
- Reduces fraudulent accounts by >50%
- Improves platform trust and security
- Enables compliance with verification requirements
- Provides audit trail for account actions

### Acceptance Criteria
- ✓ User status enum implemented in database (REGISTERED, PENDING, ACTIVE, SUSPENDED, BANNED)
- ✓ New users start with REGISTERED status after signup
- ✓ Users cannot access platform features unless status = ACTIVE
- ✓ SuperAdmin can approve pending users (PENDING → ACTIVE)
- ✓ SuperAdmin can suspend/ban users with reason
- ✓ SuperAdmin can reactivate suspended users
- ✓ Users receive notifications when status changes
- ✓ Middleware enforces status check on every request
- ✓ Status history is logged with timestamp, admin, reason
- ✓ Existing users auto-migrated to ACTIVE status

---

### Tasks (8 tasks)

#### **Task 16.14.1: Database Schema Enhancement** (1 day)
**Description:** Add user status fields to Prisma schema

**Implementation:**
```prisma
enum UserStatus {
  REGISTERED  // Just signed up, awaiting profile completion
  PENDING     // Profile submitted, awaiting admin approval
  ACTIVE      // Approved, can use platform
  SUSPENDED   // Temporarily disabled (can be reactivated)
  BANNED      // Permanently disabled
}

model User {
  // ... existing fields
  status            UserStatus   @default(REGISTERED)
  statusReason      String?      // Why suspended/banned
  statusChangedAt   DateTime?
  statusChangedBy   String?      // Admin userId who changed status

  @@index([status])
}

model UserStatusHistory {
  id              String       @id @default(cuid())
  userId          String
  user            User         @relation(fields: [userId], references: [id])
  fromStatus      UserStatus
  toStatus        UserStatus
  reason          String?
  changedBy       String?      // Admin userId
  changedAt       DateTime     @default(now())

  @@index([userId])
}
```

**Files:**
- `/prisma/schema.prisma`
- `/prisma/migrations/YYYYMMDD_add_user_status.sql` (migration)

**Acceptance:**
- ✓ Migration runs successfully
- ✓ All existing users have status = ACTIVE
- ✓ No breaking changes to existing code

---

#### **Task 16.14.2: User Status Utility Library** (0.5 days)
**Description:** Create reusable functions for status management

**Implementation:**
```typescript
// /lib/userStatus.ts

import { PrismaClient, UserStatus } from '@prisma/client';

const prisma = new PrismaClient();

export async function changeUserStatus(
  userId: string,
  newStatus: UserStatus,
  reason: string | null,
  changedBy: string // SuperAdmin userId
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('User not found');

  const oldStatus = user.status;

  // Validate transition
  if (!isValidStatusTransition(oldStatus, newStatus)) {
    throw new Error(`Invalid status transition: ${oldStatus} → ${newStatus}`);
  }

  // Update user status
  await prisma.user.update({
    where: { id: userId },
    data: {
      status: newStatus,
      statusReason: reason,
      statusChangedAt: new Date(),
      statusChangedBy: changedBy,
    },
  });

  // Log to history
  await prisma.userStatusHistory.create({
    data: {
      userId,
      fromStatus: oldStatus,
      toStatus: newStatus,
      reason,
      changedBy,
    },
  });

  // Send notification
  await sendUserStatusNotification(userId, oldStatus, newStatus, reason);
}

function isValidStatusTransition(from: UserStatus, to: UserStatus): boolean {
  const validTransitions: Record<UserStatus, UserStatus[]> = {
    REGISTERED: ['PENDING', 'ACTIVE'], // Can skip to ACTIVE if admin approves directly
    PENDING: ['ACTIVE', 'REGISTERED'], // Can reject back to REGISTERED
    ACTIVE: ['SUSPENDED', 'BANNED'],
    SUSPENDED: ['ACTIVE', 'BANNED'],
    BANNED: [], // Cannot transition from BANNED
  };

  return validTransitions[from]?.includes(to) ?? false;
}

export async function getUserStatusHistory(userId: string) {
  return await prisma.userStatusHistory.findMany({
    where: { userId },
    orderBy: { changedAt: 'desc' },
    include: {
      user: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  });
}
```

**Files:**
- `/lib/userStatus.ts` (new)

**Acceptance:**
- ✓ All status transitions validated
- ✓ Invalid transitions throw errors
- ✓ Status history logged correctly

---

#### **Task 16.14.3: Registration Flow Update** (1 day)
**Description:** Update registration to use new status flow

**Implementation:**
```typescript
// /app/api/auth/signup/route.ts

export async function POST(request: Request) {
  const body = await request.json();

  // Create user with REGISTERED status
  const user = await prisma.user.create({
    data: {
      ...body,
      status: 'REGISTERED', // New users start here
    },
  });

  // Send welcome email with "Complete your profile" link
  await sendEmail({
    to: user.email,
    subject: 'Complete your profile',
    body: `Welcome! Please complete your profile to get approved.
           Visit: ${process.env.NEXT_PUBLIC_URL}/profile/complete`,
  });

  return NextResponse.json({ user });
}
```

**Files:**
- `/app/api/auth/signup/route.ts` (modify)
- `/app/profile/complete/page.tsx` (new - profile completion page)
- `/app/profile/complete/ProfileCompleteClient.tsx` (new)

**Acceptance:**
- ✓ New signups create users with REGISTERED status
- ✓ Welcome email sent with profile completion link
- ✓ Users cannot access platform until ACTIVE

---

#### **Task 16.14.4: Middleware Status Enforcement** (1 day)
**Description:** Enforce status check on every request

**Implementation:**
```typescript
// /middleware.ts

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

const PUBLIC_PATHS = ['/login', '/signup', '/api/auth'];
const PENDING_ALLOWED_PATHS = ['/pending-approval', '/profile/complete', '/logout'];

export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request });

  // Allow public paths
  if (PUBLIC_PATHS.some(path => request.nextUrl.pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Not authenticated
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const userStatus = token.status as string;

  // REGISTERED or PENDING → redirect to pending approval page
  if (userStatus === 'REGISTERED' || userStatus === 'PENDING') {
    if (!PENDING_ALLOWED_PATHS.some(path => request.nextUrl.pathname.startsWith(path))) {
      return NextResponse.redirect(new URL('/pending-approval', request.url));
    }
  }

  // SUSPENDED → show suspension message
  if (userStatus === 'SUSPENDED') {
    if (request.nextUrl.pathname !== '/suspended') {
      return NextResponse.redirect(new URL('/suspended', request.url));
    }
  }

  // BANNED → logout and show banned message
  if (userStatus === 'BANNED') {
    return NextResponse.redirect(new URL('/banned', request.url));
  }

  // ACTIVE → allow access
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

**Files:**
- `/middleware.ts` (modify)
- `/app/pending-approval/page.tsx` (new)
- `/app/suspended/page.tsx` (new)
- `/app/banned/page.tsx` (new)

**Acceptance:**
- ✓ Non-ACTIVE users cannot access platform
- ✓ Pending users see approval message
- ✓ Suspended users see suspension reason
- ✓ Banned users cannot login

---

#### **Task 16.14.5: SuperAdmin Pending User Queue** (2 days)
**Description:** Create SuperAdmin page to approve pending users

**Implementation:**
```typescript
// /app/superadmin/users/pending/PendingUsersClient.tsx

'use client';

import { useState, useEffect } from 'react';

export default function PendingUsersClient() {
  const [pendingUsers, setPendingUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchPendingUsers();
  }, []);

  const fetchPendingUsers = async () => {
    const response = await fetch('/api/superadmin/users?status=PENDING');
    const data = await response.json();
    setPendingUsers(data.users);
  };

  const handleApprove = async (userId: string) => {
    setLoading(true);
    await fetch(`/api/superadmin/users/${userId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'ACTIVE' }),
    });
    fetchPendingUsers();
    setLoading(false);
  };

  const handleReject = async (userId: string, reason: string) => {
    setLoading(true);
    await fetch(`/api/superadmin/users/${userId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'REGISTERED', reason }),
    });
    fetchPendingUsers();
    setLoading(false);
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Pending User Approvals</h1>

      {pendingUsers.length === 0 ? (
        <p className="text-gray-500">No pending users</p>
      ) : (
        <div className="space-y-4">
          {pendingUsers.map((user: any) => (
            <div key={user.id} className="bg-white p-6 rounded-lg shadow">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold">{user.name}</h3>
                  <p className="text-sm text-gray-600">{user.email}</p>
                  <p className="text-sm text-gray-600">
                    Organization: {user.organization?.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    Registered: {new Date(user.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleApprove(user.id)}
                    disabled={loading}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => {
                      const reason = prompt('Rejection reason:');
                      if (reason) handleReject(user.id, reason);
                    }}
                    disabled={loading}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                  >
                    Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

**Files:**
- `/app/superadmin/users/pending/page.tsx` (new)
- `/app/superadmin/users/pending/PendingUsersClient.tsx` (new)
- `/app/api/superadmin/users/route.ts` (new - list users by status)
- `/app/api/superadmin/users/[id]/status/route.ts` (new - change status)

**Acceptance:**
- ✓ SuperAdmin can view all pending users
- ✓ Approve button changes status to ACTIVE
- ✓ Reject button requires reason
- ✓ Bulk approve functionality works
- ✓ Real-time count updates

---

#### **Task 16.14.6: SuperAdmin Suspend/Ban Controls** (1.5 days)
**Description:** Create UI to suspend/ban users

**Implementation:**
```typescript
// /app/superadmin/users/UsersListClient.tsx

export default function UsersListClient() {
  const handleSuspend = async (userId: string) => {
    const reason = prompt('Suspension reason:');
    if (!reason) return;

    await fetch(`/api/superadmin/users/${userId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'SUSPENDED', reason }),
    });

    // Refresh list
    fetchUsers();
  };

  const handleBan = async (userId: string) => {
    const reason = prompt('Ban reason:');
    if (!reason) return;

    if (!confirm('Are you sure you want to permanently ban this user?')) return;

    await fetch(`/api/superadmin/users/${userId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'BANNED', reason }),
    });

    fetchUsers();
  };

  const handleReactivate = async (userId: string) => {
    await fetch(`/api/superadmin/users/${userId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'ACTIVE', reason: 'Reactivated by admin' }),
    });

    fetchUsers();
  };

  // Render user table with action buttons based on status
}
```

**Files:**
- `/app/superadmin/users/page.tsx` (modify)
- `/app/superadmin/users/UsersListClient.tsx` (modify)
- `/app/api/superadmin/users/[id]/status/route.ts` (expand)

**Acceptance:**
- ✓ Suspend button requires reason
- ✓ Ban button shows confirmation + requires reason
- ✓ Reactivate button works for suspended users
- ✓ User status badge shows current status
- ✓ Action buttons show/hide based on current status

---

#### **Task 16.14.7: User Status History Viewer** (1 day)
**Description:** Show status change history for users

**Implementation:**
```typescript
// /app/superadmin/users/[id]/UserStatusHistoryClient.tsx

export default function UserStatusHistoryClient({ userId }: { userId: string }) {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    const response = await fetch(`/api/superadmin/users/${userId}/status-history`);
    const data = await response.json();
    setHistory(data.history);
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4">Status History</h3>

      <div className="space-y-3">
        {history.map((entry: any, idx: number) => (
          <div key={idx} className="flex items-start gap-4 pb-3 border-b last:border-b-0">
            <div className="flex-shrink-0 w-24 text-xs text-gray-500">
              {new Date(entry.changedAt).toLocaleString()}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">{entry.fromStatus}</span>
                <span>→</span>
                <span className="font-medium">{entry.toStatus}</span>
              </div>
              {entry.reason && (
                <p className="text-sm text-gray-600 mt-1">
                  Reason: {entry.reason}
                </p>
              )}
              {entry.changedByUser && (
                <p className="text-xs text-gray-500 mt-1">
                  By: {entry.changedByUser.name}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Files:**
- `/app/superadmin/users/[id]/UserStatusHistoryClient.tsx` (new)
- `/app/api/superadmin/users/[id]/status-history/route.ts` (new)

**Acceptance:**
- ✓ Shows all status changes chronologically
- ✓ Displays reason for each change
- ✓ Shows admin who made the change
- ✓ Timestamps accurate

---

#### **Task 16.14.8: User Status Notifications** (1 day)
**Description:** Send notifications when user status changes

**Implementation:**
```typescript
// /lib/userStatus.ts (add notification function)

async function sendUserStatusNotification(
  userId: string,
  oldStatus: UserStatus,
  newStatus: UserStatus,
  reason: string | null
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;

  let title = '';
  let message = '';

  switch (newStatus) {
    case 'ACTIVE':
      title = 'Account Activated!';
      message = 'Your account has been approved. You can now access all platform features.';
      break;
    case 'SUSPENDED':
      title = 'Account Suspended';
      message = `Your account has been temporarily suspended. Reason: ${reason || 'Not specified'}. Contact support for more information.`;
      break;
    case 'BANNED':
      title = 'Account Banned';
      message = `Your account has been permanently banned. Reason: ${reason || 'Not specified'}.`;
      break;
  }

  // Create in-app notification
  await prisma.notification.create({
    data: {
      userId,
      type: 'USER_STATUS_CHANGE',
      title,
      message,
      read: false,
    },
  });

  // Send email
  await sendEmail({
    to: user.email,
    subject: title,
    body: message,
  });
}
```

**Files:**
- `/lib/userStatus.ts` (modify)

**Acceptance:**
- ✓ Notification sent when status changes to ACTIVE
- ✓ Notification sent when status changes to SUSPENDED
- ✓ Notification sent when status changes to BANNED
- ✓ Email notification sent for all status changes
- ✓ Notification includes reason

---

### Dependencies
- **Blocks:** All admin tools (16.9A, 16.9B) depend on user status flow
- **Requires:** Notification system (16.10) must be implemented in parallel

### Testing Checklist
- [ ] New user registration creates REGISTERED status
- [ ] Profile completion changes status to PENDING
- [ ] SuperAdmin can approve PENDING → ACTIVE
- [ ] SuperAdmin can reject PENDING → REGISTERED
- [ ] SuperAdmin can suspend ACTIVE → SUSPENDED
- [ ] SuperAdmin can ban users
- [ ] SUSPENDED users can be reactivated
- [ ] BANNED users cannot login
- [ ] Middleware blocks non-ACTIVE users
- [ ] Status history logs all changes
- [ ] Notifications sent for all status changes
- [ ] Existing users migrated to ACTIVE

### Database Migration
```sql
-- Add UserStatus enum
CREATE TYPE "UserStatus" AS ENUM ('REGISTERED', 'PENDING', 'ACTIVE', 'SUSPENDED', 'BANNED');

-- Add status fields to User table
ALTER TABLE "User" ADD COLUMN "status" "UserStatus" NOT NULL DEFAULT 'REGISTERED';
ALTER TABLE "User" ADD COLUMN "statusReason" TEXT;
ALTER TABLE "User" ADD COLUMN "statusChangedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "statusChangedBy" TEXT;

-- Migrate existing users to ACTIVE
UPDATE "User" SET "status" = 'ACTIVE' WHERE "status" = 'REGISTERED';

-- Create UserStatusHistory table
CREATE TABLE "UserStatusHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fromStatus" "UserStatus" NOT NULL,
    "toStatus" "UserStatus" NOT NULL,
    "reason" TEXT,
    "changedBy" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserStatusHistory_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE INDEX "User_status_idx" ON "User"("status");
CREATE INDEX "UserStatusHistory_userId_idx" ON "UserStatusHistory"("userId");

-- Add foreign key
ALTER TABLE "UserStatusHistory" ADD CONSTRAINT "UserStatusHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
```

---

## STORY 16.12: LOAD LIFECYCLE & STATE MACHINE
**Priority:** P0 (Critical - Foundation for exception system)
**Effort:** 10-12 days
**Sprint:** Phase 2A - Week 2-3

### User Story
**As a dispatcher**, I need loads to transition through a complete lifecycle with exception handling so that I can track issues and escalate problems.

**As a system**, I need to enforce valid state transitions and auto-create exceptions when issues occur.

### Background & Rationale
**Current State:** 8 simple load statuses (DRAFT, POSTED, ASSIGNED, IN_TRANSIT, DELIVERED, CANCELLED, COMPLETED, EXPIRED)

**New Requirement:** ~15 states with exception-triggered states as defined in master plan.

**Business Impact:**
- Clearer load lifecycle tracking
- Automatic exception detection
- Better dispute resolution
- Audit trail for compliance

### Acceptance Criteria
- ✓ Load state machine implemented with ~15 states
- ✓ Invalid state transitions prevented
- ✓ Exceptions auto-created for delayed/failed operations
- ✓ State history tracked for every load
- ✓ API validates state transitions
- ✓ UI shows state transition timeline
- ✓ Existing loads migrated to new state system

---

### Tasks (12 tasks)

#### **Task 16.12.1: Database Schema - New Load States** (1 day)
**Description:** Add new load states and state tracking

**Implementation:**
```prisma
enum LoadStatus {
  // Original states
  DRAFT
  POSTED
  ASSIGNED
  IN_TRANSIT
  DELIVERED
  CANCELLED
  COMPLETED
  EXPIRED

  // New exception-aware states
  PENDING_PICKUP      // Truck assigned, waiting for pickup
  PICKUP_DELAYED      // Pickup time passed, no pickup confirmation
  PICKUP_FAILED       // Shipper refused load / truck didn't show
  IN_TRANSIT_DELAYED  // Late delivery, exception created
  DELIVERY_FAILED     // Failed delivery attempt
  POD_PENDING         // Delivered, waiting for POD upload
  POD_DISPUTED        // POD quality issue / shipper disputes
  SETTLEMENT_PENDING  // POD verified, calculating payment
  SETTLEMENT_DISPUTED // Payment amount disputed
}

model Load {
  // ... existing fields
  status            LoadStatus   @default(DRAFT)
  exceptionId       String?      // Link to active exception
  exception         Exception?   @relation(fields: [exceptionId], references: [id])
  stateHistory      Json?        // Array of {status, timestamp, userId, reason}

  @@index([exceptionId])
}
```

**Files:**
- `/prisma/schema.prisma`
- `/prisma/migrations/YYYYMMDD_add_load_lifecycle_states.sql`

**Acceptance:**
- ✓ All 17 states defined
- ✓ exceptionId foreign key created
- ✓ stateHistory JSON field added
- ✓ Migration runs without errors

---

#### **Task 16.12.2: Load State Machine Library** (2 days)
**Description:** Create state machine with transition validation

**Implementation:**
```typescript
// /lib/loadStateMachine.ts

import { LoadStatus } from '@prisma/client';

// Define valid state transitions
const STATE_TRANSITIONS: Record<LoadStatus, LoadStatus[]> = {
  DRAFT: ['POSTED', 'CANCELLED'],
  POSTED: ['ASSIGNED', 'EXPIRED', 'CANCELLED'],
  ASSIGNED: ['PENDING_PICKUP', 'CANCELLED', 'PICKUP_FAILED'],
  PENDING_PICKUP: ['IN_TRANSIT', 'PICKUP_DELAYED', 'PICKUP_FAILED'],
  PICKUP_DELAYED: ['IN_TRANSIT', 'PICKUP_FAILED', 'CANCELLED'],
  PICKUP_FAILED: ['POSTED', 'CANCELLED'], // Reassign or cancel
  IN_TRANSIT: ['DELIVERED', 'IN_TRANSIT_DELAYED', 'DELIVERY_FAILED'],
  IN_TRANSIT_DELAYED: ['DELIVERED', 'DELIVERY_FAILED'],
  DELIVERY_FAILED: ['IN_TRANSIT', 'CANCELLED'], // Retry delivery
  DELIVERED: ['POD_PENDING'],
  POD_PENDING: ['POD_DISPUTED', 'SETTLEMENT_PENDING'],
  POD_DISPUTED: ['POD_PENDING', 'SETTLEMENT_PENDING'], // Resolved
  SETTLEMENT_PENDING: ['SETTLEMENT_DISPUTED', 'COMPLETED'],
  SETTLEMENT_DISPUTED: ['SETTLEMENT_PENDING', 'COMPLETED'], // Resolved
  COMPLETED: [], // Terminal state
  CANCELLED: [], // Terminal state
  EXPIRED: ['POSTED'], // Can repost
};

export function isValidTransition(
  from: LoadStatus,
  to: LoadStatus
): boolean {
  return STATE_TRANSITIONS[from]?.includes(to) ?? false;
}

export async function transitionLoadState(
  loadId: string,
  newStatus: LoadStatus,
  userId: string,
  reason?: string
): Promise<void> {
  const load = await prisma.load.findUnique({ where: { id: loadId } });
  if (!load) throw new Error('Load not found');

  const currentStatus = load.status;

  // Validate transition
  if (!isValidTransition(currentStatus, newStatus)) {
    throw new Error(
      `Invalid transition: ${currentStatus} → ${newStatus}`
    );
  }

  // Update state history
  const stateHistory = (load.stateHistory as any[]) || [];
  stateHistory.push({
    status: newStatus,
    timestamp: new Date().toISOString(),
    userId,
    reason: reason || null,
  });

  // Update load
  await prisma.load.update({
    where: { id: loadId },
    data: {
      status: newStatus,
      stateHistory,
    },
  });

  // Auto-create exception if needed
  await autoCreateExceptionIfNeeded(loadId, newStatus);
}

async function autoCreateExceptionIfNeeded(
  loadId: string,
  newStatus: LoadStatus
) {
  const exceptionTypes: Partial<Record<LoadStatus, string>> = {
    PICKUP_DELAYED: 'PICKUP_DELAYED',
    PICKUP_FAILED: 'PICKUP_FAILED',
    IN_TRANSIT_DELAYED: 'DELIVERY_DELAYED',
    DELIVERY_FAILED: 'DELIVERY_FAILED',
    POD_DISPUTED: 'POD_DISPUTED',
    SETTLEMENT_DISPUTED: 'SETTLEMENT_DISPUTED',
  };

  const exceptionType = exceptionTypes[newStatus];
  if (!exceptionType) return; // No exception needed

  // Create exception (Story 16.13 will implement this)
  // await createException({ loadId, type: exceptionType, ... });
}

export function getNextPossibleStates(
  currentStatus: LoadStatus
): LoadStatus[] {
  return STATE_TRANSITIONS[currentStatus] || [];
}
```

**Files:**
- `/lib/loadStateMachine.ts` (new)

**Acceptance:**
- ✓ All state transitions validated
- ✓ Invalid transitions throw errors
- ✓ State history logged
- ✓ Exceptions auto-created for error states

---

#### **Task 16.12.3: API Endpoint - Update Load Status** (1 day)
**Description:** Update existing status endpoint to use state machine

**Implementation:**
```typescript
// /app/api/loads/[id]/status/route.ts

import { transitionLoadState, getNextPossibleStates } from '@/lib/loadStateMachine';

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { status, reason } = await request.json();

  try {
    // Use state machine to transition
    await transitionLoadState(params.id, status, session.user.id, reason);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 400 }
    );
  }
}

// Get possible next states
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const load = await prisma.load.findUnique({
    where: { id: params.id },
    select: { status: true },
  });

  if (!load) {
    return NextResponse.json({ error: 'Load not found' }, { status: 404 });
  }

  const nextStates = getNextPossibleStates(load.status);

  return NextResponse.json({ currentStatus: load.status, nextStates });
}
```

**Files:**
- `/app/api/loads/[id]/status/route.ts` (modify)
- `/app/api/loads/[id]/state-history/route.ts` (new)

**Acceptance:**
- ✓ PUT validates state transitions
- ✓ GET returns possible next states
- ✓ Invalid transitions return 400 error
- ✓ State history updated

---

#### **Task 16.12.4: Automatic State Transition - Pickup Delayed** (1 day)
**Description:** Auto-transition to PICKUP_DELAYED if pickup time passed

**Implementation:**
```typescript
// /lib/cron/checkPickupDelays.ts

import { prisma } from '@/lib/prisma';
import { transitionLoadState } from '@/lib/loadStateMachine';

export async function checkPickupDelays() {
  const now = new Date();

  // Find loads in PENDING_PICKUP where pickup time has passed
  const delayedLoads = await prisma.load.findMany({
    where: {
      status: 'PENDING_PICKUP',
      pickupDate: {
        lt: now, // Pickup time in the past
      },
    },
  });

  for (const load of delayedLoads) {
    try {
      await transitionLoadState(
        load.id,
        'PICKUP_DELAYED',
        'SYSTEM', // System user ID
        'Pickup time passed without confirmation'
      );

      console.log(`Load ${load.id} transitioned to PICKUP_DELAYED`);
    } catch (error) {
      console.error(`Error transitioning load ${load.id}:`, error);
    }
  }
}

// Run this via cron every 15 minutes
```

**Files:**
- `/lib/cron/checkPickupDelays.ts` (new)
- `/lib/cron/index.ts` (register cron job)

**Acceptance:**
- ✓ Cron runs every 15 minutes
- ✓ Loads past pickup time transition to PICKUP_DELAYED
- ✓ Exception created automatically
- ✓ Dispatcher notified

---

#### **Task 16.12.5: Automatic State Transition - Delivery Delayed** (1 day)
**Description:** Auto-transition to IN_TRANSIT_DELAYED if delivery time passed

**Implementation:**
```typescript
// /lib/cron/checkDeliveryDelays.ts

export async function checkDeliveryDelays() {
  const now = new Date();

  const delayedLoads = await prisma.load.findMany({
    where: {
      status: 'IN_TRANSIT',
      deliveryDate: {
        lt: now, // Delivery time in the past
      },
    },
  });

  for (const load of delayedLoads) {
    try {
      await transitionLoadState(
        load.id,
        'IN_TRANSIT_DELAYED',
        'SYSTEM',
        'Delivery time passed without confirmation'
      );

      console.log(`Load ${load.id} transitioned to IN_TRANSIT_DELAYED`);
    } catch (error) {
      console.error(`Error transitioning load ${load.id}:`, error);
    }
  }
}
```

**Files:**
- `/lib/cron/checkDeliveryDelays.ts` (new)

**Acceptance:**
- ✓ Cron runs every 15 minutes
- ✓ Loads past delivery time transition to IN_TRANSIT_DELAYED
- ✓ Exception created automatically
- ✓ Dispatcher + Shipper notified

---

#### **Task 16.12.6: State History Timeline UI** (1.5 days)
**Description:** Show state transition timeline on load detail page

**Implementation:**
```typescript
// /components/LoadStateTimeline.tsx

'use client';

export default function LoadStateTimeline({ load }: { load: any }) {
  const stateHistory = (load.stateHistory as any[]) || [];

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4">Load Lifecycle</h3>

      <div className="space-y-4">
        {stateHistory.map((entry: any, idx: number) => (
          <div key={idx} className="flex items-start gap-4">
            {/* Timeline dot */}
            <div className={`flex-shrink-0 w-3 h-3 rounded-full mt-1 ${
              idx === stateHistory.length - 1
                ? 'bg-blue-600'
                : 'bg-gray-300'
            }`} />

            {/* Timeline content */}
            <div className="flex-1 pb-4">
              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 text-sm font-semibold rounded-full ${
                  getStatusColor(entry.status)
                }`}>
                  {formatStatus(entry.status)}
                </span>
                <span className="text-xs text-gray-500">
                  {new Date(entry.timestamp).toLocaleString()}
                </span>
              </div>

              {entry.reason && (
                <p className="text-sm text-gray-600 mt-1">
                  {entry.reason}
                </p>
              )}

              {entry.userId && entry.userId !== 'SYSTEM' && (
                <p className="text-xs text-gray-500 mt-1">
                  By: {entry.userName || 'User'}
                </p>
              )}

              {entry.userId === 'SYSTEM' && (
                <p className="text-xs text-gray-500 mt-1">
                  Automatic transition
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    DRAFT: 'bg-gray-100 text-gray-800',
    POSTED: 'bg-green-100 text-green-800',
    ASSIGNED: 'bg-blue-100 text-blue-800',
    PENDING_PICKUP: 'bg-yellow-100 text-yellow-800',
    PICKUP_DELAYED: 'bg-orange-100 text-orange-800',
    PICKUP_FAILED: 'bg-red-100 text-red-800',
    IN_TRANSIT: 'bg-purple-100 text-purple-800',
    IN_TRANSIT_DELAYED: 'bg-orange-100 text-orange-800',
    DELIVERY_FAILED: 'bg-red-100 text-red-800',
    DELIVERED: 'bg-green-100 text-green-800',
    POD_PENDING: 'bg-yellow-100 text-yellow-800',
    POD_DISPUTED: 'bg-red-100 text-red-800',
    SETTLEMENT_PENDING: 'bg-yellow-100 text-yellow-800',
    SETTLEMENT_DISPUTED: 'bg-red-100 text-red-800',
    COMPLETED: 'bg-gray-100 text-gray-800',
    CANCELLED: 'bg-red-100 text-red-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
}

function formatStatus(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}
```

**Files:**
- `/components/LoadStateTimeline.tsx` (new)
- `/app/shipper/loads/[id]/page.tsx` (integrate timeline)
- `/app/carrier/loads/[id]/page.tsx` (integrate timeline)
- `/app/dispatcher/loads/[id]/page.tsx` (integrate timeline)

**Acceptance:**
- ✓ Timeline shows all state changes
- ✓ Current state highlighted
- ✓ Timestamps accurate
- ✓ Reasons displayed
- ✓ System vs user transitions distinguished

---

*(Continuing with remaining 6 tasks for Story 16.12...)*

#### **Task 16.12.7: Status Update Dropdown with Valid States** (1 day)
**Description:** Update StatusUpdateModal to show only valid next states

**Implementation:**
```typescript
// /components/StatusUpdateModal.tsx (modify)

export default function StatusUpdateModal({
  loadId,
  currentStatus,
  ...props
}: StatusUpdateModalProps) {
  const [nextStates, setNextStates] = useState<LoadStatus[]>([]);

  useEffect(() => {
    // Fetch valid next states from API
    fetch(`/api/loads/${loadId}/status`)
      .then(res => res.json())
      .then(data => setNextStates(data.nextStates));
  }, [loadId]);

  return (
    <div>
      {/* Only show valid next states */}
      {nextStates.map(status => (
        <option key={status} value={status}>
          {formatStatus(status)}
        </option>
      ))}
    </div>
  );
}
```

**Files:**
- `/components/StatusUpdateModal.tsx` (modify)

**Acceptance:**
- ✓ Only valid next states shown in dropdown
- ✓ Invalid transitions prevented in UI
- ✓ Error message if invalid transition attempted

---

#### **Task 16.12.8: Existing Load Migration** (0.5 days)
**Description:** Migrate existing loads to new state system

**Implementation:**
```sql
-- Migrate existing load statuses to new state system
UPDATE "Load" SET "stateHistory" = jsonb_build_array(
  jsonb_build_object(
    'status', status,
    'timestamp', "createdAt",
    'userId', "shipperId",
    'reason', 'Initial state'
  )
)
WHERE "stateHistory" IS NULL;

-- ASSIGNED → PENDING_PICKUP (if pickup date in future)
UPDATE "Load"
SET status = 'PENDING_PICKUP'
WHERE status = 'ASSIGNED'
  AND "pickupDate" > NOW();

-- DELIVERED → POD_PENDING (if no POD uploaded)
UPDATE "Load"
SET status = 'POD_PENDING'
WHERE status = 'DELIVERED'
  AND "podUrl" IS NULL;
```

**Files:**
- `/prisma/migrations/YYYYMMDD_migrate_existing_loads.sql`

**Acceptance:**
- ✓ All loads have stateHistory initialized
- ✓ ASSIGNED loads correctly transitioned
- ✓ DELIVERED loads correctly transitioned
- ✓ No data loss

---

#### **Task 16.12.9: POD Upload Triggers State Transition** (1 day)
**Description:** Auto-transition from DELIVERED to POD_PENDING when load marked delivered

**Implementation:**
```typescript
// /app/api/loads/[id]/status/route.ts (modify)

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const { status } = await request.json();

  await transitionLoadState(params.id, status, session.user.id);

  // If transitioning to DELIVERED, auto-transition to POD_PENDING
  if (status === 'DELIVERED') {
    setTimeout(async () => {
      await transitionLoadState(
        params.id,
        'POD_PENDING',
        'SYSTEM',
        'Awaiting proof of delivery upload'
      );
    }, 1000); // 1 second delay to allow DB to settle
  }

  return NextResponse.json({ success: true });
}
```

**Files:**
- `/app/api/loads/[id]/status/route.ts` (modify)

**Acceptance:**
- ✓ DELIVERED → POD_PENDING automatic transition
- ✓ Carrier notified to upload POD
- ✓ State history reflects both transitions

---

#### **Task 16.12.10: POD Upload Triggers Settlement** (1 day)
**Description:** Auto-transition from POD_PENDING to SETTLEMENT_PENDING when POD uploaded

**Implementation:**
```typescript
// /app/api/loads/[id]/pod/route.ts

export async function POST(request: Request, { params }: { params: { id: string } }) {
  // ... upload POD logic

  // Auto-transition to SETTLEMENT_PENDING
  await transitionLoadState(
    params.id,
    'SETTLEMENT_PENDING',
    session.user.id,
    'POD uploaded, calculating settlement'
  );

  // Trigger commission calculation (Story 16.7)
  await calculateAndDeductCommission(params.id);

  return NextResponse.json({ success: true });
}
```

**Files:**
- `/app/api/loads/[id]/pod/route.ts` (modify)

**Acceptance:**
- ✓ POD upload transitions load to SETTLEMENT_PENDING
- ✓ Commission calculation triggered
- ✓ Both parties notified

---

#### **Task 16.12.11: Settlement Complete Triggers COMPLETED** (0.5 days)
**Description:** Final transition from SETTLEMENT_PENDING to COMPLETED

**Implementation:**
```typescript
// /lib/settlement.ts

export async function completeSettlement(loadId: string) {
  // ... settlement logic

  // Final state transition
  await transitionLoadState(
    loadId,
    'COMPLETED',
    'SYSTEM',
    'Settlement completed successfully'
  );

  // Update trust scores (Story 16.5)
  await updateTrustScores(loadId);
}
```

**Files:**
- `/lib/settlement.ts` (modify)

**Acceptance:**
- ✓ Settlement completion transitions to COMPLETED
- ✓ Trust scores updated
- ✓ Load lifecycle complete

---

#### **Task 16.12.12: State-Based UI Conditional Rendering** (1 day)
**Description:** Update all load UIs to show actions based on current state

**Implementation:**
```typescript
// /app/shipper/loads/[id]/LoadActionsClient.tsx

export default function LoadActionsClient({ load }: { load: Load }) {
  const currentStatus = load.status;
  const nextStates = getNextPossibleStates(currentStatus);

  return (
    <div className="flex gap-3">
      {/* Show different actions based on state */}
      {currentStatus === 'DRAFT' && (
        <button onClick={() => postLoad()}>Post Load</button>
      )}

      {currentStatus === 'POSTED' && (
        <>
          <button onClick={() => editLoad()}>Edit</button>
          <button onClick={() => cancelLoad()}>Cancel</button>
        </>
      )}

      {currentStatus === 'POD_PENDING' && (
        <button onClick={() => reviewPOD()}>Review POD</button>
      )}

      {currentStatus === 'POD_DISPUTED' && (
        <button onClick={() => resolvePODDispute()}>Resolve Dispute</button>
      )}

      {/* Generic status update for valid transitions */}
      {nextStates.length > 0 && (
        <button onClick={() => openStatusModal()}>Update Status</button>
      )}
    </div>
  );
}
```

**Files:**
- `/app/shipper/loads/[id]/LoadActionsClient.tsx` (modify)
- `/app/carrier/loads/[id]/LoadActionsClient.tsx` (modify)
- `/app/dispatcher/dashboard/DispatcherDashboardClient.tsx` (modify)

**Acceptance:**
- ✓ UI shows appropriate actions for each state
- ✓ Invalid actions hidden
- ✓ State-specific workflows enabled

---

### Dependencies (Story 16.12)
- **Blocks:** Story 16.13 (Exception System) - exceptions reference load states
- **Requires:** None (foundation for other features)
- **Parallel:** Story 16.14 (User Status Flow) can be developed in parallel

### Testing Checklist (Story 16.12)
- [ ] All 17 states defined in database
- [ ] Invalid state transitions rejected by state machine
- [ ] State history logged for all transitions
- [ ] Automatic transitions work (PICKUP_DELAYED, IN_TRANSIT_DELAYED)
- [ ] POD upload triggers SETTLEMENT_PENDING
- [ ] Settlement completion triggers COMPLETED
- [ ] Timeline UI displays all state changes
- [ ] Status dropdowns show only valid next states
- [ ] Existing loads migrated successfully
- [ ] State-based UI conditionals work correctly

---

## STORY 16.13: EXCEPTION & ESCALATION SYSTEM
**Priority:** P0 (Critical - Core issue resolution system)
**Effort:** 15-18 days
**Sprint:** Phase 2A - Week 3-5

### User Story
**As a dispatcher**, I need an exception system to track and resolve load issues so that problems don't fall through the cracks.

**As an admin**, I need escalated exceptions to reach me automatically so that I can resolve complex disputes.

**As a SuperAdmin**, I need visibility into all platform exceptions so that I can identify systemic issues and take action.

### Background & Rationale
**Current State:** No formal issue tracking system. Problems handled ad-hoc via phone calls and messages.

**New Requirement:** Multi-tier exception system with automatic routing and escalation as defined in master plan.

**Business Impact:**
- Reduces unresolved issues by >80%
- Improves average resolution time by >60%
- Provides clear accountability for problem resolution
- Enables data-driven process improvements

### Acceptance Criteria
- ✓ Exception model created with types, severity, status
- ✓ Exceptions auto-created for GPS offline, delays, disputes
- ✓ 3-tier routing: Dispatcher → Admin → SuperAdmin
- ✓ Auto-escalation based on time thresholds (4h, 24h)
- ✓ Exception dashboard per role with filters
- ✓ Comment threads for internal collaboration
- ✓ Resolution workflow with closure tracking
- ✓ Exception metrics and reporting

---

### Tasks (15 tasks)

#### **Task 16.13.1: Database Schema - Exception Model** (1 day)
**Description:** Create exception data model

**Implementation:**
```prisma
enum ExceptionType {
  GPS_OFFLINE           // GPS stopped sending data during active load
  PICKUP_DELAYED        // Pickup time passed without confirmation
  PICKUP_FAILED         // Shipper refused load / truck didn't show
  DELIVERY_DELAYED      // Delivery time passed without confirmation
  DELIVERY_FAILED       // Failed delivery attempt
  POD_DISPUTED          // POD quality issue / shipper disputes delivery
  SETTLEMENT_DISPUTED   // Payment amount disputed
  BYPASS_DETECTED       // Platform bypass attempt detected
  TRUST_SCORE_VIOLATION // Trust score dropped below threshold
  GPS_REGISTRATION_ISSUE // GPS device not properly registered
  OTHER                 // Manual exception
}

enum ExceptionSeverity {
  LOW      // Minor issue, no immediate impact
  MEDIUM   // Moderate issue, may affect delivery
  HIGH     // Serious issue, affecting active load
  CRITICAL // Platform integrity issue (bypass, fraud)
}

enum ExceptionStatus {
  OPEN         // Just created, not assigned
  ASSIGNED     // Assigned to resolver
  IN_PROGRESS  // Actively being worked on
  RESOLVED     // Issue fixed, awaiting closure
  ESCALATED    // Escalated to higher tier
  CLOSED       // Completed and closed
}

model Exception {
  id              String            @id @default(cuid())
  type            ExceptionType
  severity        ExceptionSeverity @default(MEDIUM)
  status          ExceptionStatus   @default(OPEN)
  escalationTier  Int               @default(1) // 1=Dispatcher, 2=Admin, 3=SuperAdmin

  // Related entities
  loadId          String?
  load            Load?             @relation(fields: [loadId], references: [id])
  truckId         String?
  truck           Truck?            @relation(fields: [truckId], references: [id])
  reportedById    String
  reportedBy      User              @relation("ReportedExceptions", fields: [reportedById], references: [id])
  assignedToId    String?
  assignedTo      User?             @relation("AssignedExceptions", fields: [assignedToId], references: [id])

  // Content
  title           String
  description     String
  resolution      String?           // How it was resolved
  internalNotes   String?           // Private admin notes

  // Timestamps
  createdAt       DateTime          @default(now())
  resolvedAt      DateTime?
  closedAt        DateTime?
  escalatedAt     DateTime?
  lastActivityAt  DateTime          @default(now())

  // Relations
  comments        ExceptionComment[]

  @@index([status])
  @@index([escalationTier])
  @@index([type])
  @@index([loadId])
  @@index([reportedById])
  @@index([assignedToId])
}

model ExceptionComment {
  id          String    @id @default(cuid())
  exceptionId String
  exception   Exception @relation(fields: [exceptionId], references: [id], onDelete: Cascade)
  userId      String
  user        User      @relation(fields: [userId], references: [id])
  comment     String
  isInternal  Boolean   @default(true) // Internal admin notes vs user-visible
  createdAt   DateTime  @default(now())

  @@index([exceptionId])
}
```

**Files:**
- `/prisma/schema.prisma`
- `/prisma/migrations/YYYYMMDD_add_exception_system.sql`

**Acceptance:**
- ✓ Exception model created with all fields
- ✓ ExceptionComment model for thread discussion
- ✓ All enums defined
- ✓ Indexes created for performance
- ✓ Migration runs successfully

---

#### **Task 16.13.2: Exception Creation Utility** (1.5 days)
**Description:** Create reusable exception creation function

**Implementation:**
```typescript
// /lib/exceptions.ts

import { PrismaClient, ExceptionType, ExceptionSeverity } from '@prisma/client';

const prisma = new PrismaClient();

interface CreateExceptionParams {
  type: ExceptionType;
  severity?: ExceptionSeverity;
  title: string;
  description: string;
  loadId?: string;
  truckId?: string;
  reportedById: string; // Can be 'SYSTEM' for auto-created
}

export async function createException(params: CreateExceptionParams): Promise<string> {
  const {
    type,
    severity = 'MEDIUM',
    title,
    description,
    loadId,
    truckId,
    reportedById,
  } = params;

  // Determine escalation tier based on type
  const escalationTier = determineInitialTier(type, severity);

  // Auto-assign to appropriate role
  const assignedTo = await autoAssignException(escalationTier, loadId);

  // Create exception
  const exception = await prisma.exception.create({
    data: {
      type,
      severity,
      title,
      description,
      loadId,
      truckId,
      reportedById,
      assignedToId: assignedTo?.id,
      escalationTier,
      status: assignedTo ? 'ASSIGNED' : 'OPEN',
    },
  });

  // Link exception to load
  if (loadId) {
    await prisma.load.update({
      where: { id: loadId },
      data: { exceptionId: exception.id },
    });
  }

  // Send notification
  await notifyExceptionCreated(exception.id);

  return exception.id;
}

function determineInitialTier(
  type: ExceptionType,
  severity: ExceptionSeverity
): number {
  // CRITICAL or BYPASS → SuperAdmin (Tier 3)
  if (severity === 'CRITICAL' || type === 'BYPASS_DETECTED') {
    return 3;
  }

  // POD/Settlement disputes → Admin (Tier 2)
  if (type === 'POD_DISPUTED' || type === 'SETTLEMENT_DISPUTED') {
    return 2;
  }

  // GPS/Pickup/Delivery issues → Dispatcher (Tier 1)
  return 1;
}

async function autoAssignException(tier: number, loadId?: string) {
  if (tier === 1 && loadId) {
    // Assign to load's dispatcher
    const load = await prisma.load.findUnique({
      where: { id: loadId },
      include: { shipper: { include: { organization: true } } },
    });

    // Find dispatcher in shipper's organization
    const dispatcher = await prisma.user.findFirst({
      where: {
        organizationId: load?.shipper?.organizationId,
        role: 'DISPATCHER',
      },
    });

    return dispatcher;
  }

  // For tier 2 and 3, admin/superadmin will manually claim
  return null;
}

export async function addExceptionComment(
  exceptionId: string,
  userId: string,
  comment: string,
  isInternal: boolean = true
): Promise<void> {
  await prisma.exceptionComment.create({
    data: {
      exceptionId,
      userId,
      comment,
      isInternal,
    },
  });

  // Update lastActivityAt
  await prisma.exception.update({
    where: { id: exceptionId },
    data: { lastActivityAt: new Date() },
  });
}

export async function resolveException(
  exceptionId: string,
  resolverId: string,
  resolution: string
): Promise<void> {
  await prisma.exception.update({
    where: { id: exceptionId },
    data: {
      status: 'RESOLVED',
      resolution,
      resolvedAt: new Date(),
      lastActivityAt: new Date(),
    },
  });

  // Notify reporter
  await notifyExceptionResolved(exceptionId);
}

export async function closeException(
  exceptionId: string,
  closerId: string
): Promise<void> {
  await prisma.exception.update({
    where: { id: exceptionId },
    data: {
      status: 'CLOSED',
      closedAt: new Date(),
      lastActivityAt: new Date(),
    },
  });

  // Unlink from load if linked
  await prisma.load.updateMany({
    where: { exceptionId },
    data: { exceptionId: null },
  });
}
```

**Files:**
- `/lib/exceptions.ts` (new)

**Acceptance:**
- ✓ Exception creation function works
- ✓ Auto-assignment logic correct
- ✓ Tier routing works
- ✓ Comment function works
- ✓ Resolve/close functions work

---

#### **Task 16.13.3: Auto-Create Exception on GPS Offline** (1 day)
**Description:** Integration with GPS tracking to auto-create exception

**Implementation:**
```typescript
// /lib/gpsMonitoring.ts (modify)

export async function checkGPSOfflineLoads() {
  const offlineThreshold = new Date(Date.now() - 30 * 60 * 1000); // 30 min ago

  const offlineLoads = await prisma.load.findMany({
    where: {
      status: { in: ['IN_TRANSIT', 'PENDING_PICKUP'] },
      truck: {
        lastGPSUpdate: {
          lt: offlineThreshold,
        },
      },
      exceptionId: null, // No exception already created
    },
    include: { truck: true, shipper: true },
  });

  for (const load of offlineLoads) {
    // Auto-create GPS_OFFLINE exception
    await createException({
      type: 'GPS_OFFLINE',
      severity: 'HIGH',
      title: `GPS Offline: ${load.truck?.licensePlate}`,
      description: `GPS tracking stopped for truck ${load.truck?.licensePlate} during active load. Last update: ${load.truck?.lastGPSUpdate}`,
      loadId: load.id,
      truckId: load.truckId,
      reportedById: 'SYSTEM',
    });

    console.log(`Created GPS_OFFLINE exception for load ${load.id}`);
  }
}

// Run this via cron every 15 minutes
```

**Files:**
- `/lib/gpsMonitoring.ts` (modify)
- `/lib/cron/index.ts` (add GPS offline check)

**Acceptance:**
- ✓ Exceptions created when GPS offline > 30 min
- ✓ Only creates one exception per load
- ✓ Dispatcher notified immediately
- ✓ Cron runs every 15 minutes

---

#### **Task 16.13.4: Auto-Create Exception on Pickup Delay** (0.5 days)
**Description:** Integration with load state machine

**Implementation:**
```typescript
// /lib/loadStateMachine.ts (modify autoCreateExceptionIfNeeded)

async function autoCreateExceptionIfNeeded(loadId: string, newStatus: LoadStatus) {
  const load = await prisma.load.findUnique({
    where: { id: loadId },
    include: { shipper: true, truck: true },
  });

  if (newStatus === 'PICKUP_DELAYED') {
    await createException({
      type: 'PICKUP_DELAYED',
      severity: 'MEDIUM',
      title: `Pickup Delayed: ${load?.pickupCity} → ${load?.deliveryCity}`,
      description: `Scheduled pickup time (${load?.pickupDate}) has passed without confirmation.`,
      loadId,
      reportedById: 'SYSTEM',
    });
  }

  if (newStatus === 'IN_TRANSIT_DELAYED') {
    await createException({
      type: 'DELIVERY_DELAYED',
      severity: 'HIGH',
      title: `Delivery Delayed: ${load?.pickupCity} → ${load?.deliveryCity}`,
      description: `Scheduled delivery time (${load?.deliveryDate}) has passed without confirmation.`,
      loadId,
      reportedById: 'SYSTEM',
    });
  }

  // Similar for other exception-worthy states...
}
```

**Files:**
- `/lib/loadStateMachine.ts` (modify)

**Acceptance:**
- ✓ PICKUP_DELAYED state creates exception
- ✓ IN_TRANSIT_DELAYED state creates exception
- ✓ DELIVERY_FAILED state creates exception
- ✓ All auto-created exceptions route to Tier 1 (Dispatcher)

---

#### **Task 16.13.5: Auto-Escalation Cron Job** (2 days)
**Description:** Automatic escalation based on time thresholds

**Implementation:**
```typescript
// /lib/cron/autoEscalateExceptions.ts

export async function autoEscalateExceptions() {
  const now = new Date();

  // Tier 1 → Tier 2: Unresolved after 4 hours
  const tier1Threshold = new Date(now.getTime() - 4 * 60 * 60 * 1000);
  const tier1Escalations = await prisma.exception.findMany({
    where: {
      escalationTier: 1,
      status: { in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS'] },
      createdAt: { lt: tier1Threshold },
      escalatedAt: null, // Not already escalated
    },
  });

  for (const exception of tier1Escalations) {
    await escalateException(exception.id, 2, 'Auto-escalated: 4 hours unresolved');
  }

  // Tier 2 → Tier 3: Unresolved after 24 hours
  const tier2Threshold = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const tier2Escalations = await prisma.exception.findMany({
    where: {
      escalationTier: 2,
      status: { in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS'] },
      createdAt: { lt: tier2Threshold },
    },
  });

  for (const exception of tier2Escalations) {
    await escalateException(exception.id, 3, 'Auto-escalated: 24 hours unresolved');
  }

  console.log(`Escalated ${tier1Escalations.length + tier2Escalations.length} exceptions`);
}

async function escalateException(
  exceptionId: string,
  newTier: number,
  reason: string
): Promise<void> {
  await prisma.exception.update({
    where: { id: exceptionId },
    data: {
      escalationTier: newTier,
      status: 'ESCALATED',
      escalatedAt: new Date(),
      assignedToId: null, // Unassign for new tier to claim
      lastActivityAt: new Date(),
    },
  });

  // Add comment
  await addExceptionComment(
    exceptionId,
    'SYSTEM',
    `Escalated to Tier ${newTier}: ${reason}`,
    true
  );

  // Notify new tier
  await notifyExceptionEscalated(exceptionId, newTier);
}

// Run this via cron every hour
```

**Files:**
- `/lib/cron/autoEscalateExceptions.ts` (new)
- `/lib/cron/index.ts` (register cron job)

**Acceptance:**
- ✓ Tier 1 exceptions escalate after 4 hours
- ✓ Tier 2 exceptions escalate after 24 hours
- ✓ Escalation notification sent to appropriate role
- ✓ Cron runs hourly
- ✓ Escalation reason logged

---

#### **Task 16.13.6: Exception Dashboard - Dispatcher View** (2 days)
**Description:** Dispatcher exception management dashboard

**Implementation:**
```typescript
// /app/dispatcher/exceptions/ExceptionsClient.tsx

'use client';

import { useState, useEffect } from 'react';

export default function DispatcherExceptionsClient({ userId }: { userId: string }) {
  const [exceptions, setExceptions] = useState([]);
  const [filter, setFilter] = useState<'all' | 'my' | 'team'>('my');
  const [statusFilter, setStatusFilter] = useState<string>('open');

  useEffect(() => {
    fetchExceptions();
  }, [filter, statusFilter]);

  const fetchExceptions = async () => {
    const response = await fetch(
      `/api/exceptions?tier=1&filter=${filter}&status=${statusFilter}`
    );
    const data = await response.json();
    setExceptions(data.exceptions);
  };

  const handleClaim = async (exceptionId: string) => {
    await fetch(`/api/exceptions/${exceptionId}/assign`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignedToId: userId }),
    });
    fetchExceptions();
  };

  const handleStatusChange = async (exceptionId: string, newStatus: string) => {
    await fetch(`/api/exceptions/${exceptionId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    fetchExceptions();
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Exceptions - Dispatcher</h1>

        {/* Filters */}
        <div className="flex gap-4">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="px-4 py-2 border rounded-md"
          >
            <option value="my">My Exceptions</option>
            <option value="team">Team Exceptions</option>
            <option value="all">All Open</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border rounded-md"
          >
            <option value="open">Open</option>
            <option value="assigned">Assigned</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="all">All</option>
          </select>
        </div>
      </div>

      {/* Exception List */}
      <div className="space-y-4">
        {exceptions.length === 0 ? (
          <p className="text-gray-500">No exceptions found</p>
        ) : (
          exceptions.map((exception: any) => (
            <div
              key={exception.id}
              className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  {/* Severity Badge */}
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      exception.severity === 'CRITICAL' ? 'bg-red-100 text-red-800' :
                      exception.severity === 'HIGH' ? 'bg-orange-100 text-orange-800' :
                      exception.severity === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {exception.severity}
                    </span>
                    <span className="text-xs text-gray-500">
                      {exception.type.replace(/_/g, ' ')}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    {exception.title}
                  </h3>

                  {/* Description */}
                  <p className="text-sm text-gray-600 mb-3">
                    {exception.description}
                  </p>

                  {/* Metadata */}
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>Created: {new Date(exception.createdAt).toLocaleString()}</span>
                    {exception.load && (
                      <span>
                        Load: {exception.load.pickupCity} → {exception.load.deliveryCity}
                      </span>
                    )}
                    {exception.assignedTo && (
                      <span>Assigned to: {exception.assignedTo.name}</span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  {exception.status === 'OPEN' && !exception.assignedToId && (
                    <button
                      onClick={() => handleClaim(exception.id)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                      Claim
                    </button>
                  )}

                  {exception.assignedToId === userId && exception.status !== 'RESOLVED' && (
                    <>
                      <button
                        onClick={() => handleStatusChange(exception.id, 'IN_PROGRESS')}
                        className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700"
                      >
                        Start Work
                      </button>
                      <button
                        onClick={() => {/* Open resolve modal */}}
                        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                      >
                        Resolve
                      </button>
                    </>
                  )}

                  <a
                    href={`/dispatcher/exceptions/${exception.id}`}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                  >
                    View Details
                  </a>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
```

**Files:**
- `/app/dispatcher/exceptions/page.tsx` (new)
- `/app/dispatcher/exceptions/ExceptionsClient.tsx` (new)
- `/app/api/exceptions/route.ts` (new - list exceptions)
- `/app/api/exceptions/[id]/assign/route.ts` (new - assign exception)
- `/app/api/exceptions/[id]/status/route.ts` (new - update status)

**Acceptance:**
- ✓ Dispatcher sees Tier 1 exceptions
- ✓ Can filter by my/team/all
- ✓ Can filter by status
- ✓ Can claim unassigned exceptions
- ✓ Can change status to IN_PROGRESS
- ✓ Can resolve exceptions

---

#### **Task 16.13.7: Exception Detail Page with Comments** (2 days)
**Description:** Detailed exception view with comment thread

**Implementation:**
```typescript
// /app/dispatcher/exceptions/[id]/ExceptionDetailClient.tsx

export default function ExceptionDetailClient({ exception }: { exception: any }) {
  const [comments, setComments] = useState(exception.comments || []);
  const [newComment, setNewComment] = useState('');
  const [resolution, setResolution] = useState('');

  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    await fetch(`/api/exceptions/${exception.id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comment: newComment, isInternal: true }),
    });

    setNewComment('');
    // Refresh comments
  };

  const handleResolve = async () => {
    if (!resolution.trim()) {
      alert('Please provide a resolution summary');
      return;
    }

    await fetch(`/api/exceptions/${exception.id}/resolve`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolution }),
    });

    // Redirect to exceptions list
    window.location.href = '/dispatcher/exceptions';
  };

  const handleEscalate = async () => {
    if (!confirm('Escalate this exception to Admin?')) return;

    await fetch(`/api/exceptions/${exception.id}/escalate`, {
      method: 'PUT',
    });

    alert('Exception escalated to Admin tier');
    window.location.href = '/dispatcher/exceptions';
  };

  return (
    <div className="p-6">
      {/* Exception Header */}
      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-2xl font-bold mb-2">{exception.title}</h1>
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1 text-sm font-semibold rounded-full ${
                getSeverityColor(exception.severity)
              }`}>
                {exception.severity}
              </span>
              <span className={`px-3 py-1 text-sm font-semibold rounded-full ${
                getStatusColor(exception.status)
              }`}>
                {exception.status}
              </span>
              <span className="text-sm text-gray-500">
                Tier {exception.escalationTier}
              </span>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleEscalate}
              className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700"
            >
              Escalate
            </button>
          </div>
        </div>

        <p className="text-gray-700 mb-4">{exception.description}</p>

        {/* Metadata */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Type:</span>
            <span className="ml-2 font-medium">{exception.type.replace(/_/g, ' ')}</span>
          </div>
          <div>
            <span className="text-gray-500">Created:</span>
            <span className="ml-2">{new Date(exception.createdAt).toLocaleString()}</span>
          </div>
          <div>
            <span className="text-gray-500">Reported By:</span>
            <span className="ml-2">{exception.reportedBy.name}</span>
          </div>
          {exception.assignedTo && (
            <div>
              <span className="text-gray-500">Assigned To:</span>
              <span className="ml-2">{exception.assignedTo.name}</span>
            </div>
          )}
        </div>

        {/* Related Load */}
        {exception.load && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-sm font-semibold mb-2">Related Load</h3>
            <div className="text-sm">
              <span className="font-medium">
                {exception.load.pickupCity} → {exception.load.deliveryCity}
              </span>
              <span className="ml-4 text-gray-500">
                Status: {exception.load.status}
              </span>
              <a
                href={`/dispatcher/loads/${exception.load.id}`}
                className="ml-4 text-blue-600 hover:underline"
              >
                View Load
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Comment Thread */}
      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <h3 className="text-lg font-semibold mb-4">Internal Discussion</h3>

        <div className="space-y-4 mb-6">
          {comments.map((comment: any) => (
            <div key={comment.id} className="flex gap-3">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-sm font-semibold">
                  {comment.user.name[0]}
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-sm">{comment.user.name}</span>
                  <span className="text-xs text-gray-500">
                    {new Date(comment.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="text-sm text-gray-700">{comment.comment}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Add Comment */}
        <div className="flex gap-3">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add internal comment..."
            className="flex-1 px-4 py-2 border rounded-md"
            rows={3}
          />
          <button
            onClick={handleAddComment}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Add Comment
          </button>
        </div>
      </div>

      {/* Resolve Exception */}
      {exception.status !== 'RESOLVED' && exception.status !== 'CLOSED' && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Resolve Exception</h3>

          <textarea
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
            placeholder="Describe how this exception was resolved..."
            className="w-full px-4 py-2 border rounded-md mb-4"
            rows={4}
          />

          <button
            onClick={handleResolve}
            className="px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 font-semibold"
          >
            Mark as Resolved
          </button>
        </div>
      )}
    </div>
  );
}
```

**Files:**
- `/app/dispatcher/exceptions/[id]/page.tsx` (new)
- `/app/dispatcher/exceptions/[id]/ExceptionDetailClient.tsx` (new)
- `/app/api/exceptions/[id]/comments/route.ts` (new)
- `/app/api/exceptions/[id]/resolve/route.ts` (new)
- `/app/api/exceptions/[id]/escalate/route.ts` (new)

**Acceptance:**
- ✓ Exception detail shows all information
- ✓ Comment thread displays all comments
- ✓ Can add new comments
- ✓ Can resolve with resolution text
- ✓ Can escalate to next tier
- ✓ Related load linked

---

#### **Task 16.13.8: Admin Exception Dashboard (Tier 2)** (1.5 days)
**Description:** Admin view for escalated exceptions

**Implementation:**
```typescript
// /app/admin/exceptions/AdminExceptionsClient.tsx

export default function AdminExceptionsClient() {
  // Similar structure to Dispatcher dashboard but:
  // - Shows Tier 2 exceptions
  // - Can claim escalated exceptions from Tier 1
  // - Can escalate to Tier 3 (SuperAdmin)
  // - Shows POD/Settlement disputes

  const fetchExceptions = async () => {
    const response = await fetch(`/api/exceptions?tier=2&status=${statusFilter}`);
    // ...
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Exceptions - Admin (Tier 2)</h1>
      {/* Similar layout to dispatcher dashboard */}
    </div>
  );
}
```

**Files:**
- `/app/admin/exceptions/page.tsx` (new)
- `/app/admin/exceptions/AdminExceptionsClient.tsx` (new)

**Acceptance:**
- ✓ Admin sees Tier 2 exceptions
- ✓ Can claim escalated exceptions
- ✓ Can escalate to Tier 3
- ✓ Shows POD/Settlement disputes

---

#### **Task 16.13.9: SuperAdmin Exception Dashboard (Tier 3)** (1.5 days)
**Description:** SuperAdmin view for all exceptions

**Implementation:**
```typescript
// /app/superadmin/exceptions/SuperAdminExceptionsClient.tsx

export default function SuperAdminExceptionsClient() {
  // SuperAdmin can see ALL exceptions (all tiers)
  // - View all exceptions across platform
  // - Filter by tier, organization, type, severity
  // - Override/reassign any exception
  // - Close exceptions directly
  // - View exception analytics

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Exceptions - SuperAdmin (All Tiers)</h1>

      {/* Additional filters for SuperAdmin */}
      <div className="flex gap-4 mb-6">
        <select /* Tier filter: All, 1, 2, 3 */>
        <select /* Organization filter */>
        <select /* Type filter */>
        <select /* Severity filter */>
      </div>

      {/* Exception list with admin override actions */}
    </div>
  );
}
```

**Files:**
- `/app/superadmin/exceptions/page.tsx` (new)
- `/app/superadmin/exceptions/SuperAdminExceptionsClient.tsx` (new)

**Acceptance:**
- ✓ SuperAdmin sees all platform exceptions
- ✓ Can filter by tier, org, type, severity
- ✓ Can override/reassign any exception
- ✓ Can close exceptions directly

---

#### **Task 16.13.10: Exception Metrics Dashboard** (2 days)
**Description:** Analytics for exception tracking

**Implementation:**
```typescript
// /app/superadmin/exceptions/metrics/ExceptionMetricsClient.tsx

export default function ExceptionMetricsClient() {
  const [metrics, setMetrics] = useState({
    totalExceptions: 0,
    openExceptions: 0,
    resolvedExceptions: 0,
    avgResolutionTimeHours: 0,
    escalationRate: 0,
    exceptionsByType: [],
    exceptionsByTier: [],
    resolutionTimeByTier: [],
  });

  useEffect(() => {
    fetchMetrics();
  }, []);

  const fetchMetrics = async () => {
    const response = await fetch('/api/exceptions/metrics');
    const data = await response.json();
    setMetrics(data);
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Exception Metrics</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-gray-500 text-sm">Total Exceptions</h3>
          <p className="text-3xl font-bold">{metrics.totalExceptions}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-gray-500 text-sm">Open</h3>
          <p className="text-3xl font-bold text-red-600">{metrics.openExceptions}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-gray-500 text-sm">Avg Resolution Time</h3>
          <p className="text-3xl font-bold">{metrics.avgResolutionTimeHours}h</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-gray-500 text-sm">Escalation Rate</h3>
          <p className="text-3xl font-bold">{metrics.escalationRate}%</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Exceptions by Type</h3>
          {/* Bar chart showing exception counts by type */}
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Resolution Time by Tier</h3>
          {/* Line chart showing avg resolution time for each tier */}
        </div>
      </div>
    </div>
  );
}
```

**Files:**
- `/app/superadmin/exceptions/metrics/page.tsx` (new)
- `/app/superadmin/exceptions/metrics/ExceptionMetricsClient.tsx` (new)
- `/app/api/exceptions/metrics/route.ts` (new)

**Acceptance:**
- ✓ Displays total exception count
- ✓ Shows open vs resolved counts
- ✓ Calculates average resolution time
- ✓ Shows escalation rate
- ✓ Charts for exceptions by type and tier

---

#### **Task 16.13.11-16.13.15: API Endpoints Implementation** (3 days total)

**Task 16.13.11: GET /api/exceptions** (0.5 days)
List exceptions with filtering

**Task 16.13.12: PUT /api/exceptions/[id]/assign** (0.5 days)
Assign exception to user

**Task 16.13.13: PUT /api/exceptions/[id]/resolve** (0.5 days)
Mark exception as resolved

**Task 16.13.14: PUT /api/exceptions/[id]/escalate** (0.5 days)
Manual escalation to next tier

**Task 16.13.15: GET /api/exceptions/metrics** (1 day)
Calculate exception metrics

**Combined Implementation:**
```typescript
// /app/api/exceptions/route.ts
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tier = searchParams.get('tier');
  const filter = searchParams.get('filter'); // my, team, all
  const status = searchParams.get('status');

  const where: any = {};

  if (tier) where.escalationTier = parseInt(tier);
  if (status && status !== 'all') where.status = status.toUpperCase();
  if (filter === 'my') where.assignedToId = session.user.id;
  if (filter === 'team') {
    // Get team members
  }

  const exceptions = await prisma.exception.findMany({
    where,
    include: {
      load: true,
      truck: true,
      reportedBy: true,
      assignedTo: true,
    },
    orderBy: { lastActivityAt: 'desc' },
  });

  return NextResponse.json({ exceptions });
}

// /app/api/exceptions/[id]/assign/route.ts
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const { assignedToId } = await request.json();

  await prisma.exception.update({
    where: { id: params.id },
    data: {
      assignedToId,
      status: 'ASSIGNED',
      lastActivityAt: new Date(),
    },
  });

  return NextResponse.json({ success: true });
}

// /app/api/exceptions/[id]/resolve/route.ts
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const { resolution } = await request.json();

  await resolveException(params.id, session.user.id, resolution);

  return NextResponse.json({ success: true });
}

// /app/api/exceptions/[id]/escalate/route.ts
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const exception = await prisma.exception.findUnique({
    where: { id: params.id },
  });

  const newTier = exception.escalationTier + 1;
  if (newTier > 3) {
    return NextResponse.json({ error: 'Already at max tier' }, { status: 400 });
  }

  await escalateException(params.id, newTier, 'Manually escalated');

  return NextResponse.json({ success: true });
}

// /app/api/exceptions/metrics/route.ts
export async function GET() {
  const totalExceptions = await prisma.exception.count();
  const openExceptions = await prisma.exception.count({
    where: { status: { in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS'] } },
  });
  const resolvedExceptions = await prisma.exception.count({
    where: { status: { in: ['RESOLVED', 'CLOSED'] } },
  });

  // Calculate avg resolution time
  const resolved = await prisma.exception.findMany({
    where: { resolvedAt: { not: null } },
    select: { createdAt: true, resolvedAt: true },
  });

  const avgResolutionTimeMs = resolved.reduce((sum, exc) => {
    return sum + (exc.resolvedAt.getTime() - exc.createdAt.getTime());
  }, 0) / (resolved.length || 1);

  const avgResolutionTimeHours = Math.round(avgResolutionTimeMs / (1000 * 60 * 60));

  // Escalation rate
  const escalated = await prisma.exception.count({
    where: { escalatedAt: { not: null } },
  });
  const escalationRate = Math.round((escalated / (totalExceptions || 1)) * 100);

  // Exceptions by type
  const exceptionsByType = await prisma.exception.groupBy({
    by: ['type'],
    _count: true,
  });

  return NextResponse.json({
    totalExceptions,
    openExceptions,
    resolvedExceptions,
    avgResolutionTimeHours,
    escalationRate,
    exceptionsByType,
  });
}
```

**Files:**
- `/app/api/exceptions/route.ts` (new)
- `/app/api/exceptions/[id]/assign/route.ts` (new)
- `/app/api/exceptions/[id]/resolve/route.ts` (new)
- `/app/api/exceptions/[id]/escalate/route.ts` (new)
- `/app/api/exceptions/metrics/route.ts` (new)

**Acceptance:**
- ✓ All API endpoints functional
- ✓ Proper error handling
- ✓ Authorization checks
- ✓ Metrics calculations accurate

---

### Dependencies (Story 16.13)
- **Requires:** Story 16.12 (Load State Machine) - exceptions link to load states
- **Requires:** Story 16.14 (User Status Flow) - exceptions assigned to users with proper roles
- **Blocks:** Story 16.9A (SuperAdmin Tools) - automation rules reference exceptions

### Testing Checklist (Story 16.13)
- [ ] Exception creation works (manual + automatic)
- [ ] Auto-assignment routes to correct tier
- [ ] Auto-escalation triggers after 4h (Tier 1) and 24h (Tier 2)
- [ ] Dispatcher can claim, resolve, escalate exceptions
- [ ] Admin can handle Tier 2 exceptions
- [ ] SuperAdmin sees all exceptions
- [ ] Comment threads work
- [ ] Exception metrics calculate correctly
- [ ] GPS offline creates exception
- [ ] Pickup/delivery delays create exceptions
- [ ] Resolution workflow completes successfully

---

## STORY 16.9A: SUPERADMIN TOOLS
**Priority:** P0 (Critical - Platform administration)
**Effort:** 12-15 days
**Sprint:** Phase 2A - Week 5-7

### User Story
**As a SuperAdmin**, I need comprehensive platform administration tools so that I can manage the entire system, configure settings, and oversee all organizations.

### Background & Rationale
**Current State:** Original Story 16.9 combined SuperAdmin and Company Admin tools.

**New Requirement:** Separate SuperAdmin tools (system-wide) from Company Admin tools (organization-scoped) based on 5 frozen roles architecture.

**Business Impact:**
- Centralized platform control
- Faster issue resolution
- Better compliance and audit
- Data-driven platform improvements

### Acceptance Criteria
- ✓ SuperAdmin can manage user statuses (Story 16.14)
- ✓ SuperAdmin can manage all platform exceptions (Story 16.13)
- ✓ SuperAdmin can configure global commission rates
- ✓ SuperAdmin can manage GPS devices across all organizations
- ✓ SuperAdmin can verify/unverify any organization
- ✓ SuperAdmin can review all settlements
- ✓ SuperAdmin can manage automation rules
- ✓ SuperAdmin has audit log access
- ✓ SuperAdmin can view platform-wide metrics

---

### Tasks (8 tasks)

**Note:** User Status Management is covered in Story 16.14, Exception Management in Story 16.13. This story focuses on the remaining SuperAdmin-specific tools.

#### **Task 16.9A.1: Global Commission Configuration** (2 days)
**Description:** SuperAdmin page to configure platform-wide commission rates

**Implementation:**
```typescript
// /app/superadmin/settings/commission/CommissionSettingsClient.tsx

export default function CommissionSettingsClient() {
  const [settings, setSettings] = useState({
    shipperCommissionRate: 0,
    carrierCommissionRate: 0,
    platinumDiscount: 15,
    goldDiscount: 10,
    silverDiscount: 5,
    platinumThreshold: 95,
    goldThreshold: 90,
    silverThreshold: 80,
    deadheadOriginRate: 0,
    deadheadDestinationRate: 0,
  });

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    const response = await fetch('/api/superadmin/settings/commission');
    const data = await response.json();
    setSettings(data);
  };

  const handleSave = async () => {
    setSaving(true);
    await fetch('/api/superadmin/settings/commission', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    setSaving(false);
    alert('Commission settings saved successfully');
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Global Commission Settings</h1>

      <div className="bg-white p-6 rounded-lg shadow space-y-6">
        {/* Base Commission Rates */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Base Commission Rates</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Shipper Commission Rate (%)
              </label>
              <input
                type="number"
                value={settings.shipperCommissionRate}
                onChange={(e) => setSettings({ ...settings, shipperCommissionRate: parseFloat(e.target.value) })}
                className="w-full px-4 py-2 border rounded-md"
                step="0.1"
                min="0"
                max="100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Carrier Commission Rate (%)
              </label>
              <input
                type="number"
                value={settings.carrierCommissionRate}
                onChange={(e) => setSettings({ ...settings, carrierCommissionRate: parseFloat(e.target.value) })}
                className="w-full px-4 py-2 border rounded-md"
                step="0.1"
                min="0"
                max="100"
              />
            </div>
          </div>
        </div>

        {/* Discount Tiers */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Completion Rate Discount Tiers</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Platinum (≥ {settings.platinumThreshold}%)
              </label>
              <input
                type="number"
                value={settings.platinumDiscount}
                onChange={(e) => setSettings({ ...settings, platinumDiscount: parseFloat(e.target.value) })}
                className="w-full px-4 py-2 border rounded-md"
                step="1"
                min="0"
                max="100"
              />
              <p className="text-xs text-gray-500 mt-1">Discount percentage</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Gold (≥ {settings.goldThreshold}%)
              </label>
              <input
                type="number"
                value={settings.goldDiscount}
                onChange={(e) => setSettings({ ...settings, goldDiscount: parseFloat(e.target.value) })}
                className="w-full px-4 py-2 border rounded-md"
                step="1"
                min="0"
                max="100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Silver (≥ {settings.silverThreshold}%)
              </label>
              <input
                type="number"
                value={settings.silverDiscount}
                onChange={(e) => setSettings({ ...settings, silverDiscount: parseFloat(e.target.value) })}
                className="w-full px-4 py-2 border rounded-md"
                step="1"
                min="0"
                max="100"
              />
            </div>
          </div>
        </div>

        {/* Deadhead Rates */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Deadhead Pay Rates (ETB per km)</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Deadhead to Origin (DH-O)
              </label>
              <input
                type="number"
                value={settings.deadheadOriginRate}
                onChange={(e) => setSettings({ ...settings, deadheadOriginRate: parseFloat(e.target.value) })}
                className="w-full px-4 py-2 border rounded-md"
                step="0.1"
                min="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Deadhead from Destination (DH-D)
              </label>
              <input
                type="number"
                value={settings.deadheadDestinationRate}
                onChange={(e) => setSettings({ ...settings, deadheadDestinationRate: parseFloat(e.target.value) })}
                className="w-full px-4 py-2 border rounded-md"
                step="0.1"
                min="0"
              />
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Commission Settings'}
          </button>
        </div>
      </div>

      {/* Platform Revenue Dashboard */}
      <div className="mt-6 bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Platform Revenue Overview</h3>
        {/* Revenue charts and metrics */}
      </div>
    </div>
  );
}
```

**Files:**
- `/app/superadmin/settings/commission/page.tsx` (new)
- `/app/superadmin/settings/commission/CommissionSettingsClient.tsx` (new)
- `/app/api/superadmin/settings/commission/route.ts` (new - GET/PUT)

**Acceptance:**
- ✓ SuperAdmin can view current commission rates
- ✓ Can update shipper/carrier commission rates
- ✓ Can configure discount tier thresholds
- ✓ Can set deadhead pay rates
- ✓ Changes apply platform-wide
- ✓ Revenue dashboard shows platform earnings

---

#### **Task 16.9A.2: Global GPS Device Management** (2 days)
**Description:** SuperAdmin can view and manage GPS devices across ALL organizations

**Implementation:**
```typescript
// /app/superadmin/gps/GPSManagementClient.tsx

export default function GPSManagementClient() {
  const [devices, setDevices] = useState([]);
  const [filter, setFilter] = useState({
    organization: 'all',
    status: 'all', // active, offline, unregistered
  });

  useEffect(() => {
    fetchDevices();
  }, [filter]);

  const fetchDevices = async () => {
    const params = new URLSearchParams(filter);
    const response = await fetch(`/api/superadmin/gps/devices?${params}`);
    const data = await response.json();
    setDevices(data.devices);
  };

  const handleVerifyDevice = async (truckId: string) => {
    await fetch(`/api/superadmin/gps/devices/${truckId}/verify`, {
      method: 'PUT',
    });
    fetchDevices();
  };

  const handleRemoveDevice = async (truckId: string) => {
    if (!confirm('Remove GPS device registration?')) return;

    await fetch(`/api/superadmin/gps/devices/${truckId}`, {
      method: 'DELETE',
    });
    fetchDevices();
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">GPS Device Management (All Organizations)</h1>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow mb-6 flex gap-4">
        <select
          value={filter.organization}
          onChange={(e) => setFilter({ ...filter, organization: e.target.value })}
          className="px-4 py-2 border rounded-md"
        >
          <option value="all">All Organizations</option>
          {/* Load organizations dynamically */}
        </select>

        <select
          value={filter.status}
          onChange={(e) => setFilter({ ...filter, status: e.target.value })}
          className="px-4 py-2 border rounded-md"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="offline">Offline</option>
          <option value="unregistered">Unregistered</option>
        </select>
      </div>

      {/* GPS Devices Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Organization
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Truck
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                IMEI
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Last Update
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {devices.map((device: any) => (
              <tr key={device.id}>
                <td className="px-6 py-4">{device.carrier.organization.name}</td>
                <td className="px-6 py-4">{device.licensePlate}</td>
                <td className="px-6 py-4 font-mono">{device.gpsIMEI || 'Not registered'}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                    device.gpsVerified ? 'bg-green-100 text-green-800' :
                    device.lastGPSUpdate && (Date.now() - new Date(device.lastGPSUpdate).getTime()) < 30 * 60 * 1000
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {device.gpsVerified ? 'Verified' :
                     device.lastGPSUpdate ? 'Active' : 'Offline'}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {device.lastGPSUpdate 
                    ? new Date(device.lastGPSUpdate).toLocaleString()
                    : 'Never'}
                </td>
                <td className="px-6 py-4">
                  <div className="flex gap-2">
                    {!device.gpsVerified && device.gpsIMEI && (
                      <button
                        onClick={() => handleVerifyDevice(device.id)}
                        className="text-sm text-blue-600 hover:underline"
                      >
                        Verify
                      </button>
                    )}
                    <button
                      onClick={() => handleRemoveDevice(device.id)}
                      className="text-sm text-red-600 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

**Files:**
- `/app/superadmin/gps/page.tsx` (new)
- `/app/superadmin/gps/GPSManagementClient.tsx` (new)
- `/app/api/superadmin/gps/devices/route.ts` (new - GET)
- `/app/api/superadmin/gps/devices/[id]/verify/route.ts` (new - PUT)
- `/app/api/superadmin/gps/devices/[id]/route.ts` (new - DELETE)

**Acceptance:**
- ✓ SuperAdmin sees all GPS devices across all organizations
- ✓ Can filter by organization and status
- ✓ Can manually verify GPS devices
- ✓ Can remove GPS device registrations
- ✓ Shows last update timestamp

---

#### **Task 16.9A.3: Organization Verification Management** (2 days)
**Description:** SuperAdmin can verify/unverify organizations and manage trust

**Implementation:**
```typescript
// /app/superadmin/organizations/OrganizationsClient.tsx

export default function OrganizationsClient() {
  const [organizations, setOrganizations] = useState([]);

  useEffect(() => {
    fetchOrganizations();
  }, []);

  const fetchOrganizations = async () => {
    const response = await fetch('/api/superadmin/organizations');
    const data = await response.json();
    setOrganizations(data.organizations);
  };

  const handleVerify = async (orgId: string) => {
    await fetch(`/api/superadmin/organizations/${orgId}/verify`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ verified: true }),
    });
    fetchOrganizations();
  };

  const handleUnverify = async (orgId: string) => {
    await fetch(`/api/superadmin/organizations/${orgId}/verify`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ verified: false }),
    });
    fetchOrganizations();
  };

  const handleFlag = async (orgId: string) => {
    const reason = prompt('Flag reason:');
    if (!reason) return;

    await fetch(`/api/superadmin/organizations/${orgId}/flag`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ flagged: true, reason }),
    });
    fetchOrganizations();
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Organization Management</h1>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Organization
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Completion Rate
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Trust Score
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {organizations.map((org: any) => (
              <tr key={org.id}>
                <td className="px-6 py-4 font-medium">{org.name}</td>
                <td className="px-6 py-4 text-sm text-gray-500">{org.type}</td>
                <td className="px-6 py-4">
                  {org.completionRate ? `${org.completionRate.toFixed(1)}%` : 'N/A'}
                </td>
                <td className="px-6 py-4">
                  {org.trustScore ? org.trustScore.toFixed(1) : 'N/A'}
                </td>
                <td className="px-6 py-4">
                  <div className="flex gap-2">
                    {org.isVerified && (
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                        Verified
                      </span>
                    )}
                    {org.isFlagged && (
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                        Flagged
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex gap-2">
                    {!org.isVerified ? (
                      <button
                        onClick={() => handleVerify(org.id)}
                        className="text-sm text-blue-600 hover:underline"
                      >
                        Verify
                      </button>
                    ) : (
                      <button
                        onClick={() => handleUnverify(org.id)}
                        className="text-sm text-orange-600 hover:underline"
                      >
                        Unverify
                      </button>
                    )}
                    <button
                      onClick={() => handleFlag(org.id)}
                      className="text-sm text-red-600 hover:underline"
                    >
                      Flag
                    </button>
                    <a
                      href={`/superadmin/organizations/${org.id}`}
                      className="text-sm text-gray-600 hover:underline"
                    >
                      Details
                    </a>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

**Files:**
- `/app/superadmin/organizations/page.tsx` (new)
- `/app/superadmin/organizations/OrganizationsClient.tsx` (new)
- `/app/api/superadmin/organizations/route.ts` (new - GET)
- `/app/api/superadmin/organizations/[id]/verify/route.ts` (new - PUT)
- `/app/api/superadmin/organizations/[id]/flag/route.ts` (new - PUT)

**Acceptance:**
- ✓ SuperAdmin sees all platform organizations
- ✓ Can verify/unverify organizations
- ✓ Can flag suspicious organizations
- ✓ Shows trust metrics

---

Due to length constraints, I'll create a summary of the remaining tasks for Stories 16.9A, 16.9B, 16.10, and 16.15 in this file, then complete the full details. The document is comprehensive with full implementations for the critical stories (16.14, 16.12, 16.13). 

Should I:
1. **Continue with full task-by-task detail** for all remaining stories (will be very long)
2. **Provide task summaries** for remaining stories (faster, still comprehensive)
3. **Create a second file** for the remaining stories

What's your preference?
