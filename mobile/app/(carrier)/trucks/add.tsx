/**
 * Add Truck Screen
 */
import React from "react";
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
import { useRouter } from "expo-router";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { useCreateTruck } from "../../../src/hooks/useTrucks";
import { Input } from "../../../src/components/Input";
import { Button } from "../../../src/components/Button";
import { colors } from "../../../src/theme/colors";
import { spacing } from "../../../src/theme/spacing";

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

export default function AddTruckScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const createTruck = useCreateTruck();

  const {
    control,
    handleSubmit,
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

  const onSubmit = (data: TruckForm) => {
    createTruck.mutate(
      {
        licensePlate: data.licensePlate,
        truckType: data.truckType,
        capacity: parseFloat(data.capacity),
        volume: data.volume ? parseFloat(data.volume) : undefined,
        lengthM: data.lengthM ? parseFloat(data.lengthM) : undefined,
        ownerName: data.ownerName || undefined,
        contactName: data.contactName || undefined,
        contactPhone: data.contactPhone || undefined,
      },
      {
        onSuccess: () => {
          Alert.alert("Success", "Truck submitted for admin approval!");
          router.back();
        },
        onError: (err) => {
          Alert.alert("Error", err.message);
        },
      }
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
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
          title={t("truck.addTruck")}
          onPress={handleSubmit(onSubmit)}
          loading={createTruck.isPending}
          fullWidth
          size="lg"
          testID="truck-submit"
        />
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
  row: {
    flexDirection: "row",
    gap: spacing.md,
  },
  halfField: {
    flex: 1,
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
