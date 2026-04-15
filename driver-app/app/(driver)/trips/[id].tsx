/**
 * Driver Trip Detail — status transitions, receiver info, POD upload
 *
 * DRIVER transitions: PICKUP_PENDING, IN_TRANSIT, DELIVERED, COMPLETED,
 * EXCEPTION. NO CANCELLED.
 */
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Alert,
  Modal,
  TextInput,
  TouchableOpacity,
  Platform,
  Linking,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

let ImagePicker: typeof import("expo-image-picker") | null = null;
if (Platform.OS !== "web") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  ImagePicker = require("expo-image-picker");
}

import {
  Card,
  Button,
  StatusBadge,
  LoadingSpinner,
} from "../../../src/components";
import { colors, spacing, typography } from "../../../src/theme";
import {
  useTrip,
  useUpdateTripStatus,
  useUploadPod,
  useTripPods,
} from "../../../src/hooks/useTrips";
import { useLocationTracking } from "../../../src/hooks/useTracking";
import { formatDate, formatDistance } from "../../../src/utils/format";
import { getQueueSize } from "../../../src/services/status-queue";
import { AuthenticatedImage } from "../../../src/components/AuthenticatedImage";

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

// Valid next statuses for a DRIVER per the trip state machine
function getDriverNextStatuses(
  current: string
): { status: string; label: string; color: string }[] {
  switch (current) {
    case "ASSIGNED":
      return [
        {
          status: "PICKUP_PENDING",
          label: "Start Pickup",
          color: colors.primary600,
        },
      ];
    case "PICKUP_PENDING":
      return [
        {
          status: "IN_TRANSIT",
          label: "Confirm Pickup",
          color: colors.primary600,
        },
      ];
    case "IN_TRANSIT":
      return [
        {
          status: "DELIVERED",
          label: "Mark Delivered",
          color: colors.accent600,
        },
      ];
    // DELIVERED → COMPLETED removed — POD upload auto-completes the trip
    default:
      return [];
  }
}

function canReportException(status: string): boolean {
  return ["ASSIGNED", "PICKUP_PENDING", "IN_TRANSIT"].includes(status);
}

export default function DriverTripDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: trip, isLoading } = useTrip(id);
  const updateStatus = useUpdateTripStatus();
  const uploadPod = useUploadPod();
  const { data: pods } = useTripPods(id);

  // Task 25: GPS tracking — auto-starts on PICKUP_PENDING / IN_TRANSIT
  const { isTracking, queueSize } = useLocationTracking(trip?.id, trip?.status);

  // Delivery modal state
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [receiverName, setReceiverName] = useState("");
  const [receiverPhone, setReceiverPhone] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");

  // Exception modal
  const [showExceptionModal, setShowExceptionModal] = useState(false);
  const [exceptionReason, setExceptionReason] = useState("");

  // Offline status queue indicator
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    getQueueSize().then(setPendingCount);
  }, [trip?.status]);

  if (isLoading || !trip) {
    return <LoadingSpinner fullScreen message="Loading trip..." />;
  }

  const handleStatusChange = (newStatus: string) => {
    if (newStatus === "DELIVERED") {
      setShowDeliveryModal(true);
      return;
    }
    Alert.alert(
      "Update Status",
      `Change trip status to ${newStatus.replace(/_/g, " ")}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: () =>
            updateStatus.mutateAsync({ id: trip.id, status: newStatus }),
        },
      ]
    );
  };

  const handleDeliverySubmit = () => {
    updateStatus.mutateAsync({
      id: trip.id,
      status: "DELIVERED",
      extra: {
        receiverName: receiverName || undefined,
        receiverPhone: receiverPhone || undefined,
        deliveryNotes: deliveryNotes || undefined,
      },
    });
    setShowDeliveryModal(false);
  };

  const handleException = () => {
    if (!exceptionReason.trim()) {
      Alert.alert("Error", "Please describe the issue.");
      return;
    }
    updateStatus.mutateAsync({
      id: trip.id,
      status: "EXCEPTION",
      extra: { exceptionReason: exceptionReason.trim() } as Record<
        string,
        string
      >,
    });
    setShowExceptionModal(false);
    setExceptionReason("");
  };

  const handlePickImage = async (source: "camera" | "gallery") => {
    if (!ImagePicker) return;

    let result;
    if (source === "camera") {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permission needed", "Camera permission is required.");
        return;
      }
      result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        quality: 0.8,
      });
    } else {
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.8,
      });
    }

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    const formData = new FormData();
    formData.append("file", {
      uri: asset.uri,
      name: `pod_${trip.id}_${Date.now()}.jpg`,
      type: "image/jpeg",
    } as unknown as Blob);

    try {
      await uploadPod.mutateAsync({ tripId: trip.id, formData });
      Alert.alert("Success", "POD uploaded successfully.");
    } catch (err) {
      Alert.alert(
        "Error",
        err instanceof Error ? err.message : "Upload failed"
      );
    }
  };

  const nextStatuses = getDriverNextStatuses(trip.status);
  const showPodSection = ["IN_TRANSIT", "DELIVERED", "COMPLETED"].includes(
    trip.status
  );
  const podList = (pods ?? []) as Array<{
    id: string;
    fileName: string;
    fileUrl: string;
  }>;
  const tripTruck = trip.truck as {
    licensePlate?: string;
    truckType?: string;
  } | null;
  const tripShipper = trip.shipper as {
    name?: string;
    contactPhone?: string;
  } | null;

  return (
    <ScrollView style={styles.container}>
      {/* Status banner */}
      <View style={styles.statusBanner}>
        <StatusBadge status={trip.status} type="trip" size="md" />
        {updateStatus.isPending && (
          <Text style={styles.updating}>Updating...</Text>
        )}
      </View>

      {/* GPS tracking indicator */}
      {Platform.OS !== "web" && (
        <View style={styles.trackingBar}>
          <View
            style={[
              styles.trackingDot,
              {
                backgroundColor: isTracking ? colors.success : colors.slate300,
              },
            ]}
          />
          <Text style={styles.trackingText}>
            {isTracking ? "Tracking Active" : "Tracking Off"}
          </Text>
          {queueSize > 0 && (
            <Text style={styles.queueText}>{queueSize} queued (offline)</Text>
          )}
        </View>
      )}

      {/* Trip info */}
      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Trip Details</Text>
        <DetailRow
          label="Route"
          value={`${trip.pickupCity ?? "?"} → ${trip.deliveryCity ?? "?"}`}
        />
        <DetailRow
          label="Distance"
          value={formatDistance(trip.estimatedDistanceKm)}
        />
        {tripTruck && (
          <DetailRow label="Truck" value={tripTruck.licensePlate ?? "-"} />
        )}
        {trip.startedAt && (
          <DetailRow label="Started" value={formatDate(trip.startedAt)} />
        )}
        {trip.deliveredAt && (
          <DetailRow label="Delivered" value={formatDate(trip.deliveredAt)} />
        )}
        {trip.receiverName && (
          <DetailRow label="Receiver" value={trip.receiverName} />
        )}
      </Card>

      {/* Shipper contact */}
      {tripShipper && (
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Shipper</Text>
          <DetailRow label="Company" value={tripShipper.name ?? "-"} />
          {tripShipper.contactPhone && (
            <TouchableOpacity
              onPress={() => Linking.openURL(`tel:${tripShipper.contactPhone}`)}
              style={styles.callRow}
            >
              <Text style={styles.callText}>{tripShipper.contactPhone}</Text>
              <Ionicons
                name="call-outline"
                size={18}
                color={colors.primary600}
              />
            </TouchableOpacity>
          )}
        </Card>
      )}

      {/* Status action buttons */}
      {nextStatuses.length > 0 && (
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Actions</Text>
          {nextStatuses.map((ns) => (
            <Button
              key={ns.status}
              title={ns.label}
              onPress={() => handleStatusChange(ns.status)}
              loading={updateStatus.isPending}
              variant="primary"
              fullWidth
              size="lg"
              style={{ marginBottom: spacing.sm, backgroundColor: ns.color }}
            />
          ))}
          {canReportException(trip.status) && (
            <Button
              title="Report Exception"
              onPress={() => setShowExceptionModal(true)}
              variant="destructive"
              fullWidth
              size="md"
            />
          )}
          {pendingCount > 0 && (
            <Text style={styles.pendingText}>
              <Text style={styles.pendingCount}>{pendingCount}</Text> status
              update{pendingCount > 1 ? "s" : ""} pending — will sync when
              online
            </Text>
          )}
        </Card>
      )}

      {/* POD section */}
      {showPodSection && (
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Proof of Delivery</Text>
          {trip.status !== "COMPLETED" && Platform.OS !== "web" && (
            <View style={styles.podActions}>
              <Button
                title="Camera"
                onPress={() => handlePickImage("camera")}
                variant="primary"
                size="sm"
                icon={<Ionicons name="camera" size={16} color={colors.white} />}
              />
              <Button
                title="Gallery"
                onPress={() => handlePickImage("gallery")}
                variant="outline"
                size="sm"
                icon={
                  <Ionicons name="image" size={16} color={colors.primary600} />
                }
              />
            </View>
          )}
          {uploadPod.isPending && (
            <Text style={styles.uploading}>Uploading POD...</Text>
          )}
          {podList.length > 0 && (
            <View style={styles.podGrid}>
              {podList.map((p) => (
                <View key={p.id} style={styles.podItem}>
                  <AuthenticatedImage
                    uri={p.fileUrl}
                    style={styles.podThumb}
                    resizeMode="cover"
                  />
                  <Text style={styles.podName} numberOfLines={1}>
                    {p.fileName}
                  </Text>
                </View>
              ))}
            </View>
          )}
          {podList.length === 0 && (
            <Text style={styles.podHint}>No POD documents uploaded yet.</Text>
          )}
        </Card>
      )}

      {/* Message button */}
      <Card style={styles.card}>
        <Button
          title="Messages"
          onPress={() =>
            router.push(`/(shared)/chat/${trip.id}` as `/${string}`)
          }
          variant="outline"
          fullWidth
          icon={
            <Ionicons
              name="chatbubble-outline"
              size={16}
              color={colors.primary600}
            />
          }
        />
      </Card>

      {/* Delivery modal */}
      <Modal visible={showDeliveryModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.sectionTitle}>Delivery Info</Text>
            <Text style={styles.modalHint}>
              Optional: record who received the delivery.
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Receiver name"
              value={receiverName}
              onChangeText={setReceiverName}
              placeholderTextColor={colors.slate400}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Receiver phone"
              value={receiverPhone}
              onChangeText={setReceiverPhone}
              keyboardType="phone-pad"
              placeholderTextColor={colors.slate400}
            />
            <TextInput
              style={[styles.modalInput, { height: 80 }]}
              placeholder="Notes"
              value={deliveryNotes}
              onChangeText={setDeliveryNotes}
              multiline
              placeholderTextColor={colors.slate400}
            />
            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                onPress={() => setShowDeliveryModal(false)}
                variant="ghost"
                size="md"
              />
              <Button
                title="Mark Delivered"
                onPress={handleDeliverySubmit}
                loading={updateStatus.isPending}
                variant="primary"
                size="md"
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Exception modal */}
      <Modal visible={showExceptionModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.sectionTitle}>Report Exception</Text>
            <TextInput
              style={[styles.modalInput, { height: 100 }]}
              placeholder="Describe the issue (required)"
              value={exceptionReason}
              onChangeText={setExceptionReason}
              multiline
              placeholderTextColor={colors.slate400}
            />
            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                onPress={() => {
                  setShowExceptionModal(false);
                  setExceptionReason("");
                }}
                variant="ghost"
                size="md"
              />
              <Button
                title="Report"
                onPress={handleException}
                loading={updateStatus.isPending}
                variant="destructive"
                size="md"
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  statusBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  updating: { ...typography.bodySmall, color: colors.textTertiary },
  trackingBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    backgroundColor: colors.surfaceVariant,
  },
  trackingDot: { width: 8, height: 8, borderRadius: 4 },
  trackingText: { ...typography.labelSmall, color: colors.textSecondary },
  queueText: { ...typography.labelSmall, color: colors.warning },
  card: { marginHorizontal: spacing.lg, marginBottom: spacing.lg },
  sectionTitle: {
    ...typography.titleMedium,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  detailLabel: { ...typography.bodyMedium, color: colors.textSecondary },
  detailValue: { ...typography.bodyMedium, color: colors.textPrimary },
  callRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
  },
  callText: { ...typography.bodyMedium, color: colors.primary600 },
  podActions: {
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  uploading: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    textAlign: "center",
    marginBottom: spacing.md,
  },
  podGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  podItem: { width: 80, alignItems: "center" },
  podThumb: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: colors.slate100,
  },
  podName: {
    ...typography.labelSmall,
    color: colors.textSecondary,
    marginTop: 2,
  },
  pendingText: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    textAlign: "center",
    marginTop: spacing.md,
  },
  pendingCount: {
    color: colors.warning,
    fontWeight: "600",
  },
  podHint: { ...typography.bodySmall, color: colors.textTertiary },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: spacing["2xl"],
  },
  modalContent: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: spacing.xl,
  },
  modalHint: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    marginBottom: spacing.lg,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  modalActions: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.sm,
  },
});
