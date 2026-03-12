/**
 * Edit Truck Screen
 * Pre-populates form from existing truck data, supports update & delete
 */
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Alert,
  TouchableOpacity,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import apiClient from "../../../src/api/client";
import {
  useTruck,
  useUpdateTruck,
  useDeleteTruck,
} from "../../../src/hooks/useTrucks";
import type { Truck } from "../../../src/types";
import { Input } from "../../../src/components/Input";
import { Button } from "../../../src/components/Button";
import { LoadingSpinner } from "../../../src/components/LoadingSpinner";
import { colors } from "../../../src/theme/colors";
import { spacing } from "../../../src/theme/spacing";
import { typography } from "../../../src/theme/typography";

const TRUCK_TYPES = [
  { value: "FLATBED", label: "Flatbed" },
  { value: "REFRIGERATED", label: "Refrigerated" },
  { value: "TANKER", label: "Tanker" },
  { value: "CONTAINER", label: "Container" },
  { value: "DRY_VAN", label: "Dry Van" },
  { value: "LOWBOY", label: "Lowboy" },
  { value: "DUMP_TRUCK", label: "Dump Truck" },
  { value: "BOX_TRUCK", label: "Box Truck" },
] as const;

const truckSchema = z.object({
  licensePlate: z.string().min(1, "License plate is required"),
  truckType: z.string().min(1, "Truck type is required"),
  capacity: z.string().min(1, "Capacity is required"),
  volume: z.string().optional(),
  lengthM: z.string().optional(),
  ownerName: z.string().optional(),
  contactName: z.string().optional(),
  contactPhone: z.string().optional(),
});

type TruckForm = z.infer<typeof truckSchema>;

export default function EditTruckScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { data: truck, isLoading } = useTruck(id);
  const updateTruck = useUpdateTruck();
  const deleteTruck = useDeleteTruck();
  const [resubmitting, setResubmitting] = useState(false);

  // Guard: if no id param, navigate back
  useEffect(() => {
    if (!id) {
      Alert.alert("Error", "No truck ID provided.");
      router.back();
    }
  }, [id, router]);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TruckForm>({
    resolver: zodResolver(truckSchema),
    defaultValues: {
      licensePlate: "",
      truckType: "FLATBED",
      capacity: "",
      volume: "",
      lengthM: "",
      ownerName: "",
      contactName: "",
      contactPhone: "",
    },
  });

  // Pre-populate form when truck data loads
  useEffect(() => {
    if (truck) {
      reset({
        licensePlate: truck.licensePlate ?? "",
        truckType: truck.truckType ?? "FLATBED",
        capacity: truck.capacity != null ? String(truck.capacity) : "",
        volume: truck.volume != null ? String(truck.volume) : "",
        lengthM: truck.lengthM != null ? String(truck.lengthM) : "",
        ownerName: truck.ownerName ?? "",
        contactName: truck.contactName ?? "",
        contactPhone: truck.contactPhone ?? "",
      });
    }
  }, [truck, reset]);

  const onSubmit = (data: TruckForm) => {
    if (!id) return;
    updateTruck.mutate(
      {
        id,
        data: {
          licensePlate: data.licensePlate,
          truckType: data.truckType as Truck["truckType"],
          capacity: parseFloat(data.capacity),
          volume: data.volume ? parseFloat(data.volume) : undefined,
          lengthM: data.lengthM ? parseFloat(data.lengthM) : undefined,
          ownerName: data.ownerName || undefined,
          contactName: data.contactName || undefined,
          contactPhone: data.contactPhone || undefined,
        },
      },
      {
        onSuccess: () => {
          Alert.alert("Success", "Truck updated successfully!");
          router.back();
        },
        onError: (err) => {
          Alert.alert("Error", err.message);
        },
      }
    );
  };

  const handleDelete = () => {
    if (!id) return;
    Alert.alert(
      "Delete Truck",
      "Are you sure you want to delete this truck? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            deleteTruck.mutate(id, {
              onSuccess: () => {
                Alert.alert("Deleted", "Truck has been deleted.");
                // Pop both edit and detail screens back to trucks list
                router.dismissAll();
              },
              onError: (err) => {
                Alert.alert("Error", err.message);
              },
            });
          },
        },
      ]
    );
  };

  // G-M6-4: Resubmit truck for admin approval
  const handleResubmit = async () => {
    if (!id) return;
    setResubmitting(true);
    try {
      await apiClient.post(`/api/trucks/${id}/resubmit`);
      Alert.alert("Submitted", "Truck resubmitted for admin approval.", [
        { text: "OK", onPress: () => router.dismissAll() },
      ]);
    } catch (error: any) {
      Alert.alert("Error", error?.message ?? "Failed to resubmit truck.");
    } finally {
      setResubmitting(false);
    }
  };

  if (!id || isLoading || !truck) return <LoadingSpinner fullScreen />;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Rejection Reason Banner */}
        {truck.approvalStatus === "REJECTED" && truck.rejectionReason && (
          <View style={styles.rejectionBanner}>
            <Ionicons name="alert-circle" size={20} color={colors.errorDark} />
            <View style={styles.rejectionContent}>
              <Text style={styles.rejectionTitle}>Truck Rejected</Text>
              <Text style={styles.rejectionReason}>
                {truck.rejectionReason}
              </Text>
            </View>
          </View>
        )}

        {/* G-M6-4: Resubmit for Approval */}
        {truck.approvalStatus === "REJECTED" && (
          <View style={styles.resubmitSection}>
            <Text style={styles.resubmitHint}>
              Update truck details above, then resubmit for approval.
            </Text>
            <Button
              title="Resubmit for Approval"
              variant="primary"
              size="lg"
              fullWidth
              onPress={handleResubmit}
              loading={resubmitting}
            />
          </View>
        )}

        <Controller
          control={control}
          name="licensePlate"
          render={({ field: { onChange, value } }) => (
            <Input
              label={t("truck.licensePlate")}
              value={value}
              onChangeText={onChange}
              error={errors.licensePlate?.message}
              required
              autoCapitalize="characters"
              testID="truck-licensePlate"
            />
          )}
        />

        <Controller
          control={control}
          name="truckType"
          render={({ field: { onChange, value } }) => (
            <View testID="truck-truckType">
              <Text style={styles.pickerLabel}>
                {t("truck.truckType")} <Text style={styles.required}>*</Text>
              </Text>
              <View style={styles.pickerGrid}>
                {TRUCK_TYPES.map((type) => (
                  <TouchableOpacity
                    key={type.value}
                    style={[
                      styles.pickerOption,
                      value === type.value && styles.pickerOptionSelected,
                    ]}
                    onPress={() => onChange(type.value)}
                  >
                    <Text
                      style={[
                        styles.pickerOptionText,
                        value === type.value && styles.pickerOptionTextSelected,
                      ]}
                    >
                      {type.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {errors.truckType?.message && (
                <Text style={styles.errorText}>{errors.truckType.message}</Text>
              )}
            </View>
          )}
        />

        <Controller
          control={control}
          name="capacity"
          render={({ field: { onChange, value } }) => (
            <Input
              label={t("truck.capacity")}
              value={value}
              onChangeText={onChange}
              error={errors.capacity?.message}
              keyboardType="numeric"
              required
              testID="truck-capacity"
            />
          )}
        />

        <View style={styles.row}>
          <View style={styles.halfField}>
            <Controller
              control={control}
              name="volume"
              render={({ field: { onChange, value } }) => (
                <Input
                  label={t("truck.volume")}
                  value={value ?? ""}
                  onChangeText={onChange}
                  keyboardType="numeric"
                />
              )}
            />
          </View>
          <View style={styles.halfField}>
            <Controller
              control={control}
              name="lengthM"
              render={({ field: { onChange, value } }) => (
                <Input
                  label={t("truck.length")}
                  value={value ?? ""}
                  onChangeText={onChange}
                  keyboardType="numeric"
                />
              )}
            />
          </View>
        </View>

        <Controller
          control={control}
          name="ownerName"
          render={({ field: { onChange, value } }) => (
            <Input
              label={t("truck.ownerName")}
              value={value ?? ""}
              onChangeText={onChange}
            />
          )}
        />

        <Controller
          control={control}
          name="contactName"
          render={({ field: { onChange, value } }) => (
            <Input
              label={t("truck.contactName")}
              value={value ?? ""}
              onChangeText={onChange}
            />
          )}
        />

        <Controller
          control={control}
          name="contactPhone"
          render={({ field: { onChange, value } }) => (
            <Input
              label={t("truck.contactPhone")}
              value={value ?? ""}
              onChangeText={onChange}
              keyboardType="phone-pad"
            />
          )}
        />

        <Button
          title="Update Truck"
          onPress={handleSubmit(onSubmit)}
          loading={updateTruck.isPending}
          fullWidth
          size="lg"
          testID="truck-update-submit"
        />

        <View style={styles.deleteSection}>
          <Button
            title="Delete Truck"
            variant="destructive"
            onPress={handleDelete}
            loading={deleteTruck.isPending}
            fullWidth
            size="lg"
            testID="truck-delete"
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing["2xl"],
  },
  rejectionBanner: {
    flexDirection: "row",
    backgroundColor: colors.errorLight,
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.error,
  },
  rejectionContent: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  rejectionTitle: {
    ...typography.labelMedium,
    color: colors.errorDark,
    marginBottom: 2,
  },
  rejectionReason: {
    ...typography.bodySmall,
    color: colors.errorDark,
  },
  row: {
    flexDirection: "row",
    gap: spacing.md,
  },
  halfField: {
    flex: 1,
  },
  deleteSection: {
    marginTop: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  resubmitSection: {
    marginBottom: spacing.lg,
  },
  resubmitHint: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  pickerLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  required: {
    color: colors.error,
  },
  pickerGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  pickerOption: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  pickerOptionSelected: {
    borderColor: colors.primary500,
    backgroundColor: colors.primary500 + "15",
  },
  pickerOptionText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  pickerOptionTextSelected: {
    color: colors.primary500,
    fontWeight: "600",
  },
  errorText: {
    fontSize: 12,
    color: colors.error,
    marginTop: 2,
  },
});
