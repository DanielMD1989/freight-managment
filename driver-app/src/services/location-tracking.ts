/**
 * Background Location Tracking Service — Driver App
 *
 * Sends phone-based GPS to POST /api/trips/{tripId}/gps while the
 * driver has an active trip. Uses expo-location background task +
 * expo-task-manager.
 *
 * - 30s interval, 50m distance filter (matches backend rate limit)
 * - Queues positions offline via gps-queue when network fails
 * - Only runs on iOS/Android — web is a no-op
 */
import { Platform } from "react-native";
import { driverGpsService, type DriverGpsPoint } from "./driver-gps";

// Lazy-load native-only modules to avoid web crashes
let Location: typeof import("expo-location") | null = null;
let TaskManager: typeof import("expo-task-manager") | null = null;

if (Platform.OS !== "web") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Location = require("expo-location");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  TaskManager = require("expo-task-manager");
}

const BACKGROUND_LOCATION_TASK = "driver-background-location";
const LOCATION_INTERVAL_MS = 30_000; // 30 seconds
const LOCATION_DISTANCE_FILTER = 50; // 50 meters

let activeTripId: string | null = null;
// Lazy import to avoid circular deps at module level
let queuePositionFn:
  | ((tripId: string, point: DriverGpsPoint) => Promise<void>)
  | null = null;

async function getQueueFn() {
  if (!queuePositionFn) {
    const { queuePosition } = await import("./gps-queue");
    queuePositionFn = queuePosition;
  }
  return queuePositionFn;
}

// Define background task at module level (required by expo-task-manager)
if (TaskManager) {
  TaskManager.defineTask(
    BACKGROUND_LOCATION_TASK,
    async ({ data, error }: { data: unknown; error: unknown }) => {
      if (error) {
        console.error("Background location error:", error);
        return;
      }
      if (!data || !activeTripId) return;

      const { locations } = data as {
        locations: Array<{
          coords: {
            latitude: number;
            longitude: number;
            speed: number | null;
            heading: number | null;
            altitude: number | null;
            accuracy: number | null;
          };
          timestamp: number;
        }>;
      };

      for (const location of locations) {
        const point: DriverGpsPoint = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          speed: location.coords.speed ?? undefined,
          heading: location.coords.heading ?? undefined,
          altitude: location.coords.altitude ?? undefined,
          accuracy: location.coords.accuracy ?? undefined,
          timestamp: new Date(location.timestamp).toISOString(),
        };

        try {
          await driverGpsService.sendPosition(activeTripId, point);
        } catch {
          // Network failure — queue for later
          try {
            const queue = await getQueueFn();
            await queue(activeTripId, point);
          } catch {
            // Last resort: silently drop (MMKV might not be available)
          }
        }
      }
    }
  );
}

/** Request foreground + background location permissions */
export async function requestLocationPermissions(): Promise<boolean> {
  if (!Location) return false;

  const { status: foreground } =
    await Location.requestForegroundPermissionsAsync();
  if (foreground !== "granted") return false;

  const { status: background } =
    await Location.requestBackgroundPermissionsAsync();
  return background === "granted";
}

/** Start background location tracking for a trip */
export async function startTracking(tripId: string): Promise<boolean> {
  if (!Location || Platform.OS === "web") return false;

  const permitted = await requestLocationPermissions();
  if (!permitted) return false;

  // Stop any existing tracking first
  await stopTracking();

  activeTripId = tripId;

  try {
    await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: LOCATION_INTERVAL_MS,
      distanceInterval: LOCATION_DISTANCE_FILTER,
      deferredUpdatesInterval: LOCATION_INTERVAL_MS,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: "FreightET Driver",
        notificationBody: "Tracking your trip location",
        notificationColor: "#0EA5E9",
      },
    });
    return true;
  } catch (err) {
    console.error("Failed to start location tracking:", err);
    activeTripId = null;
    return false;
  }
}

/** Stop background location tracking */
export async function stopTracking(): Promise<void> {
  if (!Location || !TaskManager || Platform.OS === "web") return;

  activeTripId = null;

  try {
    const isRunning = await TaskManager.isTaskRegisteredAsync(
      BACKGROUND_LOCATION_TASK
    );
    if (isRunning) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    }
  } catch {
    // Task may not be running — that's fine
  }
}

/** Check if tracking is currently active */
export function isTracking(): boolean {
  return activeTripId !== null;
}

/** Get the currently-tracked trip ID */
export function getActiveTripId(): string | null {
  return activeTripId;
}
