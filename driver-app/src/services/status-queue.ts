/**
 * Status Queue Service — offline trip status change storage for driver app
 *
 * Mirrors gps-queue.ts pattern: MMKV storage, auto-flush on connectivity
 * restore via NetInfo, 24h TTL. Status changes flush in order (oldest first)
 * to respect the trip state machine.
 */
import { Platform } from "react-native";
import { tripService } from "./trip";

// MMKV — only available on native
let storage: {
  set: (key: string, value: string) => void;
  getString: (key: string) => string | undefined;
  remove: (key: string) => void;
  getAllKeys: () => string[];
} | null = null;

async function getStorage() {
  if (storage) return storage;

  if (Platform.OS === "web") {
    storage = {
      set: (key, value) => localStorage.setItem(`sq_${key}`, value),
      getString: (key) => localStorage.getItem(`sq_${key}`) ?? undefined,
      remove: (key) => localStorage.removeItem(`sq_${key}`),
      getAllKeys: () => {
        const keys: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k?.startsWith("sq_")) keys.push(k.replace("sq_", ""));
        }
        return keys;
      },
    };
  } else {
    const { createMMKV } = await import("react-native-mmkv");
    const mmkv = createMMKV({ id: "driver-status-queue" });
    storage = {
      set: (key, value) => mmkv.set(key, value),
      getString: (key) => mmkv.getString(key),
      remove: (key) => mmkv.remove(key),
      getAllKeys: () => mmkv.getAllKeys(),
    };
  }

  return storage;
}

export interface QueuedStatusChange {
  tripId: string;
  status: string;
  extra?: {
    receiverName?: string;
    receiverPhone?: string;
    deliveryNotes?: string;
    exceptionReason?: string;
  };
  queuedAt: number; // Date.now()
}

const MAX_QUEUE_SIZE = 50;
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

/** Queue a trip status change for later upload */
export async function queueStatusChange(
  change: QueuedStatusChange
): Promise<void> {
  const s = await getStorage();
  const key = `status_${change.tripId}_${change.queuedAt}`;
  s.set(key, JSON.stringify(change));
  await trimQueue();
}

/** Get all queued changes, sorted oldest first */
export async function getQueuedChanges(): Promise<QueuedStatusChange[]> {
  const s = await getStorage();
  const keys = s.getAllKeys();
  const changes: QueuedStatusChange[] = [];

  for (const key of keys) {
    const raw = s.getString(key);
    if (!raw) continue;
    try {
      changes.push(JSON.parse(raw) as QueuedStatusChange);
    } catch {
      s.remove(key);
    }
  }

  return changes.sort((a, b) => a.queuedAt - b.queuedAt);
}

/** Get count of queued status changes */
export async function getQueueSize(): Promise<number> {
  const s = await getStorage();
  return s.getAllKeys().length;
}

/** Flush all queued status changes, oldest first. */
export async function flushStatusQueue(): Promise<{
  applied: number;
  failed: number;
}> {
  const s = await getStorage();
  const keys = s.getAllKeys().sort(); // sorted by tripId_timestamp = oldest first

  if (keys.length === 0) return { applied: 0, failed: 0 };

  let applied = 0;
  let failed = 0;

  for (const key of keys) {
    const raw = s.getString(key);
    if (!raw) {
      s.remove(key);
      continue;
    }

    try {
      const change = JSON.parse(raw) as QueuedStatusChange;
      await tripService.updateTripStatus(
        change.tripId,
        change.status,
        change.extra
      );
      s.remove(key);
      applied++;
    } catch {
      failed++;
    }
  }

  return { applied, failed };
}

/** Clear entire status queue */
export async function clearStatusQueue(): Promise<void> {
  const s = await getStorage();
  for (const key of s.getAllKeys()) s.remove(key);
}

/** Remove expired + over-limit entries */
async function trimQueue(): Promise<void> {
  const s = await getStorage();
  const keys = s.getAllKeys();

  // Remove expired (> 24h)
  const cutoff = Date.now() - MAX_AGE_MS;
  for (const key of keys) {
    const ts = parseInt(key.split("_").pop() ?? "0", 10);
    if (ts < cutoff) s.remove(key);
  }

  // Enforce max size
  const remaining = s.getAllKeys();
  if (remaining.length > MAX_QUEUE_SIZE) {
    const sorted = remaining.sort();
    const toRemove = sorted.slice(0, remaining.length - MAX_QUEUE_SIZE);
    for (const key of toRemove) s.remove(key);
  }
}

// Auto-flush on connectivity restore (native only)
if (Platform.OS !== "web") {
  import("@react-native-community/netinfo")
    .then(({ default: NetInfo }) => {
      let wasOffline = false;
      NetInfo.addEventListener((state) => {
        const isConnected = state.isConnected ?? false;
        if (isConnected && wasOffline) {
          flushStatusQueue().catch(console.error);
        }
        wasOffline = !isConnected;
      });
    })
    .catch(() => {
      // NetInfo not available — skip auto-flush
    });
}
