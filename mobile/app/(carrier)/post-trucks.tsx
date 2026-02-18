/**
 * Post Trucks Screen (Carrier)
 * Create truck availability postings
 */
import React from "react";
import { Text, ScrollView, StyleSheet, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { useTrucks, useCreateTruckPosting } from "../../src/hooks/useTrucks";
import type { Truck } from "../../src/types";
import { Input } from "../../src/components/Input";
import { Button } from "../../src/components/Button";
import { LoadingSpinner } from "../../src/components/LoadingSpinner";
import { EmptyState } from "../../src/components/EmptyState";
import { colors } from "../../src/theme/colors";
import { spacing } from "../../src/theme/spacing";
import { typography } from "../../src/theme/typography";

const postingSchema = z.object({
  truckId: z.string().min(1, "Select a truck"),
  originCityId: z.string().min(1, "Origin city is required"),
  destinationCityId: z.string().optional(),
  availableFrom: z.string().min(1, "Available from date is required"),
  availableTo: z.string().optional(),
  contactName: z.string().min(1, "Contact name is required"),
  contactPhone: z.string().min(1, "Contact phone is required"),
  notes: z.string().optional(),
});

type PostingForm = z.infer<typeof postingSchema>;

export default function PostTrucksScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { data: trucksData, isLoading: trucksLoading } = useTrucks();
  const createPosting = useCreateTruckPosting();

  const availableTrucks =
    trucksData?.trucks?.filter(
      (truck: Truck) => truck.isAvailable && truck.approvalStatus === "APPROVED"
    ) ?? [];

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<PostingForm>({
    resolver: zodResolver(postingSchema),
    defaultValues: {
      truckId: "",
      originCityId: "",
      destinationCityId: "",
      availableFrom: new Date().toISOString().split("T")[0],
      availableTo: "",
      contactName: "",
      contactPhone: "",
      notes: "",
    },
  });

  const onSubmit = (data: PostingForm) => {
    createPosting.mutate(
      {
        truckId: data.truckId,
        originCityId: data.originCityId,
        destinationCityId: data.destinationCityId || undefined,
        availableFrom: data.availableFrom,
        availableTo: data.availableTo || undefined,
        contactName: data.contactName,
        contactPhone: data.contactPhone,
        notes: data.notes || undefined,
      },
      {
        onSuccess: () => {
          Alert.alert("Success", "Truck posted!");
          router.back();
        },
        onError: (err) => Alert.alert("Error", err.message),
      }
    );
  };

  if (trucksLoading) return <LoadingSpinner fullScreen />;

  if (availableTrucks.length === 0) {
    return (
      <EmptyState
        icon="bus-outline"
        title="No available trucks"
        message="Add and get your trucks approved before posting"
        actionLabel="Add Truck"
        onAction={() => router.push("/(carrier)/trucks/add")}
      />
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{t("carrier.postTrucks")}</Text>

      <Controller
        control={control}
        name="truckId"
        render={({ field: { onChange, value } }) => (
          <Input
            label="Select Truck"
            value={value}
            onChangeText={onChange}
            error={errors.truckId?.message}
            hint={`Available: ${availableTrucks.map((truck: Truck) => truck.licensePlate).join(", ")}`}
            required
          />
        )}
      />

      <Controller
        control={control}
        name="originCityId"
        render={({ field: { onChange, value } }) => (
          <Input
            label="Origin City ID"
            value={value}
            onChangeText={onChange}
            error={errors.originCityId?.message}
            required
          />
        )}
      />

      <Controller
        control={control}
        name="availableFrom"
        render={({ field: { onChange, value } }) => (
          <Input
            label="Available From"
            value={value}
            onChangeText={onChange}
            error={errors.availableFrom?.message}
            hint="YYYY-MM-DD"
            required
          />
        )}
      />

      <Controller
        control={control}
        name="contactName"
        render={({ field: { onChange, value } }) => (
          <Input
            label="Contact Name"
            value={value}
            onChangeText={onChange}
            error={errors.contactName?.message}
            required
          />
        )}
      />

      <Controller
        control={control}
        name="contactPhone"
        render={({ field: { onChange, value } }) => (
          <Input
            label="Contact Phone"
            value={value}
            onChangeText={onChange}
            error={errors.contactPhone?.message}
            keyboardType="phone-pad"
            required
          />
        )}
      />

      <Controller
        control={control}
        name="notes"
        render={({ field: { onChange, value } }) => (
          <Input
            label="Notes"
            value={value ?? ""}
            onChangeText={onChange}
            multiline
            numberOfLines={3}
          />
        )}
      />

      <Button
        title="Post Truck"
        onPress={handleSubmit(onSubmit)}
        loading={createPosting.isPending}
        fullWidth
        size="lg"
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing["2xl"] },
  title: {
    ...typography.headlineMedium,
    color: colors.textPrimary,
    marginBottom: spacing["2xl"],
  },
});
