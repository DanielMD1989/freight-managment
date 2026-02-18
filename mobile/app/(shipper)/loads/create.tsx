/**
 * Create Load Screen (Shipper)
 */
import React from "react";
import { ScrollView, StyleSheet, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { useCreateLoad } from "../../../src/hooks/useLoads";
import { Input } from "../../../src/components/Input";
import { Button } from "../../../src/components/Button";
import { colors } from "../../../src/theme/colors";
import { spacing } from "../../../src/theme/spacing";

const loadSchema = z.object({
  pickupCity: z.string().min(1, "Pickup city is required"),
  deliveryCity: z.string().min(1, "Delivery city is required"),
  pickupDate: z.string().min(1, "Pickup date is required"),
  deliveryDate: z.string().min(1, "Delivery date is required"),
  truckType: z.string().min(1, "Truck type is required"),
  weight: z.string().min(1, "Weight is required"),
  cargoDescription: z.string().min(1, "Cargo description is required"),
  fullPartial: z.string().optional(),
  pickupAddress: z.string().optional(),
  deliveryAddress: z.string().optional(),
  specialInstructions: z.string().optional(),
});

type LoadForm = z.infer<typeof loadSchema>;

export default function CreateLoadScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const createLoad = useCreateLoad();

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoadForm>({
    resolver: zodResolver(loadSchema),
    defaultValues: {
      pickupCity: "",
      deliveryCity: "",
      pickupDate: "",
      deliveryDate: "",
      truckType: "FLATBED",
      weight: "",
      cargoDescription: "",
      fullPartial: "FULL",
      pickupAddress: "",
      deliveryAddress: "",
      specialInstructions: "",
    },
  });

  const onSubmit = (data: LoadForm) => {
    createLoad.mutate(
      {
        pickupCity: data.pickupCity,
        deliveryCity: data.deliveryCity,
        pickupDate: data.pickupDate,
        deliveryDate: data.deliveryDate,
        truckType: data.truckType,
        weight: parseFloat(data.weight),
        cargoDescription: data.cargoDescription,
        fullPartial: data.fullPartial || "FULL",
        pickupAddress: data.pickupAddress || undefined,
        deliveryAddress: data.deliveryAddress || undefined,
        specialInstructions: data.specialInstructions || undefined,
      },
      {
        onSuccess: () => {
          Alert.alert("Success", "Load created!");
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
        name="truckType"
        render={({ field: { onChange, value } }) => (
          <Input
            label={t("load.truckType")}
            value={value}
            onChangeText={onChange}
            error={errors.truckType?.message}
            required
            hint="FLATBED, REFRIGERATED, etc."
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
        name="specialInstructions"
        render={({ field: { onChange, value } }) => (
          <Input
            label="Special Instructions"
            value={value ?? ""}
            onChangeText={onChange}
            multiline
            numberOfLines={2}
          />
        )}
      />

      <Button
        title={t("load.createLoad")}
        onPress={handleSubmit(onSubmit)}
        loading={createLoad.isPending}
        fullWidth
        size="lg"
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing["2xl"] },
});
