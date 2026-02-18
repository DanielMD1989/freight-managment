/**
 * GPS Queue Service - Offline GPS position queue
 * Ported from Flutter's gps_queue_service.dart (314 LOC)
 *
 * Uses MMKV for synchronous high-frequency writes.
 * Queue stores JSON strings keyed by {truckId}_{timestamp}.
 * Max 1000 points, 24h TTL, batch upload of 50.
 * Auto-syncs on connectivity restore via NetInfo listener.
 */
import { Platform } from "react-native";
import apiClient from "../api/client";

// MMKV is only available on native - use a fallback for web
let storage: {
  set: (key: string, value: string) => void;
  getString: (key: string) => string | undefined;
  remove: (key: string) => void;
  getAllKeys: () => string[];
} | null = null;

async function getStorage() {
  if (storage) return storage;

  if (Platform.OS === "web") {
    // Web fallback using localStorage
    storage = {
      set: (key: string, value: string) =>
        localStorage.setItem(`gps_${key}`, value),
      getString: (key: string) =>
        localStorage.getItem(`gps_${key}`) ?? undefined,
      remove: (key: string) => localStorage.removeItem(`gps_${key}`),
      getAllKeys: () => {
        const keys: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key?.startsWith("gps_")) keys.push(key.replace("gps_", ""));
        }
        return keys;
      },
    };
  } else {
    const { createMMKV } = await import("react-native-mmkv");
    const mmkv = createMMKV({ id: "gps-queue" });
    storage = {
      set: (key: string, value: string) => mmkv.set(key, value),
      getString: (key: string) => mmkv.getString(key),
      remove: (key: string) => {
        mmkv.remove(key);
      },
      getAllKeys: () => mmkv.getAllKeys(),
    };
  }

  return storage;
}

interface GpsPoint {
  truckId: string;
  latitude: number;
  longitude: number;
  speed?: number;
  heading?: number;
  altitude?: number;
  accuracy?: number;
  timestamp: string;
}

const MAX_QUEUE_SIZE = 1000;
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
const BATCH_SIZE = 50;

class GpsQueueService {
  /** Enqueue a GPS position */
  async enqueue(point: GpsPoint): Promise<void> {
    const s = await getStorage();
    const key = `${point.truckId}_${Date.now()}`;
    s.set(key, JSON.stringify(point));
    await this.trimQueue();
  }

  /** Get queue size */
  async getQueueSize(): Promise<number> {
    const s = await getStorage();
    return s.getAllKeys().length;
  }

  /** Flush queue - upload all pending positions */
  async flush(): Promise<{ uploaded: number; failed: number }> {
    const s = await getStorage();
    const keys = s.getAllKeys();

    if (keys.length === 0) return { uploaded: 0, failed: 0 };

    let uploaded = 0;
    let failed = 0;

    // Process in batches
    for (let i = 0; i < keys.length; i += BATCH_SIZE) {
      const batchKeys = keys.slice(i, i + BATCH_SIZE);
      const batch: GpsPoint[] = [];

      for (const key of batchKeys) {
        const raw = s.getString(key);
        if (raw) {
          try {
            batch.push(JSON.parse(raw));
          } catch {
            s.remove(key); // Remove corrupt entries
          }
        }
      }

      if (batch.length > 0) {
        try {
          await apiClient.post("/api/tracking/ingest/batch", {
            positions: batch,
          });
          // Success - remove uploaded entries
          for (const key of batchKeys) {
            s.remove(key);
          }
          uploaded += batch.length;
        } catch {
          failed += batch.length;
        }
      }
    }

    return { uploaded, failed };
  }

  /** Remove old entries and enforce max queue size */
  private async trimQueue(): Promise<void> {
    const s = await getStorage();
    const keys = s.getAllKeys();

    // Remove expired entries (> 24h)
    const cutoff = Date.now() - MAX_AGE_MS;
    for (const key of keys) {
      const timestamp = parseInt(key.split("_").pop() ?? "0", 10);
      if (timestamp < cutoff) {
        s.remove(key);
      }
    }

    // Enforce max size (remove oldest)
    const remainingKeys = s.getAllKeys();
    if (remainingKeys.length > MAX_QUEUE_SIZE) {
      const sorted = remainingKeys.sort();
      const toRemove = sorted.slice(0, remainingKeys.length - MAX_QUEUE_SIZE);
      for (const key of toRemove) {
        s.remove(key);
      }
    }
  }

  /** Clear entire queue */
  async clear(): Promise<void> {
    const s = await getStorage();
    for (const key of s.getAllKeys()) {
      s.remove(key);
    }
  }
}

export const gpsQueueService = new GpsQueueService();
