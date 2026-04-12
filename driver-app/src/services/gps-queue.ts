/**
 * GPS Queue Service — offline position storage for driver app
 *
 * Adapted from mobile/src/services/gps-queue.ts. Key differences:
 * - Keyed by {tripId}_{timestamp} (not truckId)
 * - Flushes individual positions to /api/trips/{tripId}/gps (not batch)
 * - Auto-flush on connectivity restore via NetInfo listener
 *
 * Uses MMKV for synchronous high-frequency writes on native,
 * localStorage fallback on web.
 */
import { Platform } from "react-native";
import { driverGpsService, type DriverGpsPoint } from "./driver-gps";

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
      set: (key, value) => localStorage.setItem(`dq_${key}`, value),
      getString: (key) => localStorage.getItem(`dq_${key}`) ?? undefined,
      remove: (key) => localStorage.removeItem(`dq_${key}`),
      getAllKeys: () => {
        const keys: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k?.startsWith("dq_")) keys.push(k.replace("dq_", ""));
        }
        return keys;
      },
    };
  } else {
    const { createMMKV } = await import("react-native-mmkv");
    const mmkv = createMMKV({ id: "driver-gps-queue" });
    storage = {
      set: (key, value) => mmkv.set(key, value),
      getString: (key) => mmkv.getString(key),
      remove: (key) => mmkv.remove(key),
      getAllKeys: () => mmkv.getAllKeys(),
    };
  }

  return storage;
}

interface QueuedPoint {
  tripId: string;
  point: DriverGpsPoint;
}

const MAX_QUEUE_SIZE = 1000;
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

/** Enqueue a GPS position for later upload */
export async function queuePosition(
  tripId: string,
  point: DriverGpsPoint
): Promise<void> {
  const s = await getStorage();
  const key = `${tripId}_${Date.now()}`;
  s.set(key, JSON.stringify({ tripId, point }));
  await trimQueue();
}

/** Get count of queued positions */
export async function getQueueSize(): Promise<number> {
  const s = await getStorage();
  return s.getAllKeys().length;
}

/** Upload all pending positions. Called on connectivity restore. */
export async function flushQueue(): Promise<{
  uploaded: number;
  failed: number;
}> {
  const s = await getStorage();
  const keys = s.getAllKeys();

  if (keys.length === 0) return { uploaded: 0, failed: 0 };

  let uploaded = 0;
  let failed = 0;

  for (const key of keys) {
    const raw = s.getString(key);
    if (!raw) {
      s.remove(key);
      continue;
    }

    try {
      const { tripId, point } = JSON.parse(raw) as QueuedPoint;
      await driverGpsService.sendPosition(tripId, point);
      s.remove(key);
      uploaded++;
    } catch {
      failed++;
    }
  }

  return { uploaded, failed };
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

/** Clear entire queue */
export async function clearQueue(): Promise<void> {
  const s = await getStorage();
  for (const key of s.getAllKeys()) s.remove(key);
}

// Auto-flush on connectivity restore (native only)
if (Platform.OS !== "web") {
  import("@react-native-community/netinfo")
    .then(({ default: NetInfo }) => {
      let wasOffline = false;
      NetInfo.addEventListener((state) => {
        const isConnected = state.isConnected ?? false;
        if (isConnected && wasOffline) {
          flushQueue().catch(console.error);
        }
        wasOffline = !isConnected;
      });
    })
    .catch(() => {
      // NetInfo not available — skip auto-flush
    });
}
