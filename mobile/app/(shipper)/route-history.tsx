/**
 * Shipper Route History Screen
 * G-M27-2: Shows completed trip route on a map with Polyline + stats.
 * Blueprint §3: "Route history: Once trip completed, shipper can view full route."
 */
import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Dimensions,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

// react-native-maps only works on iOS/Android — same pattern as map.tsx
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let MapView: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Polyline: any = null;
if (Platform.OS !== "web") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Maps = require("react-native-maps");
  MapView = Maps.default;
  Polyline = Maps.Polyline;
}

import apiClient from "../../src/api/client";
import { Card } from "../../src/components/Card";
import { Button } from "../../src/components/Button";
import { colors } from "../../src/theme/colors";
import { spacing, borderRadius } from "../../src/theme/spacing";
import { typography } from "../../src/theme/typography";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

interface GpsPoint {
  id: string;
  lat: number;
  lng: number;
  speed: number | null;
  heading: number | null;
  timestamp: string;
}

interface RouteStats {
  totalDistanceKm: number;
  totalTimeHours: number;
  avgSpeedKmh: number;
  startTime: string | null;
  endTime: string | null;
}

interface HistoryData {
  positions: GpsPoint[];
  count: number;
  stats: RouteStats;
}

export default function RouteHistoryScreen() {
  const { loadId } = useLocalSearchParams<{ loadId: string }>();
  const router = useRouter();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);

  const [data, setData] = useState<HistoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loadId) {
      setError("No load ID provided");
      setLoading(false);
      return;
    }

    apiClient
      .get(`/api/gps/history?loadId=${loadId}`)
      .then((res) => {
        setData(res.data);
      })
      .catch((err) => {
        setError(err.response?.data?.error || "Failed to load route history");
      })
      .finally(() => setLoading(false));
  }, [loadId]);

  // Fit map to show entire route once data loads
  useEffect(() => {
    if (
      data &&
      data.positions.length > 1 &&
      mapRef.current &&
      Platform.OS !== "web"
    ) {
      const coords = data.positions.map((p) => ({
        latitude: p.lat,
        longitude: p.lng,
      }));
      setTimeout(() => {
        mapRef.current?.fitToCoordinates(coords, {
          edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
          animated: true,
        });
      }, 500);
    }
  }, [data]);

  const formatDateTime = (iso: string | null) => {
    if (!iso) return "N/A";
    return new Date(iso).toLocaleString();
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary500} />
        <Text style={styles.loadingText}>Loading route history...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle" size={48} color={colors.error} />
        <Text style={styles.errorText}>{error}</Text>
        <Button
          title="Go Back"
          onPress={() => router.back()}
          variant="outline"
          size="md"
          style={{ marginTop: spacing.lg }}
        />
      </View>
    );
  }

  if (!data || data.count === 0) {
    return (
      <View style={styles.centered}>
        <Ionicons name="map-outline" size={48} color={colors.textTertiary} />
        <Text style={styles.emptyText}>
          No GPS data recorded for this trip.
        </Text>
        <Button
          title="Go Back"
          onPress={() => router.back()}
          variant="outline"
          size="md"
          style={{ marginTop: spacing.lg }}
        />
      </View>
    );
  }

  const coordinates = data.positions.map((p) => ({
    latitude: p.lat,
    longitude: p.lng,
  }));

  const startPoint = coordinates[0];
  const endPoint = coordinates[coordinates.length - 1];

  return (
    <ScrollView style={styles.container}>
      {/* Map */}
      {Platform.OS !== "web" && MapView ? (
        <View style={styles.mapContainer}>
          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={{
              latitude: startPoint.latitude,
              longitude: startPoint.longitude,
              latitudeDelta: 2,
              longitudeDelta: 2,
            }}
          >
            {Polyline && (
              <Polyline
                coordinates={coordinates}
                strokeColor="#0ea5e9"
                strokeWidth={3}
              />
            )}
          </MapView>
        </View>
      ) : (
        <View style={styles.webFallback}>
          <Ionicons name="map-outline" size={32} color={colors.textTertiary} />
          <Text style={styles.webFallbackText}>
            Map not available on web. View stats below.
          </Text>
        </View>
      )}

      {/* Stats */}
      <Card style={styles.statsCard}>
        <Text style={styles.sectionTitle}>Trip Statistics</Text>
        <View style={styles.statsGrid}>
          <StatBox
            value={data.stats.totalDistanceKm.toFixed(1)}
            label="km traveled"
            color={colors.primary600}
            bgColor={colors.primary50}
          />
          <StatBox
            value={data.stats.totalTimeHours.toFixed(1)}
            label="hours"
            color="#6366f1"
            bgColor="#eef2ff"
          />
          <StatBox
            value={data.stats.avgSpeedKmh.toFixed(0)}
            label="avg km/h"
            color="#059669"
            bgColor="#ecfdf5"
          />
          <StatBox
            value={String(data.count)}
            label="GPS points"
            color="#d97706"
            bgColor="#fffbeb"
          />
        </View>

        <View style={styles.timeRow}>
          <View style={styles.timeItem}>
            <Text style={styles.timeLabel}>Start</Text>
            <Text style={styles.timeValue}>
              {formatDateTime(data.stats.startTime)}
            </Text>
          </View>
          <View style={styles.timeItem}>
            <Text style={styles.timeLabel}>End</Text>
            <Text style={styles.timeValue}>
              {formatDateTime(data.stats.endTime)}
            </Text>
          </View>
        </View>
      </Card>

      <View style={{ height: spacing["3xl"] }} />
    </ScrollView>
  );
}

function StatBox({
  value,
  label,
  color,
  bgColor,
}: {
  value: string;
  label: string;
  color: string;
  bgColor: string;
}) {
  return (
    <View style={[styles.statBox, { backgroundColor: bgColor }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={[styles.statLabel, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing["2xl"],
    backgroundColor: colors.background,
  },
  loadingText: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  errorText: {
    ...typography.bodyMedium,
    color: colors.error,
    marginTop: spacing.md,
    textAlign: "center",
  },
  emptyText: {
    ...typography.bodyMedium,
    color: colors.textTertiary,
    marginTop: spacing.md,
    textAlign: "center",
  },
  mapContainer: {
    height: SCREEN_HEIGHT * 0.4,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate100,
  },
  map: { flex: 1 },
  webFallback: {
    height: 120,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.slate50,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate100,
    gap: spacing.sm,
  },
  webFallbackText: {
    ...typography.bodySmall,
    color: colors.textTertiary,
  },
  statsCard: {
    margin: spacing.lg,
  },
  sectionTitle: {
    ...typography.titleMedium,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  statBox: {
    flex: 1,
    minWidth: "45%",
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    alignItems: "center",
  },
  statValue: {
    ...typography.headlineSmall,
    fontWeight: "700",
  },
  statLabel: {
    ...typography.labelSmall,
    marginTop: 2,
  },
  timeRow: {
    flexDirection: "row",
    marginTop: spacing.lg,
    gap: spacing.lg,
  },
  timeItem: { flex: 1 },
  timeLabel: {
    ...typography.labelSmall,
    color: colors.textTertiary,
    marginBottom: 2,
  },
  timeValue: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
});
