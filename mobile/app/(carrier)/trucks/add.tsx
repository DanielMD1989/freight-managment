/**
 * Add Truck Screen
 */
import React from "react";
import {
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Alert,
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
          Alert.alert("Success", "Truck added successfully!");
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
            <Input
              label={t("truck.truckType")}
              value={value}
              onChangeText={onChange}
              error={errors.truckType?.message}
              required
              hint="FLATBED, REFRIGERATED, TANKER, CONTAINER, DRY_VAN, LOWBOY, DUMP_TRUCK, BOX_TRUCK"
              testID="truck-truckType"
            />
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
});
