/**
 * Shipper Trip Details Screen - Delivery tracking
 * Shows trip info, POD documents, receiver info, carrier info,
 * completed banner, and confirmation modal with notes.
 */
import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  Linking,
  Alert,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  useTrip,
  useTripPods,
  useConfirmDelivery,
} from "../../../src/hooks/useTrips";
import { Card } from "../../../src/components/Card";
import { Button } from "../../../src/components/Button";
import { StatusBadge } from "../../../src/components/StatusBadge";
import { LoadingSpinner } from "../../../src/components/LoadingSpinner";
import {
  formatDate,
  formatDateTime,
  formatDistance,
  formatTruckType,
  formatWeight,
} from "../../../src/utils/format";
import { colors } from "../../../src/theme/colors";
import { spacing } from "../../../src/theme/spacing";
import { borderRadius } from "../../../src/theme/spacing";
import { typography } from "../../../src/theme/typography";

export default function ShipperTripDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: trip, isLoading } = useTrip(id);
  const { data: pods } = useTripPods(id);
  const confirmDelivery = useConfirmDelivery();

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmNotes, setConfirmNotes] = useState("");

  if (isLoading || !trip) return <LoadingSpinner fullScreen />;

  const needsConfirmation =
    trip.status === "DELIVERED" &&
    (trip.load?.podSubmitted || (pods && pods.length > 0)) &&
    !trip.shipperConfirmed;

  const isTerminal = trip.status === "DELIVERED" || trip.status === "COMPLETED";

  const handleConfirm = () => {
    confirmDelivery.mutate(
      { tripId: id!, notes: confirmNotes || undefined },
      {
        onSuccess: () => {
          setShowConfirmModal(false);
          setConfirmNotes("");
        },
        onError: (err) => Alert.alert("Error", err.message),
      }
    );
  };

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <Card style={styles.card}>
        <View style={styles.headerRow}>
          <Text style={styles.route}>
            {trip.pickupCity} → {trip.deliveryCity}
          </Text>
          <StatusBadge status={trip.status} type="trip" size="md" />
        </View>
      </Card>

      {/* Completed Banner */}
      {trip.status === "COMPLETED" && (
        <View style={styles.completedCard}>
          <View style={styles.bannerRow}>
            <Ionicons
              name="checkmark-circle"
              size={24}
              color={colors.successDark}
            />
            <Text style={styles.completedTitle}>Trip Completed</Text>
          </View>
          {trip.completedAt && (
            <Text style={styles.completedDate}>
              Completed on {formatDate(trip.completedAt)}
            </Text>
          )}
        </View>
      )}

      {/* Delivery Confirmation Alert */}
      {needsConfirmation && (
        <View style={styles.confirmCard}>
          <View style={styles.bannerRow}>
            <Ionicons
              name="document-text"
              size={24}
              color={colors.primary700}
            />
            <Text style={styles.confirmTitle}>Confirm Delivery Receipt</Text>
          </View>
          <Text style={styles.confirmMessage}>
            The carrier has delivered and submitted proof of delivery. Please
            review and confirm receipt.
          </Text>
          <Button
            title="Confirm Delivery"
            onPress={() => setShowConfirmModal(true)}
            size="md"
            fullWidth
            style={{ marginTop: spacing.md }}
          />
        </View>
      )}

      {/* Carrier Info */}
      {trip.carrier && (
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Carrier</Text>
          <DetailRow label="Company" value={trip.carrier.name ?? "N/A"} />
          {trip.carrier.contactPhone && (
            <View style={styles.contactRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.detailLabel}>Phone</Text>
                <Text style={styles.detailValue}>
                  {trip.carrier.contactPhone}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.contactBtn}
                onPress={() =>
                  Linking.openURL(`tel:${trip.carrier!.contactPhone}`)
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
          {trip.carrier.contactEmail && (
            <View style={styles.contactRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.detailLabel}>Email</Text>
                <Text style={styles.detailValue}>
                  {trip.carrier.contactEmail}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.contactBtn}
                onPress={() =>
                  Linking.openURL(`mailto:${trip.carrier!.contactEmail}`)
                }
              >
                <Ionicons
                  name="mail-outline"
                  size={18}
                  color={colors.primary600}
                />
              </TouchableOpacity>
            </View>
          )}
        </Card>
      )}

      {/* Load Details */}
      {trip.load && (
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Load Details</Text>
          {trip.load.cargoDescription && (
            <DetailRow label="Cargo" value={trip.load.cargoDescription} />
          )}
          {trip.load.truckType && (
            <DetailRow
              label="Truck Type"
              value={formatTruckType(trip.load.truckType)}
            />
          )}
          {trip.load.weight != null && (
            <DetailRow label="Weight" value={formatWeight(trip.load.weight)} />
          )}
          {trip.load.fullPartial && (
            <DetailRow label="Load Type" value={trip.load.fullPartial} />
          )}
          {trip.load.pickupDate && (
            <DetailRow
              label="Pickup Date"
              value={formatDate(trip.load.pickupDate)}
            />
          )}
          {trip.load.deliveryDate && (
            <DetailRow
              label="Delivery Date"
              value={formatDate(trip.load.deliveryDate)}
            />
          )}
        </Card>
      )}

      {/* Track Shipment */}
      {trip.status === "IN_TRANSIT" && (
        <View style={styles.actions}>
          <Button
            title="Track Shipment"
            variant="primary"
            size="lg"
            fullWidth
            onPress={() =>
              Alert.alert(
                "Track Shipment",
                "Live tracking will open the map view for this trip."
              )
            }
            icon={
              <Ionicons
                name="navigate-outline"
                size={18}
                color={colors.white}
              />
            }
          />
        </View>
      )}

      {/* Shipment Details */}
      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Shipment Details</Text>
        <DetailRow
          label="Distance"
          value={formatDistance(trip.estimatedDistanceKm)}
        />
        {trip.startedAt && (
          <DetailRow label="Started" value={formatDate(trip.startedAt)} />
        )}
        {trip.deliveredAt && (
          <DetailRow label="Delivered" value={formatDate(trip.deliveredAt)} />
        )}
        {trip.truck && (
          <DetailRow label="Truck" value={trip.truck.licensePlate ?? "N/A"} />
        )}
      </Card>

      {/* Activity Timeline */}
      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Activity Timeline</Text>
        {buildTimelineEvents(trip).map((event, index, arr) => (
          <View key={event.label} style={styles.timelineItem}>
            <View style={styles.timelineLeft}>
              <View
                style={[
                  styles.timelineDot,
                  event.active
                    ? styles.timelineDotActive
                    : styles.timelineDotInactive,
                ]}
              >
                <Ionicons
                  name={event.icon as keyof typeof Ionicons.glyphMap}
                  size={14}
                  color={event.active ? colors.white : colors.slate400}
                />
              </View>
              {index < arr.length - 1 && (
                <View
                  style={[
                    styles.timelineLine,
                    event.active
                      ? styles.timelineLineActive
                      : styles.timelineLineInactive,
                  ]}
                />
              )}
            </View>
            <View style={styles.timelineContent}>
              <Text
                style={[
                  styles.timelineLabel,
                  !event.active && styles.timelineLabelInactive,
                ]}
              >
                {event.label}
              </Text>
              {event.date ? (
                <Text style={styles.timelineDate}>
                  {formatDateTime(event.date)}
                </Text>
              ) : (
                <Text style={styles.timelinePending}>Pending</Text>
              )}
            </View>
          </View>
        ))}
      </Card>

      {/* Receiver Info */}
      {isTerminal && (trip.receiverName || trip.receiverPhone) && (
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Receiver Info</Text>
          {trip.receiverName && (
            <DetailRow label="Name" value={trip.receiverName} />
          )}
          {trip.receiverPhone && (
            <DetailRow label="Phone" value={trip.receiverPhone} />
          )}
          {trip.deliveryNotes && (
            <DetailRow label="Notes" value={trip.deliveryNotes} />
          )}
        </Card>
      )}

      {/* POD Documents */}
      {isTerminal && pods && pods.length > 0 && (
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>
            Proof of Delivery ({pods.length})
          </Text>
          {pods.map((pod) => (
            <TouchableOpacity
              key={pod.id}
              style={styles.podItem}
              onPress={() => {
                if (pod.fileUrl) Linking.openURL(pod.fileUrl);
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.podFileName}>
                  {pod.fileName || "Document"}
                </Text>
                {pod.notes && <Text style={styles.podNotes}>{pod.notes}</Text>}
                <Text style={styles.podDate}>{formatDate(pod.uploadedAt)}</Text>
              </View>
              <Ionicons
                name="open-outline"
                size={20}
                color={colors.primary500}
              />
            </TouchableOpacity>
          ))}
        </Card>
      )}

      {/* Confirm Delivery Button (fallback when no POD yet) */}
      {trip.status === "DELIVERED" &&
        !trip.shipperConfirmed &&
        !needsConfirmation && (
          <View style={styles.actions}>
            <Button
              title="Confirm Delivery"
              onPress={() => setShowConfirmModal(true)}
              loading={confirmDelivery.isPending}
              fullWidth
              size="lg"
            />
          </View>
        )}

      <View style={{ height: spacing["3xl"] }} />

      {/* Confirmation Modal */}
      <Modal
        visible={showConfirmModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowConfirmModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Confirm Delivery</Text>
            <Text style={styles.modalMessage}>
              Are you sure you want to confirm this delivery has been received?
            </Text>
            <TextInput
              style={styles.notesInput}
              placeholder="Add notes (optional)"
              placeholderTextColor={colors.textTertiary}
              value={confirmNotes}
              onChangeText={setConfirmNotes}
              multiline
              numberOfLines={3}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => {
                  setShowConfirmModal(false);
                  setConfirmNotes("");
                }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalConfirmBtn,
                  confirmDelivery.isPending && { opacity: 0.6 },
                ]}
                onPress={handleConfirm}
                disabled={confirmDelivery.isPending}
              >
                <Text style={styles.modalConfirmText}>
                  {confirmDelivery.isPending ? "Confirming..." : "Confirm"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function buildTimelineEvents(trip: {
  status: string;
  createdAt: Date;
  startedAt?: Date | null;
  pickedUpAt?: Date | null;
  deliveredAt?: Date | null;
  completedAt?: Date | null;
  cancelledAt?: Date | null;
}) {
  const events = [
    {
      label: "Trip Created",
      icon: "create-outline",
      date: trip.createdAt,
      active: true,
    },
    {
      label: "Pickup Started",
      icon: "location-outline",
      date: trip.startedAt,
      active: !!trip.startedAt,
    },
    {
      label: "In Transit",
      icon: "car-outline",
      date: trip.pickedUpAt,
      active: !!trip.pickedUpAt,
    },
    {
      label: "Delivered",
      icon: "checkmark-circle-outline",
      date: trip.deliveredAt,
      active: !!trip.deliveredAt,
    },
    {
      label: "Completed",
      icon: "trophy-outline",
      date: trip.completedAt,
      active: !!trip.completedAt,
    },
  ];

  if (trip.cancelledAt) {
    events.push({
      label: "Cancelled",
      icon: "close-circle-outline",
      date: trip.cancelledAt,
      active: true,
    });
  }

  return events;
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
  actions: { padding: spacing.lg },
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
    marginLeft: spacing.sm,
  },

  // Completed banner
  completedCard: {
    margin: spacing.lg,
    marginBottom: 0,
    backgroundColor: colors.successLight,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
  },
  bannerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  completedTitle: {
    ...typography.titleMedium,
    color: colors.successDark,
  },
  completedDate: {
    ...typography.bodySmall,
    color: colors.successDark,
    marginTop: spacing.xs,
    marginLeft: 32,
  },

  // Confirmation alert card
  confirmCard: {
    margin: spacing.lg,
    marginBottom: 0,
    backgroundColor: colors.primary50,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.primary200,
  },
  confirmTitle: {
    ...typography.titleMedium,
    color: colors.primary700,
  },
  confirmMessage: {
    ...typography.bodySmall,
    color: colors.primary700,
    marginTop: spacing.sm,
  },

  // Timeline
  timelineItem: {
    flexDirection: "row",
    minHeight: 48,
  },
  timelineLeft: {
    width: 32,
    alignItems: "center",
  },
  timelineDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  timelineDotActive: {
    backgroundColor: colors.primary500,
  },
  timelineDotInactive: {
    backgroundColor: colors.slate100,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    minHeight: 20,
  },
  timelineLineActive: {
    backgroundColor: colors.primary500,
  },
  timelineLineInactive: {
    backgroundColor: colors.slate200,
  },
  timelineContent: {
    flex: 1,
    paddingLeft: spacing.md,
    paddingBottom: spacing.md,
  },
  timelineLabel: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: "500",
  },
  timelineLabelInactive: {
    color: colors.textTertiary,
  },
  timelineDate: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 2,
  },
  timelinePending: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    fontStyle: "italic",
    marginTop: 2,
  },

  // POD documents
  podItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate100,
    gap: spacing.sm,
  },
  podFileName: {
    ...typography.bodyMedium,
    color: colors.primary600,
    fontWeight: "500",
  },
  podNotes: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 2,
  },
  podDate: {
    ...typography.labelSmall,
    color: colors.textTertiary,
    marginTop: 2,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    padding: spacing["2xl"],
    width: "100%",
    maxWidth: 400,
  },
  modalTitle: {
    ...typography.headlineSmall,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  modalMessage: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  notesInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    ...typography.bodyMedium,
    color: colors.textPrimary,
    minHeight: 80,
    textAlignVertical: "top",
    marginBottom: spacing.lg,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.md,
  },
  modalCancelBtn: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.md,
    backgroundColor: colors.slate100,
  },
  modalCancelText: {
    ...typography.labelLarge,
    color: colors.textSecondary,
  },
  modalConfirmBtn: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary500,
  },
  modalConfirmText: {
    ...typography.labelLarge,
    color: colors.white,
  },
});
