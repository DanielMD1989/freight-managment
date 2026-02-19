/**
 * Shipper Truckboard - Find available trucks with advanced filters + booking
 * Shippers browse truck-postings (not trucks directly per foundation rules)
 */
import React, { useState } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import {
  useTruckPostings,
  useCreateTruckRequest,
} from "../../../src/hooks/useTrucks";
import { useLoads } from "../../../src/hooks/useLoads";
import { Card } from "../../../src/components/Card";
import { Input } from "../../../src/components/Input";
import { Button } from "../../../src/components/Button";
import { LoadingSpinner } from "../../../src/components/LoadingSpinner";
import { EmptyState } from "../../../src/components/EmptyState";
import { formatTruckType } from "../../../src/utils/format";
import { colors } from "../../../src/theme/colors";
import { spacing } from "../../../src/theme/spacing";
import { typography } from "../../../src/theme/typography";
import type { TruckPosting } from "../../../src/types";

const TRUCK_TYPES = [
  "",
  "FLATBED",
  "REFRIGERATED",
  "TANKER",
  "CONTAINER",
  "DRY_VAN",
  "LOWBOY",
  "DUMP_TRUCK",
  "BOX_TRUCK",
];

export default function ShipperTruckboard() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [truckType, setTruckType] = useState("");
  const [bookingPosting, setBookingPosting] = useState<TruckPosting | null>(
    null
  );

  const { data, isLoading, refetch, isRefetching } = useTruckPostings({
    truckType: truckType || undefined,
    origin: search || undefined,
  });

  const postings = data?.postings ?? [];
  const filtered = search
    ? postings.filter(
        (p) =>
          p.originCityName?.toLowerCase().includes(search.toLowerCase()) ||
          p.destinationCityName?.toLowerCase().includes(search.toLowerCase())
      )
    : postings;

  const renderPosting = ({ item }: { item: TruckPosting }) => (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => setBookingPosting(item)}
    >
      <Card style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.route}>
            {item.originCityName ?? "N/A"} → {item.destinationCityName ?? "Any"}
          </Text>
          {item.carrier?.isVerified && (
            <Ionicons
              name="checkmark-circle"
              size={18}
              color={colors.success}
            />
          )}
        </View>
        <View style={styles.details}>
          {item.truck && (
            <View style={styles.detailItem}>
              <Ionicons name="bus-outline" size={14} color={colors.slate400} />
              <Text style={styles.detailText}>
                {formatTruckType(item.truck.truckType)}
              </Text>
            </View>
          )}
          {item.truck?.capacity && (
            <View style={styles.detailItem}>
              <Ionicons
                name="barbell-outline"
                size={14}
                color={colors.slate400}
              />
              <Text style={styles.detailText}>
                {item.truck.capacity.toLocaleString()} kg
              </Text>
            </View>
          )}
          <View style={styles.detailItem}>
            <Ionicons
              name="calendar-outline"
              size={14}
              color={colors.slate400}
            />
            <Text style={styles.detailText}>
              From: {new Date(item.availableFrom).toLocaleDateString()}
            </Text>
          </View>
          {item.fullPartial && (
            <View style={styles.detailItem}>
              <Ionicons
                name="resize-outline"
                size={14}
                color={colors.slate400}
              />
              <Text style={styles.detailText}>{item.fullPartial}</Text>
            </View>
          )}
        </View>
        <View style={styles.actionHint}>
          <Text style={styles.actionHintText}>Tap to request</Text>
          <Ionicons
            name="chevron-forward"
            size={16}
            color={colors.primary500}
          />
        </View>
      </Card>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Search + filter bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchRow}>
          <View style={{ flex: 1 }}>
            <Input
              value={search}
              onChangeText={setSearch}
              placeholder="Search by city..."
              leftIcon={
                <Ionicons
                  name="search-outline"
                  size={20}
                  color={colors.slate400}
                />
              }
              containerStyle={{ marginBottom: 0 }}
            />
          </View>
          <TouchableOpacity
            style={[
              styles.filterBtn,
              truckType !== "" && styles.filterBtnActive,
            ]}
            onPress={() => setShowFilters(true)}
          >
            <Ionicons
              name="options-outline"
              size={20}
              color={truckType !== "" ? colors.white : colors.primary600}
            />
          </TouchableOpacity>
        </View>
        {truckType !== "" && (
          <View style={styles.activeFilters}>
            <TouchableOpacity
              style={styles.filterChip}
              onPress={() => setTruckType("")}
            >
              <Text style={styles.filterChipText}>
                {truckType.replace(/_/g, " ")}
              </Text>
              <Ionicons name="close" size={14} color={colors.primary600} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {isLoading && !data ? (
        <LoadingSpinner fullScreen />
      ) : (
        <FlatList
          data={filtered}
          renderItem={renderPosting}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
          }
          ListEmptyComponent={
            <EmptyState
              icon="bus-outline"
              title="No trucks available"
              message="Try adjusting your filters or check back later"
            />
          }
        />
      )}

      {/* Filter modal */}
      <FilterModal
        visible={showFilters}
        onClose={() => setShowFilters(false)}
        truckType={truckType}
        onApply={(type) => {
          setTruckType(type);
          setShowFilters(false);
        }}
      />

      {/* Booking modal */}
      {bookingPosting && (
        <BookingModal
          posting={bookingPosting}
          onClose={() => setBookingPosting(null)}
        />
      )}
    </View>
  );
}

function FilterModal({
  visible,
  onClose,
  truckType,
  onApply,
}: {
  visible: boolean;
  onClose: () => void;
  truckType: string;
  onApply: (type: string) => void;
}) {
  const [localType, setLocalType] = useState(truckType);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Filter Trucks</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            <Text style={styles.filterLabel}>Truck Type</Text>
            <View style={styles.chipGrid}>
              {TRUCK_TYPES.map((type) => (
                <TouchableOpacity
                  key={type || "ALL"}
                  style={[styles.chip, localType === type && styles.chipActive]}
                  onPress={() => setLocalType(type)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      localType === type && styles.chipTextActive,
                    ]}
                  >
                    {type ? type.replace(/_/g, " ") : "All Types"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <Button
              title="Reset"
              onPress={() => {
                setLocalType("");
                onApply("");
              }}
              variant="outline"
              style={{ flex: 1 }}
            />
            <Button
              title="Apply"
              onPress={() => onApply(localType)}
              variant="primary"
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function BookingModal({
  posting,
  onClose,
}: {
  posting: TruckPosting;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [selectedLoadId, setSelectedLoadId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const createRequest = useCreateTruckRequest();

  // Fetch shipper's active loads to select from
  const { data: loadsData } = useLoads({
    status: "POSTED,SEARCHING,OFFERED",
    myLoads: true,
  });
  const loads = loadsData?.loads ?? [];

  const handleSubmit = () => {
    if (!selectedLoadId) {
      Alert.alert("Select a Load", "Please select a load for this request");
      return;
    }
    if (!posting.truckId) {
      Alert.alert("Error", "Truck info unavailable");
      return;
    }

    createRequest.mutate(
      {
        loadId: selectedLoadId,
        truckId: posting.truckId,
        notes: notes || undefined,
      },
      {
        onSuccess: () => {
          Alert.alert(
            "Request Sent",
            "Your truck request has been sent. The carrier will review it."
          );
          onClose();
        },
        onError: (err) => Alert.alert("Error", err.message),
      }
    );
  };

  return (
    <Modal visible animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t("load.requestTruck")}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            {/* Truck info */}
            <Card variant="outlined" style={styles.bookingInfoCard}>
              <Text style={styles.bookingRoute}>
                {posting.originCityName ?? "N/A"} →{" "}
                {posting.destinationCityName ?? "Any"}
              </Text>
              {posting.truck && (
                <Text style={styles.bookingDetail}>
                  {formatTruckType(posting.truck.truckType)} •{" "}
                  {posting.truck.capacity?.toLocaleString()} kg
                </Text>
              )}
              <Text style={styles.bookingDetail}>
                Available from:{" "}
                {new Date(posting.availableFrom).toLocaleDateString()}
              </Text>
            </Card>

            {/* Select load */}
            <Text style={styles.filterLabel}>Select a Load *</Text>
            {loads.length === 0 ? (
              <Text style={styles.noLoadsText}>
                No posted loads available. Create and post a load first.
              </Text>
            ) : (
              loads.map((load) => (
                <TouchableOpacity
                  key={load.id}
                  style={[
                    styles.loadOption,
                    selectedLoadId === load.id && styles.loadOptionActive,
                  ]}
                  onPress={() => setSelectedLoadId(load.id)}
                >
                  <View style={styles.loadOptionContent}>
                    <Text style={styles.loadOptionRoute}>
                      {load.pickupCity} → {load.deliveryCity}
                    </Text>
                    <Text style={styles.loadOptionDetail}>
                      {formatTruckType(load.truckType)} •{" "}
                      {load.weight?.toLocaleString()} kg
                    </Text>
                  </View>
                  {selectedLoadId === load.id && (
                    <Ionicons
                      name="checkmark-circle"
                      size={24}
                      color={colors.primary500}
                    />
                  )}
                </TouchableOpacity>
              ))
            )}

            <Input
              label="Notes (optional)"
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={2}
              placeholder="Any special requirements..."
              containerStyle={{ marginTop: spacing.md }}
            />
          </ScrollView>

          <View style={styles.modalFooter}>
            <Button
              title={t("common.cancel")}
              onPress={onClose}
              variant="outline"
              style={{ flex: 1 }}
            />
            <Button
              title="Send Request"
              onPress={handleSubmit}
              variant="primary"
              loading={createRequest.isPending}
              disabled={!selectedLoadId || loads.length === 0}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  searchContainer: {
    padding: spacing.lg,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  filterBtn: {
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary500,
    justifyContent: "center",
    alignItems: "center",
  },
  filterBtnActive: {
    backgroundColor: colors.primary500,
  },
  activeFilters: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    backgroundColor: colors.primary50,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.primary200,
  },
  filterChipText: {
    ...typography.labelSmall,
    color: colors.primary600,
  },
  list: { padding: spacing.lg, gap: spacing.md },
  card: { marginBottom: spacing.md },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  route: { ...typography.titleSmall, color: colors.textPrimary, flex: 1 },
  details: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  detailItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  detailText: { ...typography.bodySmall, color: colors.textSecondary },
  actionHint: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.slate100,
  },
  actionHintText: {
    ...typography.labelSmall,
    color: colors.primary500,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: { ...typography.titleMedium, color: colors.textPrimary },
  modalBody: { padding: spacing.lg },
  modalFooter: {
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  filterLabel: {
    ...typography.labelMedium,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  chipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  chipActive: {
    backgroundColor: colors.primary500,
    borderColor: colors.primary500,
  },
  chipText: { ...typography.bodySmall, color: colors.textSecondary },
  chipTextActive: { color: colors.white, fontWeight: "600" },
  // Booking modal
  bookingInfoCard: { marginBottom: spacing.md },
  bookingRoute: {
    ...typography.titleSmall,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  bookingDetail: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  noLoadsText: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    textAlign: "center",
    padding: spacing.lg,
  },
  loadOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    marginBottom: spacing.sm,
  },
  loadOptionActive: {
    borderColor: colors.primary500,
    backgroundColor: colors.primary50,
  },
  loadOptionContent: { flex: 1 },
  loadOptionRoute: {
    ...typography.titleSmall,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  loadOptionDetail: { ...typography.bodySmall, color: colors.textSecondary },
});
