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
  Linking,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  useTrip,
  useUpdateTripStatus,
  useCancelTrip,
  useTripPods,
} from "../../../src/hooks/useTrips";
import { useTripRatings } from "../../../src/hooks/useRatings";
import {
  useDrivers,
  useAssignDriver,
  useUnassignDriver,
} from "../../../src/hooks/useDrivers";
import RatingModal from "../../../src/components/RatingModal";
import { Card } from "../../../src/components/Card";
import { Button } from "../../../src/components/Button";
import { StatusBadge } from "../../../src/components/StatusBadge";
import { LoadingSpinner } from "../../../src/components/LoadingSpinner";
import {
  getValidNextTripStatuses,
  canCancelTrip,
} from "../../../src/utils/foundation-rules";
import {
  formatCurrency,
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
  const router = useRouter();
  const { data: trip, isLoading, refetch } = useTrip(id);
  const updateStatus = useUpdateTripStatus();
  const cancelTrip = useCancelTrip();
  const { data: pods } = useTripPods(id);

  // Task 22: driver assignment
  const assignDriver = useAssignDriver();
  const unassignDriver = useUnassignDriver();
  const canAssign =
    trip?.status === "ASSIGNED" || trip?.status === "PICKUP_PENDING";
  const { data: driversData } = useDrivers(
    canAssign ? { available: "true", status: "ACTIVE", limit: 50 } : undefined
  );
  const [showDriverPicker, setShowDriverPicker] = useState(false);

  // Receiver info modal state
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [receiverName, setReceiverName] = useState("");
  const [receiverPhone, setReceiverPhone] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [showRatingModal, setShowRatingModal] = useState(false);

  // §12: load existing trip ratings to know whether the carrier has already rated
  const { data: ratingsData } = useTripRatings(id);
  const myRating = ratingsData?.myRating ?? null;

  if (isLoading || !trip) return <LoadingSpinner fullScreen />;

  const validNextStatuses = getValidNextTripStatuses(trip.status as TripStatus);
  const canCancel = canCancelTrip(trip.status as TripStatus);
  const isDelivered = trip.status === "DELIVERED";
  const isException = trip.status === "EXCEPTION";
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

  const statusActionMap: Record<
    string,
    { label: string; icon: keyof typeof Ionicons.glyphMap }
  > = {
    PICKUP_PENDING: { label: "Start Trip", icon: "play-circle" },
    IN_TRANSIT: { label: "Mark Picked Up", icon: "checkmark-circle" },
    DELIVERED: { label: "Mark Delivered", icon: "flag" },
    EXCEPTION: { label: "Report Exception", icon: "warning" },
    ASSIGNED: { label: "Re-assign", icon: "refresh-circle" },
    // COMPLETED removed — POD upload auto-completes the trip (driver-only)
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

        {/* Rate Shipper CTA — Blueprint §12 */}
        {(trip.status === "DELIVERED" || trip.status === "COMPLETED") && (
          <Card style={styles.card}>
            {myRating ? (
              <View>
                <Text style={styles.sectionTitle}>Your Rating</Text>
                <View style={styles.ratingRow}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Ionicons
                      key={s}
                      name={s <= myRating.stars ? "star" : "star-outline"}
                      size={20}
                      color="#F59E0B"
                    />
                  ))}
                </View>
                {myRating.comment && (
                  <Text style={styles.ratingComment}>{myRating.comment}</Text>
                )}
              </View>
            ) : (
              <Button
                title="Rate Shipper"
                variant="primary"
                onPress={() => setShowRatingModal(true)}
                icon={<Ionicons name="star-outline" size={18} color="#fff" />}
              />
            )}
          </Card>
        )}

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
          {trip.driver ? (
            <DetailRow
              label="Driver"
              value={
                [trip.driver.firstName, trip.driver.lastName]
                  .filter(Boolean)
                  .join(" ") || "—"
              }
            />
          ) : (
            <DetailRow label="Driver" value="Unassigned" />
          )}
          {trip.receiverName && (
            <DetailRow label="Receiver" value={trip.receiverName} />
          )}
          {trip.receiverPhone && (
            <DetailRow label="Receiver Phone" value={trip.receiverPhone} />
          )}
        </Card>

        {/* Driver Assignment — Task 22 */}
        {canAssign && (
          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Driver Assignment</Text>
            {trip.driver ? (
              <>
                <DetailRow
                  label="Assigned"
                  value={
                    [trip.driver.firstName, trip.driver.lastName]
                      .filter(Boolean)
                      .join(" ") || "—"
                  }
                />
                {trip.driver.phone && (
                  <DetailRow label="Phone" value={trip.driver.phone} />
                )}
                {trip.status === "ASSIGNED" && (
                  <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
                    <Button
                      title="Reassign Driver"
                      onPress={() => setShowDriverPicker(true)}
                      variant="outline"
                      size="sm"
                    />
                    <Button
                      title="Unassign Driver"
                      onPress={() => {
                        Alert.alert(
                          "Unassign Driver",
                          "Remove driver from this trip?",
                          [
                            { text: "Cancel", style: "cancel" },
                            {
                              text: "Unassign",
                              style: "destructive",
                              onPress: () =>
                                unassignDriver
                                  .mutateAsync(trip.id)
                                  .then(() => refetch()),
                            },
                          ]
                        );
                      }}
                      variant="destructive"
                      size="sm"
                    />
                  </View>
                )}
              </>
            ) : (
              <Button
                title="Assign Driver"
                onPress={() => setShowDriverPicker(true)}
                variant="primary"
                size="sm"
              />
            )}
          </Card>
        )}

        {/* Driver Picker Modal */}
        <Modal visible={showDriverPicker} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.sectionTitle}>Select Driver</Text>
              {(driversData?.drivers ?? []).length === 0 ? (
                <Text style={styles.detailLabel}>No available drivers</Text>
              ) : (
                (driversData?.drivers ?? []).map((d) => (
                  <TouchableOpacity
                    key={d.id}
                    style={styles.driverPickerRow}
                    onPress={() => {
                      setShowDriverPicker(false);
                      assignDriver
                        .mutateAsync({ tripId: trip.id, driverId: d.id })
                        .then(() => refetch())
                        .catch((err) =>
                          Alert.alert(
                            "Error",
                            err instanceof Error
                              ? err.message
                              : "Failed to assign"
                          )
                        );
                    }}
                  >
                    <Text style={styles.detailValue}>
                      {[d.firstName, d.lastName].filter(Boolean).join(" ") ||
                        "(no name)"}
                    </Text>
                    <Text style={styles.detailLabel}>{d.phone ?? ""}</Text>
                  </TouchableOpacity>
                ))
              )}
              <Button
                title="Cancel"
                onPress={() => setShowDriverPicker(false)}
                variant="ghost"
                size="sm"
                style={{ marginTop: spacing.md }}
              />
            </View>
          </View>
        </Modal>

        {/* Shipper Contact */}
        {trip.shipper && (
          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Shipper</Text>
            <DetailRow label="Company" value={trip.shipper.name ?? "N/A"} />
            {trip.shipper.contactPhone && (
              <View style={styles.contactRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.detailLabel}>Phone</Text>
                  <Text style={styles.detailValue}>
                    {trip.shipper.contactPhone}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.contactBtn}
                  onPress={() =>
                    Linking.openURL(`tel:${trip.shipper!.contactPhone}`)
                  }
                >
                  <Ionicons
                    name="call-outline"
                    size={18}
                    color={colors.primary600}
                  />
                </TouchableOpacity>
              </View>
            )}
          </Card>
        )}

        {/* Service Fee — shown for DELIVERED/COMPLETED/CANCELLED */}
        {trip.load?.carrierServiceFee != null && (
          <Card style={styles.card}>
            <Text style={styles.sectionTitle}>Service Fee</Text>
            <DetailRow
              label="Platform Fee"
              value={formatCurrency(Number(trip.load.carrierServiceFee))}
            />
            <DetailRow
              label="Status"
              value={trip.load.carrierFeeStatus ?? "PENDING"}
            />
          </Card>
        )}

        {/* Exception Banner */}
        {isException && (
          <Card style={[styles.card, styles.exceptionCard]}>
            <View style={styles.exceptionHeader}>
              <Ionicons name="warning" size={24} color="#D97706" />
              <Text style={styles.exceptionTitle}>Exception Reported</Text>
            </View>
            <Text style={styles.exceptionMessage}>
              This trip has an active exception. An admin will review and
              resolve it. You will be notified once the exception is resolved.
            </Text>
            {trip.exceptionAt && (
              <Text style={styles.exceptionMeta}>
                Reported: {formatDate(trip.exceptionAt)}
              </Text>
            )}
          </Card>
        )}

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

            {/* POD upload removed — driver-only. Show read-only status. */}
            {isDelivered && !podSubmitted && (
              <Text style={styles.podWaiting}>
                Waiting for driver to upload POD
              </Text>
            )}
          </Card>
        )}

        {/* Action Buttons */}
        {validNextStatuses.length > 0 && (
          <View style={styles.actions}>
            {validNextStatuses
              .filter((s) => s !== "CANCELLED" && s !== "COMPLETED")
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

        {/* §13 Message Shipper */}
        {id && (
          <Button
            title="Message Shipper"
            onPress={() => router.push(`/(shared)/chat/${id}`)}
            variant="outline"
            fullWidth
            size="md"
            icon={
              <Ionicons
                name="chatbubbles-outline"
                size={18}
                color={colors.primary500}
              />
            }
          />
        )}

        <View style={{ height: spacing["3xl"] }} />
      </ScrollView>

      <RatingModal
        visible={showRatingModal}
        tripId={id!}
        ratedOrgName={trip.shipper?.name ?? "Shipper"}
        raterLabel="Rate Shipper"
        onClose={() => setShowRatingModal(false)}
      />

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
  ratingRow: {
    flexDirection: "row",
    gap: 4,
    marginBottom: spacing.sm,
  },
  ratingComment: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    fontStyle: "italic",
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
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate100,
  },
  contactBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary50,
    justifyContent: "center",
    alignItems: "center",
  },

  // Exception styles
  exceptionCard: {
    borderLeftWidth: 4,
    borderLeftColor: "#D97706",
    backgroundColor: "#FFFBEB",
  },
  exceptionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  exceptionTitle: {
    ...typography.titleMedium,
    color: "#92400E",
  },
  exceptionMessage: {
    ...typography.bodyMedium,
    color: "#78350F",
    marginBottom: spacing.sm,
  },
  exceptionMeta: {
    ...typography.bodySmall,
    color: "#92400E",
  },

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
  podWaiting: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    marginTop: spacing.sm,
    textAlign: "center" as const,
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
  driverPickerRow: {
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
});
