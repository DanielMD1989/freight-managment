/**
 * Carrier Trip Details Screen
 * Shows trip info, state machine action buttons, POD upload, receiver info modal
 */
import React, { useState } from "react";
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
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import {
  useTrip,
  useUpdateTripStatus,
  useCancelTrip,
  useUploadPod,
  useTripPods,
} from "../../../src/hooks/useTrips";
import { Card } from "../../../src/components/Card";
import { Button } from "../../../src/components/Button";
import { StatusBadge } from "../../../src/components/StatusBadge";
import { LoadingSpinner } from "../../../src/components/LoadingSpinner";
import {
  getValidNextTripStatuses,
  canCancelTrip,
} from "../../../src/utils/foundation-rules";
import {
  formatDate,
  formatDistance,
  formatTripStatus,
} from "../../../src/utils/format";
import { colors } from "../../../src/theme/colors";
import { spacing } from "../../../src/theme/spacing";
import { typography } from "../../../src/theme/typography";
import type { TripStatus } from "../../../src/types";

export default function CarrierTripDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: trip, isLoading } = useTrip(id);
  const updateStatus = useUpdateTripStatus();
  const cancelTrip = useCancelTrip();
  const uploadPod = useUploadPod();
  const { data: pods } = useTripPods(id);

  // Receiver info modal state
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [receiverName, setReceiverName] = useState("");
  const [receiverPhone, setReceiverPhone] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");

  if (isLoading || !trip) return <LoadingSpinner fullScreen />;

  const validNextStatuses = getValidNextTripStatuses(trip.status as TripStatus);
  const canCancel = canCancelTrip(trip.status as TripStatus);
  const isDelivered = trip.status === "DELIVERED";
  const podSubmitted = trip.load?.podSubmitted;
  const podVerified = trip.load?.podVerified;

  const handleStatusChange = (newStatus: string) => {
    // For DELIVERED, show the receiver info modal instead of direct confirm
    if (newStatus === "DELIVERED") {
      setShowDeliveryModal(true);
      return;
    }

    Alert.alert(
      "Update Status",
      `Change trip status to ${formatTripStatus(newStatus)}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: () => {
            updateStatus.mutate(
              { id: id!, status: newStatus },
              { onError: (err) => Alert.alert("Error", err.message) }
            );
          },
        },
      ]
    );
  };

  const handleDeliveryConfirm = () => {
    updateStatus.mutate(
      {
        id: id!,
        status: "DELIVERED",
        extra: {
          ...(receiverName.trim() ? { receiverName: receiverName.trim() } : {}),
          ...(receiverPhone.trim()
            ? { receiverPhone: receiverPhone.trim() }
            : {}),
          ...(deliveryNotes.trim()
            ? { deliveryNotes: deliveryNotes.trim() }
            : {}),
        },
      },
      {
        onSuccess: () => {
          setShowDeliveryModal(false);
          setReceiverName("");
          setReceiverPhone("");
          setDeliveryNotes("");
        },
        onError: (err) => Alert.alert("Error", err.message),
      }
    );
  };

  const handleCancel = () => {
    Alert.alert("Cancel Trip", "Are you sure you want to cancel this trip?", [
      { text: "Back", style: "cancel" },
      {
        text: "Cancel Trip",
        style: "destructive",
        onPress: () => {
          cancelTrip.mutate(
            { id: id!, reason: "Cancelled by carrier" },
            { onError: (err: Error) => Alert.alert("Error", err.message) }
          );
        },
      },
    ]);
  };

  const handleUploadPod = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      const formData = new FormData();
      formData.append("file", {
        uri: asset.uri,
        name: asset.fileName ?? `pod_${Date.now()}.jpg`,
        type: asset.mimeType ?? "image/jpeg",
      } as unknown as Blob);

      uploadPod.mutate(
        { tripId: id!, formData },
        {
          onSuccess: () => Alert.alert("Success", "POD uploaded successfully"),
          onError: (err) =>
            Alert.alert("Error", err.message ?? "Upload failed"),
        }
      );
    } catch {
      Alert.alert("Error", "Could not pick image");
    }
  };

  const handleTakePhoto = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          "Permission Required",
          "Camera access is needed to take POD photos"
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      const formData = new FormData();
      formData.append("file", {
        uri: asset.uri,
        name: `pod_${Date.now()}.jpg`,
        type: "image/jpeg",
      } as unknown as Blob);

      uploadPod.mutate(
        { tripId: id!, formData },
        {
          onSuccess: () => Alert.alert("Success", "POD uploaded successfully"),
          onError: (err) =>
            Alert.alert("Error", err.message ?? "Upload failed"),
        }
      );
    } catch {
      Alert.alert("Error", "Could not take photo");
    }
  };

  const statusActionMap: Record<
    string,
    { label: string; icon: keyof typeof Ionicons.glyphMap }
  > = {
    PICKUP_PENDING: { label: "Start Trip", icon: "play-circle" },
    IN_TRANSIT: { label: "Mark Picked Up", icon: "checkmark-circle" },
    DELIVERED: { label: "Mark Delivered", icon: "flag" },
  };

  return (
    <>
      <ScrollView style={styles.container}>
        {/* Header */}
        <Card style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.route}>
              {trip.pickupCity ?? "N/A"} → {trip.deliveryCity ?? "N/A"}
            </Text>
            <StatusBadge status={trip.status} type="trip" size="md" />
          </View>
        </Card>

        {/* Details */}
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Trip Details</Text>
          {trip.startedAt && (
            <DetailRow label="Started" value={formatDate(trip.startedAt)} />
          )}
          {trip.pickedUpAt && (
            <DetailRow label="Picked Up" value={formatDate(trip.pickedUpAt)} />
          )}
          {trip.deliveredAt && (
            <DetailRow label="Delivered" value={formatDate(trip.deliveredAt)} />
          )}
          <DetailRow
            label="Distance"
            value={formatDistance(trip.estimatedDistanceKm)}
          />
          {trip.truck && (
            <DetailRow label="Truck" value={trip.truck.licensePlate ?? "N/A"} />
          )}
          {trip.receiverName && (
            <DetailRow label="Receiver" value={trip.receiverName} />
          )}
          {trip.receiverPhone && (
            <DetailRow label="Receiver Phone" value={trip.receiverPhone} />
          )}
        </Card>

        {/* POD Status */}
        {(isDelivered || podSubmitted) && (
          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Proof of Delivery</Text>
            <View style={styles.podStatusRow}>
              <View style={styles.podBadge}>
                <Ionicons
                  name={podSubmitted ? "checkmark-circle" : "ellipse-outline"}
                  size={18}
                  color={podSubmitted ? colors.success : colors.slate400}
                />
                <Text
                  style={[
                    styles.podBadgeText,
                    podSubmitted && { color: colors.success },
                  ]}
                >
                  POD Submitted
                </Text>
              </View>
              <View style={styles.podBadge}>
                <Ionicons
                  name={podVerified ? "shield-checkmark" : "ellipse-outline"}
                  size={18}
                  color={podVerified ? colors.success : colors.slate400}
                />
                <Text
                  style={[
                    styles.podBadgeText,
                    podVerified && { color: colors.success },
                  ]}
                >
                  POD Verified
                </Text>
              </View>
            </View>

            {/* Uploaded PODs list */}
            {pods && pods.length > 0 && (
              <View style={styles.podList}>
                {pods.map((pod) => (
                  <View key={pod.id} style={styles.podItem}>
                    <Ionicons
                      name="image-outline"
                      size={20}
                      color={colors.primary500}
                    />
                    <View style={styles.podItemInfo}>
                      <Text style={styles.podFileName} numberOfLines={1}>
                        {pod.fileName}
                      </Text>
                      <Text style={styles.podMeta}>
                        {formatDate(pod.uploadedAt)}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Upload POD buttons */}
            {isDelivered && (
              <View style={styles.podActions}>
                <Button
                  title="Upload POD Image"
                  variant="primary"
                  size="md"
                  fullWidth
                  onPress={handleUploadPod}
                  loading={uploadPod.isPending}
                  icon={
                    <Ionicons
                      name="image-outline"
                      size={18}
                      color={colors.white}
                    />
                  }
                />
                {Platform.OS !== "web" && (
                  <Button
                    title="Take Photo"
                    variant="outline"
                    size="md"
                    fullWidth
                    onPress={handleTakePhoto}
                    loading={uploadPod.isPending}
                    icon={
                      <Ionicons
                        name="camera-outline"
                        size={18}
                        color={colors.primary600}
                      />
                    }
                    style={{ marginTop: spacing.sm }}
                  />
                )}
              </View>
            )}
          </Card>
        )}

        {/* Action Buttons */}
        {validNextStatuses.length > 0 && (
          <View style={styles.actions}>
            {validNextStatuses
              .filter((s) => s !== "CANCELLED")
              .map((status) => {
                const action = statusActionMap[status];
                return (
                  <Button
                    key={status}
                    title={action?.label ?? formatTripStatus(status)}
                    onPress={() => handleStatusChange(status)}
                    loading={updateStatus.isPending}
                    fullWidth
                    size="lg"
                    icon={
                      action ? (
                        <Ionicons
                          name={action.icon}
                          size={20}
                          color={colors.white}
                        />
                      ) : undefined
                    }
                  />
                );
              })}

            {canCancel && (
              <Button
                title="Cancel Trip"
                onPress={handleCancel}
                variant="destructive"
                loading={cancelTrip.isPending}
                fullWidth
                size="md"
                style={{ marginTop: spacing.sm }}
              />
            )}
          </View>
        )}

        <View style={{ height: spacing["3xl"] }} />
      </ScrollView>

      {/* Delivery Info Modal */}
      <Modal
        visible={showDeliveryModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowDeliveryModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Delivery Details</Text>
              <TouchableOpacity onPress={() => setShowDeliveryModal(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalDescription}>
              Enter receiver information to mark this trip as delivered.
            </Text>

            <Text style={styles.inputLabel}>Receiver Name</Text>
            <TextInput
              style={styles.input}
              value={receiverName}
              onChangeText={setReceiverName}
              placeholder="e.g. Dawit G."
              placeholderTextColor={colors.slate400}
            />

            <Text style={styles.inputLabel}>Receiver Phone</Text>
            <TextInput
              style={styles.input}
              value={receiverPhone}
              onChangeText={setReceiverPhone}
              placeholder="e.g. +251933333333"
              placeholderTextColor={colors.slate400}
              keyboardType="phone-pad"
            />

            <Text style={styles.inputLabel}>Delivery Notes (optional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={deliveryNotes}
              onChangeText={setDeliveryNotes}
              placeholder="Any notes about the delivery..."
              placeholderTextColor={colors.slate400}
              multiline
              numberOfLines={3}
            />

            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                variant="outline"
                size="md"
                onPress={() => setShowDeliveryModal(false)}
                style={{ flex: 1 }}
              />
              <Button
                title="Mark Delivered"
                variant="primary"
                size="md"
                onPress={handleDeliveryConfirm}
                loading={updateStatus.isPending}
                style={{ flex: 1 }}
                icon={<Ionicons name="flag" size={18} color={colors.white} />}
              />
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  card: { margin: spacing.lg, marginBottom: 0 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  route: { ...typography.headlineSmall, color: colors.textPrimary, flex: 1 },
  sectionTitle: {
    ...typography.titleMedium,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate100,
  },
  detailLabel: { ...typography.bodyMedium, color: colors.textSecondary },
  detailValue: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: "500",
  },
  actions: { padding: spacing.lg, gap: spacing.md },

  // POD styles
  podStatusRow: {
    flexDirection: "row",
    gap: spacing.lg,
    marginBottom: spacing.md,
  },
  podBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  podBadgeText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  podList: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  podItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate100,
  },
  podItemInfo: { flex: 1 },
  podFileName: {
    ...typography.bodySmall,
    color: colors.textPrimary,
  },
  podMeta: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    fontSize: 11,
  },
  podActions: {
    marginTop: spacing.sm,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing["2xl"],
    paddingBottom: spacing["3xl"],
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  modalTitle: {
    ...typography.titleLarge,
    color: colors.textPrimary,
  },
  modalDescription: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  inputLabel: {
    ...typography.labelMedium,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  input: {
    backgroundColor: colors.slate50,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  modalActions: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing["2xl"],
  },
});
