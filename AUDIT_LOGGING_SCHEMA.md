# Audit Logging Database Schema

**Sprint 9 - Story 9.9: Audit Logging & Monitoring**

## Required Prisma Schema

Add the following model to `prisma/schema.prisma`:

```prisma
model AuditLog {
  id        String   @id @default(cuid())

  // Event Information
  eventType String   // AUTH_LOGIN_SUCCESS, FILE_UPLOAD, etc.
  severity  String   // INFO, WARNING, ERROR, CRITICAL

  // User Context
  userId         String?
  organizationId String?

  // Request Context
  ipAddress  String?
  userAgent  String?

  // Resource Information
  resource   String?  // DOCUMENT, FILE, USER, etc.
  resourceId String?  // ID of the resource
  action     String?  // CREATE, UPDATE, DELETE, VERIFY, etc.

  // Result
  result   String   // SUCCESS or FAILURE
  message  String   // Human-readable message
  metadata Json     @default("{}") // Additional data

  // Timestamp
  timestamp DateTime @default(now())

  // Indexes for common queries
  @@index([userId])
  @@index([organizationId])
  @@index([eventType])
  @@index([severity])
  @@index([timestamp])
  @@index([ipAddress])

  @@map("audit_logs")
}
```

## Migration Commands

After adding the model to `schema.prisma`, run:

```bash
# Create migration
npx prisma migrate dev --name add_audit_logs

# OR for production
npx prisma migrate deploy
```

## Schema Explanation

### Fields

**Event Information:**
- `eventType`: Type of event (see AuditEventType enum in lib/auditLog.ts)
- `severity`: Log severity level (INFO, WARNING, ERROR, CRITICAL)

**User Context:**
- `userId`: ID of user who performed action (nullable for unauthenticated events)
- `organizationId`: Organization context (nullable)

**Request Context:**
- `ipAddress`: IP address of request origin
- `userAgent`: Browser/client user agent string

**Resource Information:**
- `resource`: Type of resource (DOCUMENT, FILE, USER, etc.)
- `resourceId`: Specific resource ID
- `action`: Action performed (CREATE, UPDATE, DELETE, etc.)

**Result:**
- `result`: SUCCESS or FAILURE
- `message`: Human-readable description
- `metadata`: JSON object with additional event-specific data

**Timestamp:**
- `timestamp`: When the event occurred (auto-set to now)

### Indexes

Indexes are created for common query patterns:
- By user (find all actions by a user)
- By organization (find all org-related events)
- By event type (find all login attempts)
- By severity (find all errors)
- By timestamp (time-based queries)
- By IP address (track actions from specific IPs)

## Example Queries

### Find all failed login attempts:
```typescript
const failedLogins = await db.auditLog.findMany({
  where: {
    eventType: 'AUTH_LOGIN_FAILURE',
  },
  orderBy: { timestamp: 'desc' },
  take: 100,
});
```

### Find all actions by a user:
```typescript
const userActions = await db.auditLog.findMany({
  where: {
    userId: 'user-123',
  },
  orderBy: { timestamp: 'desc' },
});
```

### Find security events in last 24 hours:
```typescript
const securityEvents = await db.auditLog.findMany({
  where: {
    severity: { in: ['WARNING', 'ERROR', 'CRITICAL'] },
    timestamp: {
      gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
    },
  },
  orderBy: { timestamp: 'desc' },
});
```

### Find all actions from an IP:
```typescript
const ipActions = await db.auditLog.findMany({
  where: {
    ipAddress: '192.168.1.100',
  },
  orderBy: { timestamp: 'desc' },
});
```

## Data Retention

**Recommendation**: Implement data retention policy to prevent unlimited growth.

### Option 1: Time-based cleanup (cron job)

```typescript
// Delete logs older than 90 days
await db.auditLog.deleteMany({
  where: {
    timestamp: {
      lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
    },
  },
});
```

### Option 2: Archive old logs

```typescript
// Move logs older than 90 days to archive table/storage
const oldLogs = await db.auditLog.findMany({
  where: {
    timestamp: {
      lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
    },
  },
});

// Archive to S3/cold storage
await archiveToS3(oldLogs);

// Delete from active table
await db.auditLog.deleteMany({
  where: {
    timestamp: {
      lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
    },
  },
});
```

## Storage Estimates

**Average log size**: ~500 bytes

**Daily volume estimates:**
- 100 users, 10 actions/user/day = 1,000 logs/day
- 1,000 logs × 500 bytes = 500 KB/day
- 500 KB × 30 days = 15 MB/month
- 15 MB × 12 months = 180 MB/year

**With 1,000 users:**
- 10,000 logs/day
- 5 MB/day
- 150 MB/month
- 1.8 GB/year

**Recommendation**: Implement retention policy after 90 days (keeps storage under ~500 MB)

## Security Considerations

**Data Protection:**
- ✅ Audit logs contain sensitive information (IPs, user IDs)
- ✅ Restrict access to admin users only
- ✅ Never expose audit logs to regular users
- ✅ Sanitize before displaying (no raw metadata to frontend)

**Compliance:**
- ✅ GDPR: Include in data export/deletion requests
- ✅ SOC 2: Maintain audit trail for compliance
- ✅ PCI DSS: Log all access to cardholder data (future)

**Tamper Protection:**
- ⚠️ Future: Consider write-once storage (S3 with object lock)
- ⚠️ Future: Consider cryptographic signatures for log integrity
- ⚠️ Future: Separate database/service for audit logs

## Testing the Schema

After migration, verify:

```bash
# Open Prisma Studio
npx prisma studio

# Check that audit_logs table exists
# Try creating a test record
```

## Status

- [x] Schema documented
- [ ] Migration created and run
- [ ] Indexes verified
- [ ] Retention policy implemented
- [ ] Access controls verified
