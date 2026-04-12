/**
 * Location tracking hook for driver trip screens.
 *
 * Auto-starts tracking when trip is PICKUP_PENDING or IN_TRANSIT,
 * auto-stops on DELIVERED/COMPLETED/CANCELLED/EXCEPTION.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { Platform } from "react-native";
import {
  startTracking,
  stopTracking,
  isTracking as checkIsTracking,
} from "../services/location-tracking";
import { getQueueSize, flushQueue } from "../services/gps-queue";

const ACTIVE_TRACKING_STATUSES = ["PICKUP_PENDING", "IN_TRANSIT"];

export function useLocationTracking(
  tripId: string | undefined,
  tripStatus: string | undefined
) {
  const [trackingActive, setTrackingActive] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(
    null
  );
  const [queueSize, setQueueSize] = useState(0);
  const prevStatusRef = useRef<string | undefined>(undefined);

  // Sync tracking state with trip status changes
  useEffect(() => {
    if (Platform.OS === "web" || !tripId || !tripStatus) return;

    const shouldTrack = ACTIVE_TRACKING_STATUSES.includes(tripStatus);
    const wasTracking = ACTIVE_TRACKING_STATUSES.includes(
      prevStatusRef.current ?? ""
    );
    prevStatusRef.current = tripStatus;

    if (shouldTrack && !wasTracking) {
      // Status changed to trackable — start
      startTracking(tripId).then((ok) => {
        setTrackingActive(ok);
        setPermissionGranted(ok);
        if (ok) {
          // Flush any queued positions from before
          flushQueue().catch(() => {});
        }
      });
    } else if (!shouldTrack && wasTracking) {
      // Status changed to non-trackable — stop
      stopTracking().then(() => setTrackingActive(false));
    } else if (shouldTrack) {
      // Already tracking — just sync state
      setTrackingActive(checkIsTracking());
    }
  }, [tripId, tripStatus]);

  // Poll queue size every 10s when tracking
  useEffect(() => {
    if (!trackingActive) return;
    const poll = () =>
      getQueueSize()
        .then(setQueueSize)
        .catch(() => {});
    poll();
    const interval = setInterval(poll, 10_000);
    return () => clearInterval(interval);
  }, [trackingActive]);

  const manualStart = useCallback(async () => {
    if (!tripId) return;
    const ok = await startTracking(tripId);
    setTrackingActive(ok);
    setPermissionGranted(ok);
  }, [tripId]);

  const manualStop = useCallback(async () => {
    await stopTracking();
    setTrackingActive(false);
  }, []);

  return {
    isTracking: trackingActive,
    permissionGranted,
    queueSize,
    startTracking: manualStart,
    stopTracking: manualStop,
  };
}
