/**
 * Edit Load Screen (Shipper) - Edit existing load
 */
import React, { useEffect } from "react";
import {
  ScrollView,
  StyleSheet,
  Alert,
  View,
  Text,
  Switch,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { useLoad, useUpdateLoad } from "../../../src/hooks/useLoads";
import { Input } from "../../../src/components/Input";
import { Button } from "../../../src/components/Button";
import { LoadingSpinner } from "../../../src/components/LoadingSpinner";
import { colors } from "../../../src/theme/colors";
import { spacing } from "../../../src/theme/spacing";
import { typography } from "../../../src/theme/typography";

const editSchema = z.object({
  pickupCity: z.string().min(1, "Pickup city is required"),
  deliveryCity: z.string().min(1, "Delivery city is required"),
  pickupDate: z.string().min(1, "Pickup date is required"),
  deliveryDate: z.string().min(1, "Delivery date is required"),
  pickupAddress: z.string().optional(),
  deliveryAddress: z.string().optional(),
  weight: z.string().min(1, "Weight is required"),
  volume: z.string().optional(),
  cargoDescription: z.string().min(1, "Cargo description is required"),
  specialInstructions: z.string().optional(),
  isFragile: z.boolean().optional(),
  requiresRefrigeration: z.boolean().optional(),
  appointmentRequired: z.boolean().optional(),
  shipperContactName: z.string().optional(),
  shipperContactPhone: z.string().optional(),
});

type EditForm = z.infer<typeof editSchema>;

export default function EditLoadScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { data: load, isLoading } = useLoad(id);
  const updateLoad = useUpdateLoad();

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EditForm>({
    resolver: zodResolver(editSchema),
  });

  useEffect(() => {
    if (load) {
      reset({
        pickupCity: load.pickupCity ?? "",
        deliveryCity: load.deliveryCity ?? "",
        pickupDate: load.pickupDate
          ? new Date(load.pickupDate).toISOString().split("T")[0]
          : "",
        deliveryDate: load.deliveryDate
          ? new Date(load.deliveryDate).toISOString().split("T")[0]
          : "",
        pickupAddress: load.pickupAddress ?? "",
        deliveryAddress: load.deliveryAddress ?? "",
        weight: String(load.weight ?? ""),
        volume: load.volume ? String(load.volume) : "",
        cargoDescription: load.cargoDescription ?? "",
        specialInstructions: load.specialInstructions ?? "",
        isFragile: load.isFragile ?? false,
        requiresRefrigeration: load.requiresRefrigeration ?? false,
        appointmentRequired: load.appointmentRequired ?? false,
        shipperContactName: load.shipperContactName ?? "",
        shipperContactPhone: load.shipperContactPhone ?? "",
      });
    }
  }, [load, reset]);

  if (isLoading || !load) return <LoadingSpinner fullScreen />;

  const onSubmit = (data: EditForm) => {
    updateLoad.mutate(
      {
        id: load.id,
        data: {
          pickupCity: data.pickupCity,
          deliveryCity: data.deliveryCity,
          pickupDate: new Date(data.pickupDate) as unknown as Date,
          deliveryDate: new Date(data.deliveryDate) as unknown as Date,
          weight: parseFloat(data.weight),
          volume: data.volume ? parseFloat(data.volume) : undefined,
          cargoDescription: data.cargoDescription,
          pickupAddress: data.pickupAddress || undefined,
          deliveryAddress: data.deliveryAddress || undefined,
          specialInstructions: data.specialInstructions || undefined,
          isFragile: data.isFragile ?? false,
          requiresRefrigeration: data.requiresRefrigeration ?? false,
          appointmentRequired: data.appointmentRequired ?? false,
          shipperContactName: data.shipperContactName || undefined,
          shipperContactPhone: data.shipperContactPhone || undefined,
        } as never,
      },
      {
        onSuccess: () => {
          Alert.alert("Success", "Load updated!");
          router.back();
        },
        onError: (err) => Alert.alert("Error", err.message),
      }
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Controller
        control={control}
        name="pickupCity"
        render={({ field: { onChange, value } }) => (
          <Input
            label={t("load.pickupCity")}
            value={value}
            onChangeText={onChange}
            error={errors.pickupCity?.message}
            required
          />
        )}
      />
      <Controller
        control={control}
        name="deliveryCity"
        render={({ field: { onChange, value } }) => (
          <Input
            label={t("load.deliveryCity")}
            value={value}
            onChangeText={onChange}
            error={errors.deliveryCity?.message}
            required
          />
        )}
      />
      <Controller
        control={control}
        name="pickupDate"
        render={({ field: { onChange, value } }) => (
          <Input
            label={t("load.pickupDate")}
            value={value}
            onChangeText={onChange}
            error={errors.pickupDate?.message}
            hint="YYYY-MM-DD"
            required
          />
        )}
      />
      <Controller
        control={control}
        name="deliveryDate"
        render={({ field: { onChange, value } }) => (
          <Input
            label={t("load.deliveryDate")}
            value={value}
            onChangeText={onChange}
            error={errors.deliveryDate?.message}
            hint="YYYY-MM-DD"
            required
          />
        )}
      />
      <Controller
        control={control}
        name="pickupAddress"
        render={({ field: { onChange, value } }) => (
          <Input
            label={t("load.pickupAddress")}
            value={value ?? ""}
            onChangeText={onChange}
          />
        )}
      />
      <Controller
        control={control}
        name="deliveryAddress"
        render={({ field: { onChange, value } }) => (
          <Input
            label={t("load.deliveryAddress")}
            value={value ?? ""}
            onChangeText={onChange}
          />
        )}
      />
      <Controller
        control={control}
        name="weight"
        render={({ field: { onChange, value } }) => (
          <Input
            label={t("load.weight")}
            value={value}
            onChangeText={onChange}
            error={errors.weight?.message}
            keyboardType="numeric"
            required
          />
        )}
      />
      <Controller
        control={control}
        name="volume"
        render={({ field: { onChange, value } }) => (
          <Input
            label={t("load.volume")}
            value={value ?? ""}
            onChangeText={onChange}
            keyboardType="numeric"
          />
        )}
      />
      <Controller
        control={control}
        name="cargoDescription"
        render={({ field: { onChange, value } }) => (
          <Input
            label={t("load.cargo")}
            value={value}
            onChangeText={onChange}
            error={errors.cargoDescription?.message}
            multiline
            numberOfLines={3}
            required
          />
        )}
      />
      <Controller
        control={control}
        name="shipperContactName"
        render={({ field: { onChange, value } }) => (
          <Input
            label={t("load.contactName")}
            value={value ?? ""}
            onChangeText={onChange}
          />
        )}
      />
      <Controller
        control={control}
        name="shipperContactPhone"
        render={({ field: { onChange, value } }) => (
          <Input
            label={t("load.contactPhone")}
            value={value ?? ""}
            onChangeText={onChange}
            keyboardType="phone-pad"
          />
        )}
      />
      <Controller
        control={control}
        name="specialInstructions"
        render={({ field: { onChange, value } }) => (
          <Input
            label={t("load.specialInstructions")}
            value={value ?? ""}
            onChangeText={onChange}
            multiline
            numberOfLines={2}
          />
        )}
      />

      <Controller
        control={control}
        name="isFragile"
        render={({ field: { onChange, value } }) => (
          <SwitchRow
            label={t("load.fragile")}
            value={value ?? false}
            onValueChange={onChange}
          />
        )}
      />
      <Controller
        control={control}
        name="requiresRefrigeration"
        render={({ field: { onChange, value } }) => (
          <SwitchRow
            label={t("load.refrigeration")}
            value={value ?? false}
            onValueChange={onChange}
          />
        )}
      />
      <Controller
        control={control}
        name="appointmentRequired"
        render={({ field: { onChange, value } }) => (
          <SwitchRow
            label={t("load.appointmentRequired")}
            value={value ?? false}
            onValueChange={onChange}
          />
        )}
      />

      <View style={{ height: spacing.lg }} />

      <Button
        title={t("load.updateLoad")}
        onPress={handleSubmit(onSubmit)}
        loading={updateLoad.isPending}
        fullWidth
        size="lg"
      />

      <View style={{ height: spacing["3xl"] }} />
    </ScrollView>
  );
}

function SwitchRow({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.switchRow}>
      <Text style={styles.switchLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.slate200, true: colors.primary300 }}
        thumbColor={value ? colors.primary600 : colors.slate400}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing["2xl"] },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate100,
  },
  switchLabel: { ...typography.bodyMedium, color: colors.textPrimary },
});
