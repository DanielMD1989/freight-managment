# Worker Graceful Shutdown Patch Report

**Date:** 2026-01-23
**Implementer:** Claude Opus 4.5
**Severity Fixed:** HIGH (Data Integrity / Job Loss Prevention)

---

## Executive Summary

Implemented graceful shutdown handling for BullMQ workers to ensure no jobs are abandoned mid-task when the process receives termination signals.

| Scenario | Before | After |
|----------|--------|-------|
| SIGTERM received | Workers killed immediately, active jobs lost | Workers drain, wait for active jobs, then exit |
| SIGINT received | Workers killed immediately, active jobs lost | Workers drain, wait for active jobs, then exit |
| Health check during shutdown | Shows "ready" | Shows "draining" status |
| `isQueueReady()` check | Always returned `true` (bug) | Returns actual queue state |

---

## Implementation Details

### Files Modified

| File | Changes |
|------|---------|
| `lib/queue.ts` | Added shutdown state, handlers, worker status |
| `app/api/health/route.ts` | Added worker status to health endpoint |

---

## New Functions in `lib/queue.ts`

### 1. `getWorkerStatus()`

Returns current worker status for health checks.

```typescript
export function getWorkerStatus(): {
  status: WorkerStatus;      // 'running' | 'draining' | 'stopped'
  isShuttingDown: boolean;
  isDraining: boolean;
  activeWorkers: number;
  activeQueues: number;
}
```

**Use Case:** Kubernetes readiness probes can check this to stop routing traffic during shutdown.

---

### 2. `gracefulShutdown(signal: string)`

Main shutdown orchestrator.

```typescript
export async function gracefulShutdown(signal: string): Promise<void>
```

**Shutdown Sequence:**
1. Sets `isShuttingDown = true` to prevent duplicate shutdowns
2. Sets `isDraining = true` before stopping workers
3. Calls `stopWorkers()` - waits for active jobs to complete
4. Calls `closeQueues()` - closes all queue connections
5. Logs completion

---

### 3. `closeQueues()`

Closes all BullMQ queue connections.

```typescript
export async function closeQueues(): Promise<void>
```

---

### 4. `registerShutdownHandlers()`

Registers SIGTERM and SIGINT handlers.

```typescript
export function registerShutdownHandlers(): void
```

**Called automatically** by `initializeQueues()`.

---

## Signal Handler Flow

```
SIGTERM/SIGINT received
         │
         ▼
┌─────────────────────────────┐
│  gracefulShutdown()         │
│  - Set isShuttingDown=true  │
│  - Set isDraining=true      │
└─────────┬───────────────────┘
          │
          ▼
┌─────────────────────────────┐
│  stopWorkers()              │
│  - For each worker:         │
│    - worker.close()         │
│    - (waits for active jobs)│
└─────────┬───────────────────┘
          │
          ▼
┌─────────────────────────────┐
│  closeQueues()              │
│  - For each queue:          │
│    - queue.close()          │
└─────────┬───────────────────┘
          │
          ▼
┌─────────────────────────────┐
│  process.exit(0)            │
└─────────────────────────────┘
```

---

## Bug Fix: `isQueueReady()`

### Before (Bug)

```typescript
export function isQueueReady(): boolean {
  return bullmqQueues !== null || true; // BUG: || true always returns true
}
```

The `|| true` condition made this always return `true`, even when BullMQ failed to initialize.

### After (Fixed)

```typescript
export function isQueueReady(): boolean {
  // BullMQ is ready if queues are initialized
  if (bullmqQueues !== null) {
    return true;
  }
  // In-memory fallback is always ready (when BullMQ is not enabled)
  const config = getConfig();
  return !config.enabled; // If queue is disabled, in-memory is ready
}
```

Now returns:
- `true` if BullMQ queues are initialized
- `true` if queue system is disabled (in-memory fallback)
- `false` if queue system is enabled but BullMQ failed to initialize

---

## Health Endpoint Changes

### New `workers` Field

`GET /api/health?detailed=true` now includes:

```json
{
  "workers": {
    "status": "running",
    "isShuttingDown": false,
    "isDraining": false,
    "activeWorkers": 8,
    "activeQueues": 8
  }
}
```

### Status Values

| Status | Description |
|--------|-------------|
| `running` | Workers are actively processing jobs |
| `draining` | Workers are finishing active jobs before shutdown |
| `stopped` | No workers running |

---

## Kubernetes Integration

### Readiness Probe

```yaml
readinessProbe:
  httpGet:
    path: /api/health?detailed=true
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 10
```

Check for `workers.isDraining === false` before routing traffic.

### Pre-stop Hook

```yaml
lifecycle:
  preStop:
    exec:
      command: ["/bin/sh", "-c", "sleep 5"]
```

Give the application time to receive SIGTERM and start draining.

---

## BullMQ Worker Behavior

When `worker.close()` is called:
1. Worker stops accepting new jobs
2. Currently active jobs continue processing
3. Promise resolves when all active jobs complete
4. No jobs are abandoned mid-task

This is built into BullMQ's design - `close()` is a graceful operation.

---

## Shutdown State Variables

```typescript
let isShuttingDown = false;  // Prevents duplicate shutdown calls
let isDraining = false;      // True while workers are finishing jobs
let shutdownPromise: Promise<void> | null = null;  // For idempotent shutdown
```

---

## Testing the Shutdown

### Manual Test

```bash
# Start the application
npm run dev

# In another terminal, send SIGTERM
kill -TERM $(pgrep -f "next")
```

**Expected Logs:**
```
INFO: Received SIGTERM, starting graceful shutdown...
INFO: Workers entering draining mode - waiting for active jobs to complete
INFO: Worker stopped: email
INFO: Worker stopped: sms
INFO: Worker stopped: notifications
...
INFO: All workers stopped
INFO: Queue closed: email
INFO: Queue closed: sms
...
INFO: All queues closed
INFO: Graceful shutdown completed successfully
```

### Health Check During Shutdown

```bash
curl http://localhost:3000/api/health?detailed=true | jq '.workers'
```

Should show:
```json
{
  "status": "draining",
  "isShuttingDown": true,
  "isDraining": true,
  "activeWorkers": 8,
  "activeQueues": 8
}
```

---

## Migration Notes

### Existing Code

All existing code continues to work without changes. Signal handlers are automatically registered during `initializeQueues()`.

### Manual Shutdown

If you need programmatic shutdown:

```typescript
import { gracefulShutdown } from '@/lib/queue';

// Trigger graceful shutdown
await gracefulShutdown('MANUAL');
```

---

## Files Changed Summary

| File | Lines Added | Description |
|------|-------------|-------------|
| `lib/queue.ts` | +95 | Shutdown state, handlers, worker status |
| `app/api/health/route.ts` | +10 | Worker status in health endpoint |

---

## Verification Checklist

- [x] SIGTERM handler registered
- [x] SIGINT handler registered
- [x] Workers closed gracefully (wait for active jobs)
- [x] Queues closed after workers
- [x] Health check shows draining status
- [x] `isQueueReady()` bug fixed
- [x] Idempotent shutdown (multiple signals safe)
- [x] Logged shutdown progress

---

## Security Considerations

- Signal handlers only call internal functions
- No external connections made during shutdown
- Graceful timeout relies on BullMQ's built-in behavior
- If jobs hang, process may not exit (consider adding a timeout)

---

## Future Improvements

1. **Forced Shutdown Timeout**: Add a maximum wait time for draining
2. **Job Preservation**: Move incomplete jobs back to waiting queue
3. **Metrics**: Track shutdown duration for monitoring

---

**Report Generated:** 2026-01-23
**Implementer:** Claude Opus 4.5
**Status:** IMPLEMENTED
